#!/usr/bin/env python3
"""Copy web PNGs into src-tauri/icons and write a PNG-in-ICO for NSIS."""

from __future__ import annotations

import shutil
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_ICONS = ROOT / "apps" / "web" / "icons"
OUT = ROOT / "src-tauri" / "icons"


def write_png_ico(png_path: Path, ico_path: Path) -> None:
    data = png_path.read_bytes()
    # ICONDIR + one ICONDIRENTRY + PNG payload (valid Windows ICO).
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack(
        "<BBBBHHII",
        0,  # width 256
        0,  # height 256
        0,
        0,
        1,
        32,
        len(data),
        6 + 16,
    )
    ico_path.write_bytes(header + entry + data)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    mapping = {
        "icon-48.png": "32x32.png",
        "icon-128.png": "128x128.png",
        "icon-256.png": "128x128@2x.png",
    }
    for src_name, dest_name in mapping.items():
        src = WEB_ICONS / src_name
        if not src.is_file():
            raise SystemExit(f"missing {src}")
        shutil.copyfile(src, OUT / dest_name)
    png256 = WEB_ICONS / "icon-256.png"
    write_png_ico(png256, OUT / "icon.ico")
    print(f"wrote Tauri icons in {OUT}")


if __name__ == "__main__":
    main()
