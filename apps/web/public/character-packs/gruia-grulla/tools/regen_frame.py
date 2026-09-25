#!/usr/bin/env python3
"""Regeneración supervisada de frames — puente runner ↔ pipeline del pack.

El runner (Codex u otro agente) genera un render crudo del personaje sobre
fondo magenta plano. Este script lo integra en la hoja raw de la emoción,
reutiliza `process_pack.process_emotion` (chroma → desmoteado → escala
canónica → anclaje a pies → ΔE/IoU) y materializa la propuesta del job:

  <job-dir>/out/<emocion>-<NNN>.png   frame(s) procesados, listos para el pack
  <job-dir>/result.json              {frames, qc} que consume el daemon

El pack NUNCA se modifica aquí: la aceptación es decisión del revisor en la UI.

Uso:
  python3 tools/regen_frame.py --emotion surprise --index 3 \
      --candidate jobs/<id>/candidate.png --job-dir jobs/<id>
  python3 tools/regen_frame.py --emotion joy \
      --candidate f0.png --candidate f1.png ... --job-dir jobs/<id>
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import process_pack as pp  # noqa: E402

PACK = Path(pp.PACK)
MAGENTA = (255, 0, 255)


def cell_box(sheet: Image.Image, index: int) -> tuple[int, int, int, int]:
    """4x2 row-major cell rectangle — same rounding as crop_sheet."""
    left, right = round((index % 4) * sheet.width / 4), round(((index % 4) + 1) * sheet.width / 4)
    top, bottom = round((index // 4) * sheet.height / 2), round(((index // 4) + 1) * sheet.height / 2)
    return left, top, right, bottom


def paste_candidate(sheet: Image.Image, candidate: Image.Image, index: int) -> None:
    """Fit the generated render into cell `index` over flat magenta.

    Alpha-bearing candidates composite over magenta so soft antialiased edges
    premultiply against the same matte the chroma step later removes.
    """
    box = cell_box(sheet, index)
    size = (box[2] - box[0], box[3] - box[1])
    cell = Image.new("RGB", size, MAGENTA)
    fitted = candidate.resize(size, Image.Resampling.LANCZOS)
    if fitted.mode == "RGBA":
        cell.paste(fitted.convert("RGB"), (0, 0), fitted)
    else:
        cell.paste(fitted.convert("RGB"), (0, 0))
    sheet.paste(cell, box[:2])


def pack_frame(emotion: str, index: int) -> np.ndarray | None:
    path = PACK / emotion / f"{index:03d}.png"
    return pp.rgba(Image.open(path)) if path.exists() else None


def frame_qc(emotion: str, index: int, rendered: np.ndarray, palette: list[list[int]], metrics: dict) -> dict:
    """Metrics for one proposed frame, against the pack's real neighbors."""
    previous, following = pack_frame(emotion, index - 1), pack_frame(emotion, index + 1)
    threshold = 0.80 if emotion == "idle" else 0.65
    iou_prev = round(pp.iou(rendered, previous), 4) if previous is not None else None
    iou_next = round(pp.iou(rendered, following), 4) if following is not None else None
    flags = set(metrics.get("flags", []))
    for value in (iou_prev, iou_next):
        if value is not None and value < threshold:
            flags.add("salto_silueta")
    return {
        "index": index,
        "paletteDeltaE": metrics["paletteDeltaE"],
        "silhouetteIoUPrevious": iou_prev,
        "silhouetteIoUNext": iou_next,
        "sheetIoUPrevious": metrics.get("silhouetteIoUPrevious"),
        "specksResidual": metrics.get("specksResidual", 0),
        "clipped": metrics.get("transform", {}).get("clipped", False),
        "flags": sorted(flags),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--emotion", required=True, choices=pp.EMOTIONS)
    parser.add_argument("--index", type=int, help="frame 0..7 a sustituir; sin índice se sustituyen hasta 8 celdas en orden")
    parser.add_argument("--candidate", action="append", required=True, help="render crudo generado (repetible); una hoja 4x2 completa también vale")
    parser.add_argument("--sheet", type=Path, help="hoja raw base (por defecto sheets/<emocion>_raw.png)")
    parser.add_argument("--job-dir", required=True, type=Path)
    args = parser.parse_args()

    if args.index is not None and not 0 <= args.index <= 7:
        raise SystemExit("--index admite 0..7")
    if args.index is None and len(args.candidate) not in (1, 8):
        raise SystemExit("sin --index se esperan 8 candidatos (uno por celda) o una hoja 4x2")

    job_dir = args.job_dir.resolve()
    out_dir = job_dir / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    job_dir.mkdir(parents=True, exist_ok=True)

    candidates = [Image.open(path).convert("RGBA") for path in args.candidate]
    sheet_path = args.sheet or (PACK / "sheets" / f"{args.emotion}_raw.png")

    work_dir = job_dir / "work"
    work_dir.mkdir(parents=True, exist_ok=True)

    if args.index is not None:
        if not sheet_path.exists():
            raise SystemExit(f"falta hoja base: {sheet_path}")
        sheet = Image.open(sheet_path).convert("RGB")
        paste_candidate(sheet, candidates[0], args.index)
        targets = [args.index]
    elif len(candidates) == 1 and candidates[0].width >= 4 * candidates[0].height // 3:
        sheet = candidates[0].convert("RGB")
        targets = list(range(8))
    else:
        if not sheet_path.exists():
            raise SystemExit(f"falta hoja base: {sheet_path}")
        sheet = Image.open(sheet_path).convert("RGB")
        for index, image in enumerate(candidates):
            paste_candidate(sheet, image, index)
        targets = list(range(len(candidates)))
    work_sheet = work_dir / f"{args.emotion}_raw.png"
    sheet.save(work_sheet)

    master = pp.rgba(Image.open(PACK / "ref" / "master.png"))
    palette = pp.palette_from_master(master)
    output, result = pp.process_emotion(args.emotion, work_sheet, master, palette, "gen")

    frames, qc = [], {}
    for index in targets:
        name = f"{args.emotion}-{index:03d}.png"
        pp.save(output[index], out_dir / name)
        frames.append(name)
        qc[name] = frame_qc(args.emotion, index, output[index], palette, result["frames"][index])

    payload = {
        "frames": frames,
        "qc": qc,
        "emotion": args.emotion,
        "emotionDeltaEMean": result["paletteDeltaEMean"],
        "anchorXMode": result["anchorXMode"],
    }
    (job_dir / "result.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print("regen_frame: " + json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
