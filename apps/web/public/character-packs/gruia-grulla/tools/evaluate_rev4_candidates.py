#!/usr/bin/env python3
"""Evaluate rev4 joy/surprise sheets in an isolated pack; never installs them."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PACK = Path(__file__).resolve().parents[1]
EMOTIONS = ("joy", "surprise")
AFFECTED = [("joy", i) for i in range(8)] + [("surprise", i) for i in range(3, 7)]


def compare(before: Path, after: Path, destination: Path) -> None:
    thumb, row_h = 128, 146
    out = Image.new("RGBA", (thumb * 2, row_h * len(AFFECTED)), (240, 240, 240, 255))
    draw = ImageDraw.Draw(out); font = ImageFont.load_default()
    for row, (emotion, index) in enumerate(AFFECTED):
        y = row * row_h
        for col, root in enumerate((before, after)):
            image = Image.open(root / emotion / f"{index:03d}.png").convert("RGBA").resize((thumb, thumb), Image.Resampling.LANCZOS)
            out.alpha_composite(image, (col * thumb, y + 18))
        draw.text((2, y + 2), f"{emotion}/{index:03d}  antes", fill=(25, 25, 25, 255), font=font)
        draw.text((thumb + 2, y + 2), "después", fill=(25, 25, 25, 255), font=font)
    destination.parent.mkdir(parents=True, exist_ok=True)
    out.save(destination)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def strip_grid_lines(raw_path: Path, native_path: Path, emotion: str) -> dict:
    """Clear only neutral black/white grid pixels in the 4x2 cell boundary bands."""
    raw = np.array(Image.open(raw_path).convert("RGB"))
    native = np.array(Image.open(native_path).convert("RGBA"))
    height, width = raw.shape[:2]
    boundary = np.zeros((height, width), dtype=bool)
    # Black is one or two pixels wide; white may be about three.  The 3px
    # half-band leaves surprise/004's crest (six pixels inside its cell) alone.
    for x in (0, round(width / 4), round(width / 2), round(3 * width / 4), width - 1):
        boundary[:, max(0, x - 3):min(width, x + 4)] = True
    for y in (0, round(height / 2), height - 1):
        boundary[max(0, y - 3):min(height, y + 4), :] = True
    # In the native RGBA the black line is premultiplied with magenta, so it
    # is not necessarily neutral any more.  The reviewed sheets leave at
    # least six pixels of empty margin (including surprise/004's crest), so
    # the complete four-pixel cell-border band is safe and deterministic.
    grid = boundary
    raw[grid] = (255, 0, 255)
    native[grid, 3] = 0
    Image.fromarray(raw, "RGB").save(raw_path)
    Image.fromarray(native, "RGBA").save(native_path)
    return {"emotion": emotion, "method": "all reviewed-empty cell-border bands ±3px cleared in RGB and native alpha; handles premultiplied black/white grid", "removedPixels": int(grid.sum()), "boundary": {"vertical": [0, round(width / 4), round(width / 2), round(3 * width / 4), width - 1], "horizontal": [0, round(height / 2), height - 1]}, "outputRawSha256": sha256(raw_path), "outputNativeSha256": sha256(native_path)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--attempt", type=int, required=True)
    parser.add_argument("--label", help="prefijo de evidencia; por defecto attempt<N>")
    args = parser.parse_args()
    rev = PACK / "evidence/rev4"
    source = {emotion: {kind: rev / f"{emotion}_attempt{args.attempt}_{kind}.png" for kind in ("raw", "original")} for emotion in EMOTIONS}
    missing = [str(path) for values in source.values() for path in values.values() if not path.exists()]
    if missing:
        raise SystemExit("faltan candidatos: " + ", ".join(missing))
    label = args.label or f"attempt{args.attempt}"
    target = rev / f"{label}-eval"
    if target.exists():
        raise SystemExit(f"ya existe evaluación: {target}")
    for part in ("tools", "sheets", "evidence", "previews"):
        (target / part).mkdir(parents=True, exist_ok=True)
    shutil.copy2(PACK / "tools/pack-config.json", target / "tools/pack-config.json")
    preprocessing = {}
    for emotion, paths in source.items():
        shutil.copy2(paths["raw"], target / "sheets" / f"{emotion}_raw.png")
        shutil.copy2(paths["original"], target / "evidence" / f"{emotion}_imagegen_original.png")
        preprocessing[emotion] = {"sourceRawSha256": sha256(paths["raw"]), "sourceNativeSha256": sha256(paths["original"])}
        preprocessing[emotion].update(strip_grid_lines(target / "sheets" / f"{emotion}_raw.png", target / "evidence" / f"{emotion}_imagegen_original.png", emotion))
    (target / "evidence/preprocessing.json").write_text(json.dumps(preprocessing, indent=2) + "\n")
    env = {**os.environ, "CHARACTER_PACK_ROOT": str(target)}
    subprocess.run([sys.executable, str(PACK / "tools/process_pack.py"), "--emotions", *EMOTIONS], check=True, env=env)
    compare(rev / "baseline/frames", target, rev / f"{label}-affected-12-comparison.png")
    metrics = json.loads((target / "evidence/metrics.json").read_text())
    report = {"attempt": args.attempt, "isolatedPack": str(target), "emotions": metrics["emotions"], "preprocessing": preprocessing, "affectedFrames": [f"{e}/{i:03d}.png" for e, i in AFFECTED], "globalContactModified": False}
    (rev / f"{label}-metrics.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(f"evaluated {label}; final pack untouched")


if __name__ == "__main__":
    main()
