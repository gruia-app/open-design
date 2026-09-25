#!/usr/bin/env python3
"""Preserve one native-alpha imagegen sheet and make its processor matte."""
import argparse
import shutil
from pathlib import Path

from PIL import Image

PACK = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("emotion")
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    if not args.emotion.replace("-", "").isalnum():
        parser.error("emotion must be a slug")
    original = Image.open(args.source).convert("RGBA")
    evidence = PACK / "evidence" / f"{args.emotion}_imagegen_original.png"
    evidence.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.source, evidence)
    sheet = Image.new("RGBA", original.size, "#FF00FF")
    sheet.alpha_composite(original)
    target = PACK / "sheets" / f"{args.emotion}_raw.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(target)
    print(f"native alpha preserved: {evidence}; processor sheet: {target}")


if __name__ == "__main__":
    main()
