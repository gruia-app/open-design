#!/usr/bin/env python3
"""Save a labeled baseline/Devin/new/neighbors comparison and metrics."""
import hashlib
import json
import os
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PACK = Path(__file__).resolve().parents[1]
DEVIN = Path("/home/roberto/src/design-personajes/apps/web/public/character-packs/gruia-grulla/surprise/003.png")
os.environ["CHARACTER_PACK_ROOT"] = str(PACK)
import process_pack as pipeline


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    devin_copy = PACK / "evidence/surprise-003-devin.png"
    source_hash = sha(DEVIN)
    if devin_copy.exists() and sha(devin_copy) != source_hash:
        raise SystemExit(f"preserved Devin source differs: {devin_copy}")
    if not devin_copy.exists(): shutil.copy2(DEVIN, devin_copy)
    paths = {
        "002 neighbor": PACK / "surprise/002.png",
        "Baseline 003": PACK / "evidence/surprise-003-before.png",
        "Devin candidate": devin_copy,
        "New 003": PACK / "surprise/003.png",
        "004 neighbor": PACK / "surprise/004.png",
    }
    images = {label: pipeline.rgba(Image.open(path)) for label, path in paths.items()}
    master = pipeline.rgba(Image.open(PACK / "ref/master.png"))
    palette = pipeline.palette_from_master(master)
    neighbors = (images["002 neighbor"], images["004 neighbor"])
    detail = {}
    for label, image in images.items():
        box = pipeline.bounds(image[:, :, 3])
        detail[label] = {"path": str(paths[label].relative_to(PACK)), "sha256": sha(paths[label]), "paletteDeltaE": round(pipeline.palette_delta(image, palette), 3), "iouVs002": round(pipeline.iou(image, neighbors[0]), 4), "iouVs004": round(pipeline.iou(image, neighbors[1]), 4), "bboxHeight": None if box is None else box[3] - box[1] + 1}
    original_source = PACK / "evidence/surprise-003-imagegen-original.png"
    payload = {"thresholds": {"paletteDeltaE": 8, "neighborIoU": 0.65}, "nativeSource": {"path": str(original_source.relative_to(PACK)), "sha256": sha(original_source)}, "candidates": detail}
    (PACK / "evidence/surprise-003-candidate-comparison.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    tile = 160
    out = Image.new("RGBA", (tile * len(images), tile + 24), (238, 238, 238, 255))
    draw = ImageDraw.Draw(out); font = ImageFont.load_default()
    for i, (label, image) in enumerate(images.items()):
        draw.text((i * tile + 3, 3), label, fill=(20, 20, 20, 255), font=font)
        out.alpha_composite(Image.fromarray(image, "RGBA").resize((tile, tile), Image.Resampling.LANCZOS), (i * tile, 24))
    out.save(PACK / "previews/surprise-003-candidates.png")
    print(json.dumps({"preview": "previews/surprise-003-candidates.png", "metrics": detail}, ensure_ascii=False))


if __name__ == "__main__":
    main()
