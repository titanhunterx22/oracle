#!/usr/bin/env python3
"""Build ORACLE's compressed, alphabet-sharded Open English WordNet lookup.

The official 2025+ JSON export is downloaded at build time, verified by SHA-256,
converted to compact per-letter dictionaries, and placed in dist/. The source
archive is not bundled into the extension.
"""
from __future__ import annotations

import gzip
import hashlib
import io
import json
import re
import shutil
import sys
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path
import unicodedata

SOURCE_URL = (
    "https://github.com/globalwordnet/english-wordnet/releases/download/"
    "2025-edition/english-wordnet-2025-plus-json.zip"
)
SOURCE_SHA256 = "8832b8fa26a14c0ba8c99bb1ef8db6f9e122a6d9193b65ca9e0ef572580fee7e"
SOURCE_RELEASE = "Open English WordNet 2025+"
ATTRIBUTION_URL = "https://github.com/globalwordnet/english-wordnet"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
EXPECTED_MIN_WORDS = 150_000


def normalise_word(value: str) -> str:
    value = unicodedata.normalize("NFKC", str(value)).casefold().strip()
    value = re.sub(r"\s+", " ", value.replace("_", " "))
    return value


def shard_name(word: str) -> str:
    first = word[:1]
    return first if first in "abcdefghijklmnopqrstuvwxyz" else "other"


def as_text_list(value) -> list[str]:
    if isinstance(value, str):
        values = [value]
    elif isinstance(value, list):
        values = value
    else:
        values = []
    return [str(item).strip() for item in values if isinstance(item, str) and item.strip()]


def download_source(cache_dir: Path) -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)
    archive = cache_dir / "english-wordnet-2025-plus-json.zip"
    if not archive.exists():
        request = urllib.request.Request(
            SOURCE_URL,
            headers={"User-Agent": "ORACLE-Dictionary-Builder/1.0"},
        )
        with urllib.request.urlopen(request, timeout=120) as response, archive.open("wb") as output:
            shutil.copyfileobj(response, output)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest != SOURCE_SHA256:
        archive.unlink(missing_ok=True)
        raise RuntimeError(
            "Open English WordNet archive checksum mismatch: "
            + digest
        )
    return archive


def load_json(zf: zipfile.ZipFile, name: str) -> dict:
    try:
        parsed = json.loads(zf.read(name).decode("utf-8"))
    except Exception as error:
        raise RuntimeError(f"Could not parse dataset JSON {name}: {error}") from error
    if not isinstance(parsed, dict):
        raise RuntimeError(f"Expected a JSON object in {name}")
    return parsed


def build(source_zip: Path, output_dir: Path) -> dict:
    synsets: dict[str, dict] = {}
    entry_files: list[str] = []

    with zipfile.ZipFile(source_zip) as zf:
        archive_names = zf.namelist()
        json_names = [name for name in archive_names if name.lower().endswith(".json")]
        # The official release ZIP intentionally flattens the JSON export:
        # entries-a.json, noun.person.json, adj.all.json, etc. are at archive root.
        names = json_names
        if not names:
            raise RuntimeError(
                "Could not locate the WordNet JSON source files. "
                "JSON archive members: " + repr(json_names[:50]) +
                "; archive sample: " + repr(archive_names[:30])
            )

        synset_files = [
            name for name in names
            if Path(name).name.startswith(("noun.", "verb.", "adj.", "adv."))
        ]
        entry_files = [
            name for name in names
            if Path(name).name.startswith("entries-")
        ]
        if not synset_files or not entry_files:
            raise RuntimeError(
                f"Unexpected WordNet archive layout: {len(synset_files)} synset files, "
                f"{len(entry_files)} entry files."
            )

        for name in synset_files:
            data = load_json(zf, name)
            for synset_id, item in data.items():
                if not isinstance(item, dict):
                    continue
                definitions = as_text_list(item.get("definition"))
                if not definitions:
                    continue
                examples = as_text_list(item.get("example"))
                members = as_text_list(item.get("members"))
                synsets[str(synset_id)] = {
                    "definition": definitions[0],
                    "examples": examples[:2],
                    "members": members[:8],
                    "pos": str(item.get("partOfSpeech") or ""),
                }

        words: dict[str, list[dict]] = defaultdict(list)
        for name in entry_files:
            data = load_json(zf, name)
            for written_form, form_data in data.items():
                if not isinstance(form_data, dict):
                    continue
                word = normalise_word(written_form)
                if not word or len(word) > 100:
                    continue
                for pos, pos_data in form_data.items():
                    if not isinstance(pos_data, dict):
                        continue
                    senses = pos_data.get("sense", [])
                    if not isinstance(senses, list):
                        continue
                    for sense in senses:
                        if not isinstance(sense, dict):
                            continue
                        synset_id = str(sense.get("synset") or "")
                        synset = synsets.get(synset_id)
                        if not synset:
                            continue
                        definition = synset["definition"]
                        if any(
                            existing["definition"] == definition
                            and existing["pos"] == str(pos)
                            for existing in words[word]
                        ):
                            continue
                        related = [
                            member for member in synset["members"]
                            if normalise_word(member) != word
                        ][:6]
                        words[word].append({
                            "pos": str(pos),
                            "definition": definition,
                            "example": synset["examples"][0] if synset["examples"] else "",
                            "related": related,
                        })

    if len(words) < EXPECTED_MIN_WORDS:
        raise RuntimeError(
            f"Only {len(words):,} defined word forms were produced; expected at least "
            f"{EXPECTED_MIN_WORDS:,}. Refusing to ship an incomplete dictionary."
        )

    shards: dict[str, dict] = defaultdict(dict)
    senses_count = 0
    for word, senses in words.items():
        senses.sort(key=lambda sense: ("nvars".find(sense["pos"]) if sense["pos"] in "nvars" else 9,
                                       sense["definition"]))
        shards[shard_name(word)][word] = senses
        senses_count += len(senses)

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    shard_sizes = {}
    for key, shard in sorted(shards.items()):
        payload = json.dumps(
            shard, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        path = output_dir / f"{key}.json.gz"
        with path.open("wb") as raw:
            with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as zipped:
                zipped.write(payload)
        shard_sizes[path.name] = {
            "words": len(shard),
            "compressed_bytes": path.stat().st_size,
        }

    metadata = {
        "dataset": SOURCE_RELEASE,
        "source": ATTRIBUTION_URL,
        "license": "CC BY 4.0 (with Princeton WordNet attribution)",
        "license_url": LICENSE_URL,
        "word_count": len(words),
        "sense_count": senses_count,
        "shard_count": len(shards),
        "shards": shard_sizes,
    }
    (output_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return metadata


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    cache_dir = root / ".cache" / "dictionary"
    output_dir = root / "dist" / "dictionary-data"
    archive = download_source(cache_dir)
    metadata = build(archive, output_dir)
    compressed = sum(item["compressed_bytes"] for item in metadata["shards"].values())
    print(
        f"Built {metadata['word_count']:,} offline word forms and "
        f"{metadata['sense_count']:,} senses in {metadata['shard_count']} shards "
        f"({compressed / 1024 / 1024:.2f} MiB compressed)."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Dictionary build failed: {error}", file=sys.stderr)
        raise
