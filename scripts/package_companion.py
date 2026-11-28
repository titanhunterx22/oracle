#!/usr/bin/env python3
"""Package the PyInstaller one-folder app as a standalone Windows companion ZIP."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "dist" / "ORACLE-Creative-Studio"
SOURCE = ROOT / "companion" / "image-engine"
OUTPUT = ROOT / "companion-dist" / "ORACLE-Creative-Studio-Engine.zip"
ROOT_FILES = [
    "README.md",
    "Install-ORACLE-Creative-Studio.ps1",
    "Start-ORACLE-Creative-Studio.ps1",
]

def main():
    executable = APP / "ORACLE-Creative-Studio.exe"
    if not executable.is_file():
        raise FileNotFoundError("PyInstaller output is missing: " + str(executable))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED, compresslevel=1) as archive:
        for name in ROOT_FILES:
            path = SOURCE / name
            if not path.is_file():
                raise FileNotFoundError(path)
            archive.write(path, arcname=name)
        count = 0
        for path in sorted(APP.rglob("*")):
            if path.is_file():
                archive.write(path, arcname="ORACLE-Creative-Studio/" + path.relative_to(APP).as_posix())
                count += 1
    with ZipFile(OUTPUT) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError("Invalid ZIP member: " + bad)
        if "ORACLE-Creative-Studio/ORACLE-Creative-Studio.exe" not in archive.namelist():
            raise RuntimeError("The packaged application executable is missing.")
    print("Packaged self-contained ORACLE Creative Studio with " + str(count) +
          " runtime files: " + str(OUTPUT))

if __name__ == "__main__":
    main()
