#!/usr/bin/env python3
"""Create the separately downloadable ORACLE Windows image-engine companion ZIP."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "companion" / "image-engine"
OUTPUT = ROOT / "companion-dist" / "ORACLE-Creative-Studio-Engine.zip"
FILES = [
    "README.md",
    "requirements.txt",
    "server.py",
    "Install-ORACLE-Creative-Studio.ps1",
    "Start-ORACLE-Creative-Studio.ps1",
]

def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name in FILES:
            path = SOURCE / name
            if not path.is_file():
                raise FileNotFoundError(path)
            archive.write(path, arcname=name)
    with ZipFile(OUTPUT) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError("Invalid ZIP member: " + bad)
    print("Packaged " + str(len(FILES)) + " companion files: " + str(OUTPUT))

if __name__ == "__main__":
    main()
