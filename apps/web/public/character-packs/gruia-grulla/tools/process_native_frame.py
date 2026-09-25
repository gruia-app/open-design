#!/usr/bin/env python3
"""Process one native-alpha frame, matching the untouched neighboring scale."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image
import numpy as np

PACK = Path(__file__).resolve().parents[1]
os.environ["CHARACTER_PACK_ROOT"] = str(PACK)
import process_pack as pipeline


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("emotion", choices=("surprise",))
    parser.add_argument("index", type=int, choices=(3,))
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    emotion, index = args.emotion, args.index
    if index in (0, 7): parser.error("single-frame retouch requires two untouched neighbors")
    master = pipeline.rgba(Image.open(PACK / "ref/master.png"))
    palette = pipeline.palette_from_master(master)
    native = pipeline.rgba(Image.open(args.source))
    if native.shape[0] != native.shape[1]: parser.error("source must be square")
    chroma = Image.new("RGBA", (native.shape[1], native.shape[0]), (255, 0, 255, 255))
    chroma.alpha_composite(Image.fromarray(native, "RGBA"))
    chroma_alpha = pipeline.alpha_from_magenta(pipeline.rgba(chroma)[:, :, :3])
    alpha, specks = pipeline.remove_specks(native[:, :, 3])
    rgb, spill_before, spill_after = pipeline.despill_magenta(native[:, :, :3], alpha)
    source = np.dstack((rgb, alpha))
    source_bounds = pipeline.bounds(alpha)
    if not source_bounds: raise SystemExit("source has no foreground alpha")

    neighbors = {}
    heights = []
    for neighbor in (index - 1, index + 1):
        image = pipeline.rgba(Image.open(PACK / emotion / f"{neighbor:03d}.png"))
        box = pipeline.bounds(image[:, :, 3])
        if box is None: raise SystemExit(f"neighbor {neighbor:03d} is empty")
        neighbors[neighbor] = image
        heights.append(box[3] - box[1] + 1)
    target_height = float(np.median(heights))
    source_height = source_bounds[3] - source_bounds[1] + 1
    scale = target_height / source_height
    rendered, transform = pipeline.render_to_anchor(source, scale)
    clean_alpha, rendered_specks = pipeline.remove_specks(rendered[:, :, 3])
    rendered[:, :, 3] = clean_alpha
    delta = round(pipeline.palette_delta(rendered, palette), 3)
    neighbor_ious = {str(i): round(pipeline.iou(rendered, image), 4) for i, image in neighbors.items()}
    flags = []
    if delta > 8: flags.append("salto_palette")
    if transform["clipped"]: flags.append("clipping")
    master_area = int((master[:, :, 3] > 30).sum())
    area = int((rendered[:, :, 3] > 30).sum())
    if area > master_area * 2.7 or area < master_area * .30: flags.append("mismatch_master")
    _, residual = pipeline.remove_specks(rendered[:, :, 3])
    if residual: flags.append("foreground_espurio")
    if any(value < .65 for value in neighbor_ious.values()): flags.append("neighbor_iou_below_0.65")
    if flags: raise SystemExit(json.dumps({"rejected": True, "deltaE": delta, "neighborIoU": neighbor_ious, "flags": flags}))

    metrics_path = PACK / "evidence/metrics.json"
    evidence = json.loads(metrics_path.read_text())
    previous = json.loads(json.dumps(evidence["emotions"]))
    result = evidence["emotions"][emotion]
    old = pipeline.rgba(Image.open(PACK / emotion / f"{index:03d}.png"))
    before_copy = PACK / "evidence" / f"{emotion}-{index:03d}-before.png"
    if not before_copy.exists(): shutil.copy2(PACK / emotion / f"{index:03d}.png", before_copy)
    source_copy = PACK / "evidence" / f"{emotion}-{index:03d}-imagegen-original.png"
    source_copy.parent.mkdir(parents=True, exist_ok=True)
    if args.source.resolve() != source_copy.resolve():
        source_hash = hashlib.sha256(args.source.read_bytes()).digest()
        if source_copy.exists() and hashlib.sha256(source_copy.read_bytes()).digest() != source_hash:
            raise SystemExit(f"preserved source differs; inspect {source_copy} before retry")
        if not source_copy.exists(): shutil.copy2(args.source, source_copy)
    pipeline.save(rendered, PACK / emotion / f"{index:03d}.png")
    frame = {"index": index, "src": f"{emotion}/{index:03d}.png", "origin": "gen", "paletteDeltaE": delta, "silhouetteIoUPrevious": neighbor_ious[str(index - 1)], "specksRemoved": specks + rendered_specks, "specksResidual": residual, "extraction": {"mode": "native-alpha-validated-against-magenta", "alphaMaeVsChroma": round(float(np.abs(native[:, :, 3].astype(np.int16) - chroma_alpha.astype(np.int16)).mean()), 3), "magentaSpillBefore": spill_before, "magentaSpillResidual": spill_after}, "flags": [], "transform": transform, "neighborIoU": neighbor_ious}
    result["frames"][index] = frame
    next_frame = result["frames"][index + 1]
    next_frame["silhouetteIoUPrevious"] = neighbor_ious[str(index + 1)]
    next_flags = set(next_frame.get("flags", [])) - {"salto_silueta"}
    if next_frame["silhouetteIoUPrevious"] < .65: next_flags.add("salto_silueta")
    next_frame["flags"] = sorted(next_flags)
    loop = result["loopIoU"]
    result["paletteDeltaEMean"] = round(float(np.mean([f["paletteDeltaE"] for f in result["frames"]])), 3)
    result["silhouetteIoUMin"] = round(min([loop] + [f["silhouetteIoUPrevious"] for f in result["frames"][1:]]), 4)
    result["flags"] = sorted({flag for f in result["frames"] for flag in f.get("flags", [])} | set(result.get("manualFlags", [])))
    evidence["generatedAt"] = datetime.now(timezone.utc).isoformat()
    metrics_path.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n")
    pipeline.write_pack(evidence["emotions"], palette)
    pipeline.write_qc(evidence["emotions"])
    images = [pipeline.rgba(Image.open(PACK / emotion / f"{i:03d}.png")) for i in range(8)]
    pipeline.contact(images, PACK / f"previews/{emotion}_contact.png")
    pipeline.gif(images, PACK / f"previews/{emotion}.gif", 10)
    before_after = [neighbors[index - 1], old, neighbors[index + 1], neighbors[index - 1], rendered, neighbors[index + 1]]
    pipeline.contact(before_after, PACK / "previews/surprise-003-before-after.png", columns=3)
    raw_paths = {e: PACK / "sheets" / f"{e}_raw.png" for e in pipeline.EMOTIONS}
    pipeline.write_diagnostics(evidence["emotions"], raw_paths, previous)
    pipeline.write_alpha_review(master)
    print(json.dumps({"accepted": True, "scale": round(scale, 6), "neighborTargetHeights": heights, "renderedHeight": pipeline.bounds(rendered[:, :, 3])[3] - pipeline.bounds(rendered[:, :, 3])[1] + 1, "deltaE": delta, "neighborIoU": neighbor_ious, "flags": flags, "alphaMaeVsChroma": frame["extraction"]["alphaMaeVsChroma"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
