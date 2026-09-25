#!/usr/bin/env python3
"""Reproduce el croma plano desde los originales de imagegen del pack actual."""
from pathlib import Path

from PIL import Image

pack = Path(__file__).resolve().parents[1]
for src in sorted((pack / "evidence").glob("*_imagegen_original.png")):
    emotion = src.name.removesuffix("_imagegen_original.png")
    original = Image.open(src).convert("RGBA")
    sheet = Image.new("RGBA", original.size, "#FF00FF")
    sheet.alpha_composite(original)
    sheet.convert("RGB").save(pack / "sheets" / f"{emotion}_raw.png")
