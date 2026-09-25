#!/usr/bin/env python3
"""Normaliza master y procesa hojas 4x2 sobre magenta para character-pack v1."""
from __future__ import annotations

import argparse
import colorsys
import io
import json
import math
import os
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PACK = Path(os.environ.get("CHARACTER_PACK_ROOT", Path(__file__).resolve().parents[1]))
DEFAULT_CONFIG = {"id": "gruia-grulla", "name": "Gui", "brand": "gruia", "sourceMaster": "/home/roberto/.t3/userdata/leaders-20260923/producto-saas/branding/img/gruia_explorador.png", "anchorMode": "grulla-shoes"}
CONFIG_PATH = PACK / "tools/pack-config.json"
CONFIG = {**DEFAULT_CONFIG, **(json.loads(CONFIG_PATH.read_text()) if CONFIG_PATH.exists() else {})}
SOURCE_MASTER = Path(CONFIG["sourceMaster"])
ANCHOR_MODE = CONFIG["anchorMode"]
SIZE, ANCHOR, TARGET_HEIGHT = 512, (256, 472), 408
EMOTIONS = ("idle", "smile", "joy", "surprise", "sad", "annoyed", "thinking", "wave", "nudge", "triumph")
LABELS = {"idle": "Respiración", "smile": "Sonrisa", "joy": "Alegría", "surprise": "Sorpresa", "sad": "Tristeza", "annoyed": "Molesto", "thinking": "Pensando", "wave": "Saludo", "nudge": "Toque", "triumph": "Celebración"}


def rgba(image: Image.Image) -> np.ndarray:
    return np.asarray(image.convert("RGBA"), dtype=np.uint8)


def save(array: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(array, "RGBA").save(path)


def alpha_from_white(rgb: np.ndarray) -> np.ndarray:
    """Keep coloured paper plus dark glasses/shoes; white/grey background becomes clear."""
    f = rgb.astype(np.float32) / 255.0
    hi, lo = f.max(2), f.min(2)
    sat = np.divide(hi - lo, np.maximum(hi, 1e-6))
    lum = 0.2126 * f[:, :, 0] + 0.7152 * f[:, :, 1] + 0.0722 * f[:, :, 2]
    # The studio floor/shadow is light (>=.65); neutral grey glasses and shoes are art.
    colour = np.clip((sat - 0.10) / 0.10, 0, 1)
    dark = np.clip((0.65 - lum) / 0.15, 0, 1)
    return (255 * np.maximum(colour, dark)).astype(np.uint8)


def alpha_from_white_tinta(rgb: np.ndarray) -> np.ndarray:
    """Tinta keeps the black binder but excludes its detached grey floor shadow."""
    f = rgb.astype(np.float32) / 255.0
    hi, lo = f.max(2), f.min(2)
    sat = np.divide(hi - lo, np.maximum(hi, 1e-6))
    lum = .2126 * f[:, :, 0] + .7152 * f[:, :, 1] + .0722 * f[:, :, 2]
    colour = np.clip((sat - .14) / .10, 0, 1)
    dark = np.clip((.34 - lum) / .10, 0, 1)
    return (255 * np.maximum(colour, dark)).astype(np.uint8)


def recover_tinta_metal_edges(rgb: np.ndarray, alpha: np.ndarray) -> tuple[np.ndarray, int]:
    """Restore the narrow neutral anti-alias band around Tinta's dark upper clip.

    Only source pixels immediately adjacent to a dark metal core are considered.
    The white handle holes remain background: their luminance is above the
    candidate range and they have no coloured/dark fill applied.
    """
    f = rgb.astype(np.float32) / 255.0
    hi, lo = f.max(2), f.min(2)
    sat = np.divide(hi - lo, np.maximum(hi, 1e-6))
    lum = .2126 * f[:, :, 0] + .7152 * f[:, :, 1] + .0722 * f[:, :, 2]
    # The binder is in the top third of this approved source.  A two-source-
    # pixel band is enough for AA at the final 512px scale and cannot reach
    # the detached lower floor residue.
    core = (alpha > 220) & (lum < .38) & (np.indices(alpha.shape)[0] < 360)
    near_core = np.asarray(Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    candidate = near_core & (alpha < 250) & (sat < .16) & (lum < .82) & (np.indices(alpha.shape)[0] < 360)
    # With the local white matte, luminance encodes coverage of near-black
    # wire.  This recovers a dark/grey AA edge instead of retaining white RGB.
    coverage = np.clip((.96 - lum) / (.96 - .08), 0, 1)
    repaired = np.maximum(alpha, np.round(coverage * 255).astype(np.uint8))
    changed = candidate & (repaired > alpha)
    return np.where(candidate, repaired, alpha).astype(np.uint8), int(changed.sum())


def fill_enclosed(alpha: np.ndarray) -> tuple[np.ndarray, int]:
    """Keep the border-connected studio background clear, restore closed accessory interiors."""
    solid = alpha > 20
    padded = np.pad(solid, 1, constant_values=False)
    flood = Image.new("L", padded.shape[::-1], 0)
    flood.paste(Image.fromarray(solid.astype(np.uint8) * 255), (1, 1))
    ImageDraw.floodfill(flood, (0, 0), 128)
    visited = np.asarray(flood)[1:-1, 1:-1]
    holes = (visited == 0)
    output = alpha.copy(); output[holes] = 255
    return output, int(holes.sum())


def clean_tinta_master_residuals(master: np.ndarray) -> tuple[np.ndarray, dict]:
    """Drop only white wire fringe and neutral floor shadow; keep gold tentacles and wire holes."""
    result = master.copy(); rgb, alpha = result[:, :, :3], result[:, :, 3]
    f = rgb.astype(np.float32) / 255.0
    hi, lo = f.max(2), f.min(2)
    sat = np.divide(hi - lo, np.maximum(hi, 1e-6))
    lum = .2126 * f[:, :, 0] + .7152 * f[:, :, 1] + .0722 * f[:, :, 2]
    # White / near-white subpixel contamination is not part of gold paper or black wire.
    wire_fringe = (alpha > 0) & (alpha <= 64) & (sat < .12) & (lum > .70)
    # Floor residue is muted and partially transparent; opaque gold tentacle facets remain.
    lower = np.indices(alpha.shape)[0] > int(SIZE * .82)
    floor_shadow = (lower & (alpha > 0) & (sat < .35) & (lum > .20)) | (lower & (alpha > 0) & (alpha <= 32))
    remove = wire_fringe | floor_shadow
    result[remove] = 0
    detached = 0
    for part in components(result[:, :, 3] > 20):
        if len(part) < 50:
            ys, xs = zip(*part); result[list(ys), list(xs)] = 0; detached += len(part)
    return result, {"wireWhiteFringeRemoved": int(wire_fringe.sum()), "floorGreyShadowRemoved": int(floor_shadow.sum()), "detachedFloorOrEdgeComponentsRemoved": detached, "residualBrightEdge": int((((result[:, :, 3] > 0) & (result[:, :, 3] <= 16) & (result[:, :, :3].min(2) > 180))).sum())}


def write_tinta_alpha_crop(master: np.ndarray) -> None:
    """Magnified objective readback of wire/clip and tentacle-support edges."""
    crops = (("clip / claro", (210, 35, 410, 190), (245, 245, 245, 255)), ("clip / oscuro", (210, 35, 410, 190), (18, 18, 18, 255)), ("apoyos / claro", (140, 410, 385, 480), (245, 245, 245, 255)), ("apoyos / oscuro", (140, 410, 385, 480), (18, 18, 18, 255)))
    # The four panels occupy 550px; a tight canvas keeps the visual evidence focused.
    out = Image.new("RGBA", (800, 550), (0, 0, 0, 255)); draw = ImageDraw.Draw(out)
    for i, (label, box, background) in enumerate(crops):
        tile = Image.new("RGBA", (box[2]-box[0], box[3]-box[1]), background)
        tile.alpha_composite(Image.fromarray(master, "RGBA").crop(box))
        tile = tile.resize((400, 350 if i < 2 else 200), Image.Resampling.NEAREST)
        x, y = (i % 2) * 400, 0 if i < 2 else 350
        out.alpha_composite(tile, (x, y)); draw.text((x + 10, y + 10), label, fill=(20, 20, 20, 255) if background[0] > 100 else (240, 240, 240, 255), font=ImageFont.load_default())
    out.save(PACK / "evidence/master-alpha-crop-after.png")


def alpha_from_magenta(rgb: np.ndarray) -> np.ndarray:
    """Distance-key #ff00ff; soft ramp keeps antialiased orange and black edges."""
    target = np.array([255, 0, 255], dtype=np.float32)
    distance = np.linalg.norm(rgb.astype(np.float32) - target, axis=2)
    alpha = np.clip((distance - 18.0) / 70.0, 0, 1)
    # Generated sheets can carry fuchsia compression noise. Hue test catches it.
    f = rgb.astype(np.float32) / 255.0
    hi, lo = f.max(2), f.min(2)
    with np.errstate(divide="ignore", invalid="ignore"):
        hue = np.where(hi == lo, 0, ((f[:, :, 0] - f[:, :, 1]) / np.maximum(hi - lo, 1e-6)) % 6) / 6
    magentaish = ((hue > 0.78) | (hue < 0.02)) & (hi > 0.55) & (f[:, :, 1] < 0.32)
    alpha[magentaish & (distance < 105)] = np.minimum(alpha[magentaish & (distance < 105)], distance[magentaish & (distance < 105)] / 105)
    return (255 * alpha).astype(np.uint8)


def scanline_matte(rgb: np.ndarray) -> np.ndarray:
    """White studio background sampled locally from the safe left/right edges."""
    edge = np.concatenate((rgb[:, :24], rgb[:, -24:]), axis=1)
    local = np.median(edge, axis=1).astype(np.float32)
    # A short smoothing window avoids a one-pixel JPEG/noise fringe becoming a matte.
    padded = np.pad(local, ((4, 4), (0, 0)), mode="edge")
    local = np.stack([np.median(padded[i:i+9], axis=0) for i in range(len(local))])
    return np.broadcast_to(local[:, None, :], rgb.shape)


def unmatte(rgb: np.ndarray, alpha: np.ndarray, matte: np.ndarray | tuple[int, int, int]) -> np.ndarray:
    """Remove the known solid background colour from partially antialiased pixels."""
    a = alpha.astype(np.float32)[..., None] / 255.0
    bg = np.asarray(matte, dtype=np.float32)
    result = np.where(a > 0, (rgb.astype(np.float32) - (1 - a) * bg) / np.maximum(a, 1 / 255), 0)
    return np.clip(result, 0, 255).astype(np.uint8)


def magenta_spill_count(rgb: np.ndarray, alpha: np.ndarray) -> int:
    """Purple is implausible on Gruia; count it only on semitransparent edge pixels."""
    edge = (alpha > 0) & (alpha < 250)
    spill = edge & (rgb[:, :, 2].astype(int) > rgb[:, :, 0].astype(int) + 18) & (rgb[:, :, 2].astype(int) > rgb[:, :, 1].astype(int) + 18)
    return int(spill.sum())


def despill_magenta(rgb: np.ndarray, alpha: np.ndarray) -> tuple[np.ndarray, int, int]:
    before = magenta_spill_count(rgb, alpha)
    result = rgb.copy()
    edge = (alpha > 0) & (alpha < 250)
    spill = edge & (result[:, :, 2].astype(int) > result[:, :, 0].astype(int) + 18) & (result[:, :, 2].astype(int) > result[:, :, 1].astype(int) + 18)
    result[:, :, 2][spill] = np.minimum(result[:, :, 2][spill], ((result[:, :, 0][spill].astype(int) + result[:, :, 1][spill].astype(int)) // 2)).astype(np.uint8)
    return result, before, magenta_spill_count(result, alpha)


def components(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    """Tiny 8-connected component finder; sheets are only 512px tiles."""
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    found: list[list[tuple[int, int]]] = []
    for y, x in zip(*np.where(mask & ~seen)):
        if seen[y, x]:
            continue
        stack, part = [(int(y), int(x))], []
        seen[y, x] = True
        while stack:
            yy, xx = stack.pop(); part.append((yy, xx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = yy + dy, xx + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; stack.append((ny, nx))
        found.append(part)
    return found


def remove_specks(alpha: np.ndarray) -> tuple[np.ndarray, int]:
    # Keep all meaningful detached art (e.g. a raised wing); only remove tiny key noise.
    clean, removed = alpha.copy(), 0
    for part in components(alpha > 30):
        if len(part) < 20:
            ys, xs = zip(*part); clean[list(ys), list(xs)] = 0; removed += len(part)
    return clean, removed


def bounds(alpha: np.ndarray, threshold: int = 20) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(alpha > threshold)
    if not len(xs): return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def shoe_center(image: np.ndarray) -> tuple[float, str]:
    a, rgb = image[:, :, 3], image[:, :, :3].astype(np.float32)
    lum = .2126 * rgb[:, :, 0] + .7152 * rgb[:, :, 1] + .0722 * rgb[:, :, 2]
    # Start below the body/leg junction: .82 keeps two adjacent shoes from merging.
    lower = np.indices(a.shape)[0] > int(a.shape[0] * .82)
    candidate = (a > 160) & (lum < 135) & lower
    parts = [part for part in components(candidate) if len(part) >= 12]
    # A shoe may be fragmented by highlights. Group touching / one-pixel-gapped ranges;
    # the two shoes can be only four pixels apart in these generated cells.
    groups: list[list[list[tuple[int, int]]]] = []
    for part in sorted(parts, key=lambda q: min(x for _, x in q)):
        xmin, xmax = min(x for _, x in part), max(x for _, x in part)
        if groups and xmin <= max(x for q in groups[-1] for _, x in q) + 1:
            groups[-1].append(part)
        else:
            groups.append([part])
    shoes = sorted(groups, key=lambda group: sum(map(len, group)), reverse=True)
    if len(shoes) >= 2:
        # Each dark shoe is a component in the lowest band; midpoint stops a big shoe
        # from pulling the root anchor away from the character's bilateral centre.
        selected = shoes[:2]
        return float(np.mean([np.median([x for part in group for _, x in part]) for group in selected])), "two-shoe-x-groups"
    xs = np.where(candidate)[1]
    if len(xs): return float(np.median(xs)), "dark-pixel-median-fallback"
    b = bounds(a)
    return ((b[0] + b[2]) / 2 if b else SIZE / 2), "silhouette-centre-fallback"


def support_center(image: np.ndarray) -> tuple[float, str]:
    """Tinta has no shoes: use the median support of its lowest opaque tentacles."""
    a = image[:, :, 3]
    lower = (a > 160) & (np.indices(a.shape)[0] > int(a.shape[0] * .78))
    xs = np.where(lower)[1]
    if len(xs): return float(np.median(xs)), "tentacle-support-median"
    b = bounds(a)
    return ((b[0] + b[2]) / 2 if b else SIZE / 2), "support-silhouette-centre-fallback"


def legacy_shoe_center(image: np.ndarray) -> float:
    """Pre-fix diagnostic only: records the unstable two-largest-components method."""
    a, rgb = image[:, :, 3], image[:, :, :3].astype(np.float32)
    lum = .2126 * rgb[:, :, 0] + .7152 * rgb[:, :, 1] + .0722 * rgb[:, :, 2]
    candidate = (a > 160) & (lum < 135) & (np.indices(a.shape)[0] > int(a.shape[0] * .76))
    parts = sorted((part for part in components(candidate) if len(part) >= 12), key=len, reverse=True)[:2]
    return float(np.mean([np.median([x for _, x in part]) for part in parts])) if len(parts) == 2 else float("nan")


def render_to_anchor(image: np.ndarray, scale: float, foot_x_override: float | None = None, vertical_offset: float = 0.0) -> tuple[np.ndarray, dict]:
    src = Image.fromarray(image, "RGBA")
    nw, nh = max(1, round(src.width * scale)), max(1, round(src.height * scale))
    scaled = rgba(src.resize((nw, nh), Image.Resampling.LANCZOS))
    b = bounds(scaled[:, :, 3])
    if not b: raise ValueError("sin primer plano después de chromakey")
    measured_x, shoe_method = support_center(scaled) if ANCHOR_MODE == "tinta-support" else shoe_center(scaled)
    foot_x = measured_x if foot_x_override is None else foot_x_override * scale
    if foot_x_override is not None: shoe_method = f"sheet-median/{shoe_method}"
    foot_y = b[3]
    left, top = round(ANCHOR[0] - foot_x), round(ANCHOR[1] - foot_y + vertical_offset)
    canvas = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    sx0, sy0, sx1, sy1 = max(0, -left), max(0, -top), min(nw, SIZE - left), min(nh, SIZE - top)
    dx0, dy0 = max(0, left), max(0, top)
    if sx1 > sx0 and sy1 > sy0:
        canvas[dy0:dy0 + sy1-sy0, dx0:dx0 + sx1-sx0] = scaled[sy0:sy1, sx0:sx1]
    # Ground is hard only at rest.  An explicitly configured motion offset
    # preserves a requested airborne beat instead of re-seating it at y=472.
    ground_limit = ANCHOR[1] if vertical_offset == 0 else SIZE - 1
    canvas[ground_limit + 1:, :, 3] = 0
    # Source tiles may have empty margins outside the 512 canvas; only flag lost art.
    clipped = b[0] + left < 0 or b[1] + top < 0 or b[2] + left >= SIZE or b[3] + top > ground_limit
    return canvas, {"scale": round(scale, 6), "sourceSize": [src.width, src.height], "resized": [nw, nh], "translation": [left, top], "shoeCenterSource": round(foot_x / scale, 2), "shoeCenterMeasuredSource": round(measured_x / scale, 2), "shoeCenterMethod": shoe_method, "anchor": list(ANCHOR), "motionOffsetY": round(vertical_offset, 2), "clipped": clipped}


def prepare_master() -> np.ndarray:
    if ANCHOR_MODE == "tinta-support":
        Image.open(SOURCE_MASTER).save(PACK / "ref/source-master.png")
    rgb = rgba(Image.open(SOURCE_MASTER))[:, :, :3]
    metal_edge_recovered = 0
    if ANCHOR_MODE == "tinta-support":
        # The wire handles deliberately contain transparent holes connected only by their contour.
        alpha, enclosed_filled = alpha_from_white_tinta(rgb), 0
        alpha, metal_edge_recovered = recover_tinta_metal_edges(rgb, alpha)
    else:
        alpha, enclosed_filled = fill_enclosed(alpha_from_white(rgb))
    b = bounds(alpha)
    if not b: raise ValueError("no se detectó la maestra")
    # The original art includes a fixed camera framing; one scale, no per-part resize.
    scale = TARGET_HEIGHT / (b[3] - b[1] + 1)
    base = np.dstack((unmatte(rgb, alpha, scanline_matte(rgb)), alpha))
    master, meta = render_to_anchor(base, scale)
    cleanup = {}
    if ANCHOR_MODE == "tinta-support":
        save(master, PACK / "evidence/master-before-alpha-cleanup.png")
        master, cleanup = clean_tinta_master_residuals(master)
        cleanup["metalEdgePixelsRecoveredFromSource"] = metal_edge_recovered
        cleanup["metalEdgeRepair"] = "upper dark-core 2px band; handle holes excluded by luminance"
        write_tinta_alpha_crop(master)
    # Preserve 64px crest margin exactly when the conservative foreground mask permits it.
    save(master, PACK / "ref/master.png")
    chroma = Image.new("RGBA", (SIZE, SIZE), (255, 0, 255, 255))
    chroma.alpha_composite(Image.fromarray(master, "RGBA"))
    chroma.save(PACK / "ref/master-chroma.png")
    metrics = {"source": str(SOURCE_MASTER), "bbox": b, "targetHeight": TARGET_HEIGHT, "enclosedPixelsFilled": enclosed_filled, "transform": meta, "cleanup": cleanup}
    (PACK / "ref/master-metrics.json").write_text(json.dumps(metrics, indent=2) + "\n")
    if ANCHOR_MODE == "tinta-support": (PACK / "evidence/master-alpha-cleanup.json").write_text(json.dumps(metrics, indent=2) + "\n")
    return master


def lab(rgb: np.ndarray) -> np.ndarray:
    x = rgb.astype(np.float64) / 255.0
    x = np.where(x <= .04045, x / 12.92, ((x + .055) / 1.055) ** 2.4)
    xyz = x @ np.array([[.4124564, .3575761, .1804375], [.2126729, .7151522, .072175], [.0193339, .119192, .9503041]]).T
    xyz /= np.array([.95047, 1., 1.08883])
    xyz = np.where(xyz > .008856, xyz ** (1/3), 7.787 * xyz + 16/116)
    return np.stack((116 * xyz[..., 1] - 16, 500 * (xyz[..., 0] - xyz[..., 1]), 200 * (xyz[..., 1] - xyz[..., 2])), -1)


def palette_from_master(master: np.ndarray, n: int = 32) -> list[list[int]]:
    pixels = master[master[:, :, 3] > 220, :3]
    bins = (pixels // 16).astype(np.uint8)
    common = Counter(map(tuple, bins)).most_common(n)
    result = []
    for bin_, _ in common:
        selected = pixels[(bins == bin_).all(1)]
        result.append(np.median(selected, axis=0).astype(int).tolist())
    return result


def palette_delta(image: np.ndarray, palette: list[list[int]]) -> float:
    pixels = image[image[:, :, 3] > 220, :3]
    if not len(pixels): return float("inf")
    sample = pixels[::max(1, len(pixels)//8000)]
    distances = np.linalg.norm(lab(sample)[:, None, :] - lab(np.array(palette))[None, :, :], axis=2)
    return float(distances.min(1).mean())


def clear_configured_grid(raw: np.ndarray, native: np.ndarray | None, emotion: str) -> tuple[np.ndarray, np.ndarray | None, dict | None]:
    """Remove a reviewed-empty 4x2 sheet border band before crop and scaling."""
    rule = CONFIG.get("gridBorderCleanup", {}).get(emotion)
    if not rule:
        return raw, native, None
    height, width = raw.shape[:2]
    band = int(rule.get("bandPx", 3))
    boundary = np.zeros((height, width), dtype=bool)
    for x in (0, round(width / 4), round(width / 2), round(3 * width / 4), width - 1):
        boundary[:, max(0, x - band):min(width, x + band + 1)] = True
    for y in (0, round(height / 2), height - 1):
        boundary[max(0, y - band):min(height, y + band + 1), :] = True
    cleaned = raw.copy(); cleaned[boundary] = (255, 0, 255)
    cleaned_native = None if native is None else native.copy()
    if cleaned_native is not None: cleaned_native[boundary, 3] = 0
    return cleaned, cleaned_native, {"mode": "configured-grid-border-cleanup", "bandPx": band, "removedPixels": int(boundary.sum()), "source": rule.get("source"), "verifiedEmptyMarginPx": rule.get("verifiedEmptyMarginPx")}


def recheck_palette_only(master: np.ndarray) -> None:
    """Refresh palette metrics from existing PNGs without touching their geometry."""
    metrics_path = PACK / "evidence/metrics.json"
    if not metrics_path.exists():
        raise SystemExit("no hay metrics.json para reevaluar la paleta")
    evidence = json.loads(metrics_path.read_text())
    palette = palette_from_master(master)
    for emotion, result in evidence.get("emotions", {}).items():
        frame_deltas = []
        for frame in result.get("frames", []):
            image = rgba(Image.open(PACK / frame["src"]))
            delta = round(palette_delta(image, palette), 3)
            frame["paletteDeltaE"] = delta
            frame["flags"] = [flag for flag in frame.get("flags", []) if flag != "salto_palette"]
            if delta > 8: frame["flags"].append("salto_palette")
            frame_deltas.append(delta)
        result["paletteDeltaEMean"] = round(float(np.mean(frame_deltas)), 3)
        manual = result.get("manualFlags", [])
        result["flags"] = sorted({flag for frame in result.get("frames", []) for flag in frame.get("flags", [])} | set(manual))
    evidence["generatedAt"] = datetime.now(timezone.utc).isoformat()
    evidence["palette"] = ["#%02X%02X%02X" % tuple(c) for c in palette]
    metrics_path.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n")
    write_pack(evidence["emotions"], palette)
    write_qc(evidence["emotions"])
    print("palette rechecked from existing frames; PNG geometry unchanged")


def iou(a: np.ndarray, b: np.ndarray) -> float:
    a, b = a[:, :, 3] > 30, b[:, :, 3] > 30
    union = np.logical_or(a, b).sum()
    return float(np.logical_and(a, b).sum() / union) if union else 1.0


def crop_sheet(path: Path) -> list[tuple[np.ndarray, int, dict]]:
    sheet = Image.open(path).convert("RGB")
    emotion = path.stem.removesuffix("_raw")
    native_path = PACK / "evidence" / f"{emotion}_imagegen_original.png"
    native = Image.open(native_path).convert("RGBA") if native_path.exists() else None
    if native is not None and native.size != sheet.size:
        native = None
    raw_sheet = rgba(sheet)[:, :, :3]
    native_array = rgba(native) if native is not None else None
    raw_sheet, native_array, preprocessing = clear_configured_grid(raw_sheet, native_array, emotion)
    frames = []
    for row in range(2):
        for col in range(4):
            # Image generation may return arbitrary dimensions; round boundaries avoid gaps.
            left, right = round(col * sheet.width / 4), round((col + 1) * sheet.width / 4)
            top, bottom = round(row * sheet.height / 2), round((row + 1) * sheet.height / 2)
            raw_rgb = raw_sheet[top:bottom, left:right]
            chroma_alpha = alpha_from_magenta(raw_rgb)
            if native_array is not None:
                native_frame = native_array[top:bottom, left:right]
                rgb, alpha = native_frame[:, :, :3], native_frame[:, :, 3]
                extraction = {"mode": "native-alpha-validated-against-chroma", "alphaMaeVsChroma": round(float(np.abs(alpha.astype(np.int16) - chroma_alpha.astype(np.int16)).mean()), 3), "preprocessing": preprocessing}
            else:
                rgb, alpha = unmatte(raw_rgb, chroma_alpha, (255, 0, 255)), chroma_alpha
                extraction = {"mode": "chroma-fallback", "alphaMaeVsChroma": 0.0, "preprocessing": preprocessing}
            alpha, removed = remove_specks(alpha)
            rgb, spill_before, spill_residual = despill_magenta(rgb, alpha)
            extraction.update({"magentaSpillBefore": spill_before, "magentaSpillResidual": spill_residual})
            frames.append((np.dstack((rgb, alpha)), removed, extraction))
    return frames


def contact(frames: list[np.ndarray], path: Path, columns: int = 4) -> None:
    thumb, rows = 128, math.ceil(len(frames) / columns)
    out = Image.new("RGBA", (columns*thumb, rows*thumb), (235, 235, 235, 255))
    for i, frame in enumerate(frames):
        im = Image.fromarray(frame, "RGBA").resize((thumb, thumb), Image.Resampling.LANCZOS)
        out.alpha_composite(im, ((i % columns)*thumb, (i // columns)*thumb))
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path)


def refresh_global_contact() -> None:
    """Rebuild the all-frame contact from final PNGs without reprocessing sheets."""
    frames = []
    for emotion in EMOTIONS:
        paths = [PACK / emotion / f"{i:03d}.png" for i in range(8)]
        if any(not path.exists() for path in paths):
            raise SystemExit(f"faltan PNG finales para contact: {emotion}")
        frames.extend(rgba(Image.open(path)) for path in paths)
    contact(frames, PACK / "previews/contact-sheet.png", columns=4)
    print("contact-sheet rebuilt from existing PNG frames")


def gif(frames: list[np.ndarray], path: Path, fps: int, pingpong: bool = False, once: bool = False, hold_last_ms: int | None = None) -> None:
    sequence = frames + frames[-2:0:-1] if pingpong else frames
    samples = []
    for frame in sequence:
        opaque = frame[frame[:, :, 3] > 0, :3]
        if len(opaque): samples.append(opaque[::max(1, len(opaque)//6000)])
    source = Image.fromarray(np.concatenate(samples).reshape(1, -1, 3), "RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    palette = source.getpalette()[:765]
    shifted_palette = [0, 0, 0] + palette
    ims = []
    for frame in sequence:
        indexed = Image.fromarray(frame[:, :, :3], "RGB").quantize(palette=source, dither=Image.Dither.NONE)
        data = np.asarray(indexed, dtype=np.uint16) + 1
        data[frame[:, :, 3] == 0] = 0
        out = Image.fromarray(data.astype(np.uint8), "P"); out.putpalette(shifted_palette)
        ims.append(out)
    durations = [round(1000/fps)] * len(ims)
    if hold_last_ms is not None: durations[-1] = hold_last_ms
    options = {} if once else {"loop": 0}
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=durations, disposal=2, transparency=0, include_color_table=True, **options)


def idle_procedural(master: np.ndarray) -> list[tuple[np.ndarray, int, dict]]:
    frames = []
    for i in range(8):
        factor = 1 + .02 * math.sin(2 * math.pi * i / 8)
        image = Image.fromarray(master, "RGBA")
        height = round(SIZE * factor)
        squashed = rgba(image.resize((SIZE, height), Image.Resampling.LANCZOS))
        frame = np.zeros_like(master); y = ANCHOR[1] - round(ANCHOR[1] * factor)
        sy0, sy1 = max(0, -y), min(height, SIZE-y)
        if sy1 > sy0: frame[max(0,y):max(0,y)+sy1-sy0] = squashed[sy0:sy1]
        frames.append((frame, 0, {"mode": "procedural", "alphaMaeVsChroma": None, "magentaSpillBefore": 0, "magentaSpillResidual": 0}))
    return frames


def procedural_nudge() -> list[tuple[np.ndarray, int, dict]]:
    """Wave-based fallback: two rigid taps and explicitly preserved airborne beats."""
    source_rel = CONFIG.get("procedural", {}).get("nudge", {}).get("source", "idle/000.png")
    base = rgba(Image.open(PACK / source_rel))
    # Full-sprite transforms only.  Lift is intentional (20–30 px at each
    # tap), recorded below so later processing never silently grounds it.
    moves = CONFIG.get("procedural", {}).get("nudge", {}).get("fallbackFrames", [
        {"angle": 0, "scale": 1.00, "lift": 0, "phase": "rest"},
        {"angle": -5, "scale": 1.02, "lift": 8, "phase": "lean-1"},
        {"angle": -12, "scale": 1.08, "lift": 25, "phase": "tap-1"},
        {"angle": -3, "scale": 1.03, "lift": 7, "phase": "return-1"},
        {"angle": 5, "scale": 1.02, "lift": 8, "phase": "lean-2"},
        {"angle": 12, "scale": 1.08, "lift": 25, "phase": "tap-2"},
        {"angle": 3, "scale": 1.03, "lift": 7, "phase": "return-2"},
        {"angle": 0, "scale": 1.00, "lift": 0, "phase": "rest"},
    ])
    frames = []
    for move in moves:
        angle, squash, lift, phase = move["angle"], move["scale"], move["lift"], move["phase"]
        resized = Image.fromarray(base, "RGBA").resize((SIZE, round(SIZE * squash)), Image.Resampling.LANCZOS)
        stage = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        stage.alpha_composite(resized, (0, ANCHOR[1] - round(ANCHOR[1] * squash)))
        stage = stage.rotate(angle, resample=Image.Resampling.BICUBIC, center=ANCHOR)
        turned = rgba(stage).copy(); b = bounds(turned[:, :, 3])
        # Re-seat only to the declared lift, never to a universal ground line.
        frame = np.zeros_like(turned); shift = ANCHOR[1] - b[3] - lift
        sy0, sy1 = max(0, -shift), min(SIZE, SIZE - shift)
        if sy1 > sy0: frame[max(0, shift):max(0, shift) + sy1-sy0] = turned[sy0:sy1]
        if lift == 0: frame[ANCHOR[1] + 1:, :, 3] = 0
        frames.append((frame, 0, {"mode": "procedural-rigid-sprite", "source": source_rel, "rawDisposition": "unused", "transform": {"phase": phase, "rotationDeg": angle, "scale": squash, "motionOffsetY": -lift, "groundException": lift > 0}, "alphaMaeVsChroma": None, "magentaSpillBefore": 0, "magentaSpillResidual": 0}))
    return frames


def process_emotion(emotion: str, raw: Path, master: np.ndarray, palette: list[list[int]], origin: str) -> tuple[list[np.ndarray], dict]:
    source = procedural_nudge() if emotion == "nudge" and origin == "procedural" else (idle_procedural(master) if origin == "procedural" else crop_sheet(raw))
    heights = [bounds(f[:, :, 3])[3] - bounds(f[:, :, 3])[1] + 1 for f, _, _ in source if bounds(f[:, :, 3])]
    if not heights: raise ValueError(f"{emotion}: sin personaje detectado")
    canonical_procedural = emotion == "nudge" and origin == "procedural"
    scale = 1.0 if canonical_procedural else TARGET_HEIGHT / float(np.median(heights))
    # Only an explicit pose exception (the one-foot stomp) uses a sheet camera base.
    base_centres = [(support_center(f)[0] if ANCHOR_MODE == "tinta-support" else shoe_center(f)[0]) for f, _, _ in source]
    camera_anchor_x = float(np.median(base_centres))
    sheet_anchor = emotion in set(CONFIG.get("sheetAnchorEmotions", ["annoyed"]))
    motion = CONFIG.get("motionOffsetEmotions", {}).get(emotion)
    rest_bottom = bounds(source[0][0][:, :, 3])[3] if motion and bounds(source[0][0][:, :, 3]) else None
    output, frames, previous = [], [], None
    master_area = int((master[:, :, 3] > 30).sum())
    for i, (frame, specks_removed, extraction) in enumerate(source):
        if canonical_procedural:
            rendered = frame.copy()
            transform = {"scale": 1.0, "sourceSize": [SIZE, SIZE], "resized": [SIZE, SIZE], "translation": [0, 0], "shoeCenterSource": ANCHOR[0], "shoeCenterMeasuredSource": shoe_center(frame)[0], "shoeCenterMethod": "source-idle-fixed", "anchor": list(ANCHOR), "clipped": False}
        else:
            bottom = bounds(frame[:, :, 3])[3] if rest_bottom is not None and bounds(frame[:, :, 3]) else rest_bottom
            # Negative means an airborne root: source camera motion stays visible.
            motion_y = (bottom - rest_bottom) * scale if rest_bottom is not None else 0.0
            rendered, transform = render_to_anchor(frame, scale, foot_x_override=camera_anchor_x if sheet_anchor else None, vertical_offset=motion_y)
        # Rotation can introduce isolated 1px alpha crumbs; remove before measuring residue.
        clean_alpha, rendered_specks_removed = remove_specks(rendered[:, :, 3])
        rendered[:, :, 3] = clean_alpha
        delta = palette_delta(rendered, palette)
        loop_iou = iou(rendered, previous) if previous is not None else None
        flags = []
        if delta > 8: flags.append("salto_palette")
        if transform["clipped"]: flags.append("clipping")
        if (rendered[:, :, 3] > 30).sum() > master_area * 2.7 or (rendered[:, :, 3] > 30).sum() < master_area * .30: flags.append("mismatch_master")
        _, specks_residual = remove_specks(rendered[:, :, 3])
        if specks_residual: flags.append("foreground_espurio")
        output.append(rendered); previous = rendered
        frames.append({"index": i, "src": f"{emotion}/{i:03d}.png", "origin": origin, "paletteDeltaE": round(delta, 3), "silhouetteIoUPrevious": None if loop_iou is None else round(loop_iou, 4), "specksRemoved": specks_removed + rendered_specks_removed, "specksResidual": specks_residual, "extraction": extraction, "flags": flags, "transform": transform})
    close_iou = iou(output[0], output[-1])
    threshold = .80 if emotion == "idle" else .65
    for item in frames:
        comparable = close_iou if item["index"] == 0 else item["silhouetteIoUPrevious"]
        if comparable is not None and comparable < threshold: item["flags"].append("salto_silueta")
    manual_flags = CONFIG.get("manualFlags", {}).get(emotion, [])
    anchor_x_mode = "source-idle-fixed" if canonical_procedural else ("sheet-camera" if sheet_anchor else ("per-frame-support" if ANCHOR_MODE == "tinta-support" else "per-frame-shoes"))
    return output, {"frames": frames, "paletteDeltaEMean": round(float(np.mean([f["paletteDeltaE"] for f in frames])), 3), "silhouetteIoUMin": round(min([close_iou] + [f["silhouetteIoUPrevious"] for f in frames[1:]]), 4), "loopIoU": round(close_iou, 4), "flags": sorted({flag for f in frames for flag in f["flags"]} | set(manual_flags)), "manualFlags": manual_flags, "scale": round(scale, 6), "anchorXMode": anchor_x_mode, "cameraAnchorXSource": ANCHOR[0] if canonical_procedural else round(camera_anchor_x, 2)}


def merge_partial_result(existing: dict, fresh: dict, emotion: str, indexes: set[int], palette: list[list[int]]) -> tuple[list[np.ndarray], dict]:
    """Merge a one/two-frame retouch, leaving the other six PNGs untouched."""
    if emotion not in existing:
        raise SystemExit(f"no hay métricas previas para retoque parcial: {emotion}")
    result = json.loads(json.dumps(existing[emotion]))
    for i in indexes: result["frames"][i] = fresh["frames"][i]
    images = [rgba(Image.open(PACK / emotion / f"{i:03d}.png")) for i in range(8)]
    threshold = .80 if emotion == "idle" else .65
    for i, (image, frame) in enumerate(zip(images, result["frames"])):
        delta = round(palette_delta(image, palette), 3)
        frame["paletteDeltaE"] = delta
        flags = set(frame.get("flags", [])) - {"salto_palette", "salto_silueta"}
        if delta > 8: flags.add("salto_palette")
        if i:
            frame["silhouetteIoUPrevious"] = round(iou(image, images[i - 1]), 4)
            if frame["silhouetteIoUPrevious"] < threshold: flags.add("salto_silueta")
        else:
            frame["silhouetteIoUPrevious"] = None
        frame["flags"] = sorted(flags)
    loop = round(iou(images[0], images[-1]), 4)
    if loop < threshold: result["frames"][-1]["flags"] = sorted(set(result["frames"][-1]["flags"]) | {"salto_silueta"})
    result["paletteDeltaEMean"] = round(float(np.mean([f["paletteDeltaE"] for f in result["frames"]])), 3)
    result["loopIoU"] = loop
    result["silhouetteIoUMin"] = round(min([loop] + [f["silhouetteIoUPrevious"] for f in result["frames"][1:]]), 4)
    result["flags"] = sorted({flag for f in result["frames"] for flag in f["flags"]} | set(result.get("manualFlags", [])))
    for key in ("scale", "anchorXMode", "cameraAnchorXSource"):
        result[key] = fresh[key]
    return images, result


def write_pack(results: dict, palette: list[list[int]]) -> None:
    palette_hex = ["#%02X%02X%02X" % tuple(c) for c in palette]
    old_emotions = json.loads((PACK / "pack.json").read_text()).get("emotions", {}) if (PACK / "pack.json").exists() else {}
    emotions = {}
    for emotion, result in results.items():
        old = old_emotions.get(emotion, {})
        frames = [{**(old.get("frames", [])[i] if i < len(old.get("frames", [])) else {}), "src": f["src"], "origin": f["origin"], "note": ", ".join(f["flags"])} for i, f in enumerate(result["frames"])]
        frames = [{**frame, "ms": 1000 if emotion == "triumph" and i == 7 else frame.get("ms")} for i, frame in enumerate(frames)]
        generated = {"label": LABELS[emotion], "engine": "raster-frames", "fps": 8 if emotion == "idle" else 10, "playback": "pingpong" if emotion == "idle" else ("once" if emotion == "triumph" else "loop"), "frames": frames}
        emotions[emotion] = {**old, **generated}
        if emotion == "triumph": emotions[emotion].update({"base": "joy", "oneShot": True, "usage": "celebrar un logro"})
    pack = {"schema": "gruia.character-pack/1", "id": CONFIG["id"], "name": CONFIG["name"], "brand": CONFIG["brand"], "canvas": {"w": SIZE, "h": SIZE}, "anchor": {"x": ANCHOR[0], "y": ANCHOR[1]}, "palette": palette_hex, "reference": "ref/master.png", "defaults": {"engine": "raster-frames", "fps": 10, "playback": "loop"}, "emotions": emotions, "qc": {key: {"paletteDeltaE": value["paletteDeltaEMean"], "silhouetteIoUMin": value["silhouetteIoUMin"], "flags": value["flags"]} for key, value in results.items()}}
    (PACK / "pack.json").write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n")


def write_qc(results: dict) -> None:
    lines = [f"# QC — {CONFIG['id']}", "", "**Definiciones.** ΔE es CIE76 medio de píxeles opacos frente al color más cercano de la paleta de 32 muestras de `ref/master.png`; se marca `salto_palette` sobre 8. La silueta es IoU binario entre frames consecutivos y el cierre del loop: se marca `salto_silueta` bajo 0.80 en idle y bajo 0.65 en las demás emociones.", "", "Las métricas son heurísticas: no certifican la topología ni la legibilidad del gesto. La escala es única por hoja (mediana de alturas), por lo que una pose extrema puede disparar IoU sin ser un defecto. `specksRemoved` cuenta ruido aislado encontrado en el original; no debe confundirse con `specksResidual`, que es el ruido que sobrevivió al procesamiento.", "", "| emoción | ΔE medio | IoU mínimo | flags |", "|---|---:|---:|---|"]
    lines += [f"| {e} | {r['paletteDeltaEMean']:.3f} | {r['silhouetteIoUMin']:.4f} | {', '.join(r['flags']) or '—'} |" for e, r in results.items()]
    procedural = [emotion for emotion, result in results.items() if any(frame["origin"] == "procedural" for frame in result["frames"])]
    if procedural: lines += ["", f"**Procedural:** {', '.join(procedural)} usa la configuración persistente del pack; sus fuentes y transformaciones por frame figuran en `metrics.json`."]
    (PACK / "qc.md").write_text("\n".join(lines) + "\n")


def write_diagnostics(results: dict, raw_paths: dict[str, Path], previous: dict | None = None) -> None:
    sad_before = []
    if "sad" in results and raw_paths["sad"].exists():
        sad_before = [round(legacy_shoe_center(frame), 2) for frame, _, _ in crop_sheet(raw_paths["sad"])]
    extraction = {
        emotion: {
            "modes": sorted({frame["extraction"]["mode"] for frame in result["frames"]}),
            "magentaSpillBefore": sum(frame["extraction"]["magentaSpillBefore"] for frame in result["frames"]),
            "magentaSpillResidual": sum(frame["extraction"]["magentaSpillResidual"] for frame in result["frames"]),
            "specksRemoved": sum(frame["specksRemoved"] for frame in result["frames"]),
            "specksResidual": sum(frame["specksResidual"] for frame in result["frames"]),
        } for emotion, result in results.items()
    }
    payload = {
        "sadAnchorBefore": {"method": "legacy-two-largest-components-at-lower-76pct", "centres": sad_before},
        "sadAnchorAfter": {"method": "two-shoe-x-groups-at-lower-78pct", "centres": [frame["transform"]["shoeCenterSource"] for frame in results.get("sad", {}).get("frames", [])]},
        "extractionResiduals": extraction,
        "anchorBeforeAfter": {
            emotion: {
                "before": {"measuredCentres": [frame["transform"].get("shoeCenterMeasuredSource") for frame in previous.get(emotion, {}).get("frames", [])], "translations": [frame["transform"].get("translation") for frame in previous.get(emotion, {}).get("frames", [])]},
                "after": {"measuredCentres": [frame["transform"].get("shoeCenterMeasuredSource") for frame in result["frames"]], "translations": [frame["transform"].get("translation") for frame in result["frames"]], "anchorXMode": result.get("anchorXMode")},
            } for emotion, result in results.items() if previous and emotion in previous
        },
    }
    (PACK / "evidence/anchor-and-extraction-diagnostic.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def write_alpha_review(master: np.ndarray) -> None:
    """Human readback: the master and idle on both polar backgrounds."""
    idle_path = PACK / "idle/000.png"
    idle = rgba(Image.open(idle_path)) if idle_path.exists() else master
    cases = (("master / claro", master, (245, 245, 245, 255)), ("master / oscuro", master, (18, 18, 18, 255)), ("idle / claro", idle, (245, 245, 245, 255)), ("idle / oscuro", idle, (18, 18, 18, 255)))
    review = Image.new("RGBA", (1024, 1024), (0, 0, 0, 255)); draw = ImageDraw.Draw(review)
    for i, (label, frame, background) in enumerate(cases):
        x, y = (i % 2) * SIZE, (i // 2) * SIZE
        panel = Image.new("RGBA", (SIZE, SIZE), background)
        panel.alpha_composite(Image.fromarray(frame, "RGBA"))
        review.alpha_composite(panel, (x, y))
        draw.text((x + 12, y + 12), label, fill=(20, 20, 20, 255) if background[0] > 100 else (240, 240, 240, 255), font=ImageFont.load_default())
    review.save(PACK / "evidence/alpha-review-after.png")


def self_check() -> None:
    synthetic = np.full((512, 512, 3), (255, 0, 255), np.uint8)
    synthetic[100:400, 180:330] = (230, 105, 18)
    synthetic[380:410, 205:305] = (30, 25, 20)
    alpha = alpha_from_magenta(synthetic)
    assert alpha[0, 0] == 0 and alpha[200, 250] > 240, "chroma no separa fondo/arte"
    white = np.full((32, 32, 3), 245, np.uint8); white[10:14, 10:14] = (90, 85, 81); white[14:18, 10:14] = (98, 93, 86); white[18:22, 10:14] = (112, 102, 93); white[10:22, 18:22] = (18, 18, 18)
    a_white = alpha_from_white(white)
    assert np.all(a_white[10:22, 10:14] == 255) and np.all(a_white[10:22, 18:22] == 255) and a_white[0, 0] == 0, "gris accesorio/fondo mal separado"
    metal = np.full((16, 16, 3), 245, np.uint8); metal[7, 7] = (28, 28, 28); metal[7, 8] = (155, 155, 155)
    metal_alpha = alpha_from_white_tinta(metal); repaired, _ = recover_tinta_metal_edges(metal, metal_alpha)
    assert repaired[7, 8] > metal_alpha[7, 8] and repaired[0, 0] == 0, "borde metal/hueco blanco mal separado"
    ring = np.zeros((9, 9), np.uint8); ring[1:8, 1:8] = 255; ring[3:6, 3:6] = 0
    filled, count = fill_enclosed(ring)
    assert count == 9 and np.all(filled[3:6, 3:6] == 255), "interior cerrado no recuperado"
    rendered, meta = render_to_anchor(np.dstack((synthetic, alpha)), 1.0)
    assert rendered.shape == (512, 512, 4) and meta["anchor"] == [256, 472], "canvas/ancla inválidos"
    assert bounds(rendered[:, :, 3])[3] == 472, "pies no están sobre anchor.y"
    print("self-check: ok (chroma, negro neutro, 512x512, anchor y=472)")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--prepare-master", action="store_true")
    p.add_argument("--reuse-master", action="store_true", help="usa ref/master.png aprobada sin volver a procesar la fuente")
    p.add_argument("--review-alpha", action="store_true", help="actualiza solo master y evidencia claro/oscuro")
    p.add_argument("--recheck-palette", action="store_true", help="recalcula ΔE de PNG existentes, sin regenerar frames")
    p.add_argument("--refresh-contact", action="store_true", help="reconstruye contact-sheet desde los PNG finales, sin procesar raws")
    p.add_argument("--self-check", action="store_true")
    p.add_argument("--idle-procedural", action="store_true", help="usa squash 1–3%% de master si falta idle_raw.png")
    p.add_argument("--all", action="store_true", help="exige todas las hojas 4x2")
    p.add_argument("--emotions", nargs="+", choices=EMOTIONS, help="procesa solo estas emociones y conserva las demás")
    p.add_argument("--frames", help="retoque de 1–2 frames, formato emocion:indice,indice; conserva los otros seis PNG")
    args = p.parse_args()
    if args.self_check: self_check(); return
    if args.refresh_contact: refresh_global_contact(); return
    if args.reuse_master:
        master_path = PACK / "ref/master.png"
        if not master_path.exists(): raise SystemExit(f"falta maestra aprobada: {master_path}")
        master = rgba(Image.open(master_path))
        if master.shape != (SIZE, SIZE, 4): raise SystemExit("ref/master.png debe ser RGBA 512x512")
    else:
        master = prepare_master()
    if args.prepare_master: return
    if args.review_alpha: write_alpha_review(master); return
    if args.recheck_palette: recheck_palette_only(master); return
    partial: dict[str, set[int]] = {}
    if args.frames:
        if args.emotions or args.all:
            raise SystemExit("--frames no se combina con --emotions ni --all")
        try:
            emotion, values = args.frames.split(":", 1)
            indexes = {int(value) for value in values.split(",")}
        except ValueError as exc:
            raise SystemExit("--frames usa emocion:0,1") from exc
        if emotion not in EMOTIONS or not 1 <= len(indexes) <= 2 or any(i < 0 or i > 7 for i in indexes):
            raise SystemExit("--frames admite una emoción y uno o dos índices 0..7")
        partial[emotion] = indexes
    palette = palette_from_master(master)
    raw_paths = {e: PACK / "sheets" / f"{e}_raw.png" for e in EMOTIONS}
    present = [e for e, path in raw_paths.items() if path.exists()]
    procedural_config = set(CONFIG.get("procedural", {}))
    required = [e for e in EMOTIONS if e not in procedural_config and (e != "idle" or not args.idle_procedural)]
    if args.all and any(not raw_paths[e].exists() for e in required):
        missing = ", ".join(e for e in required if not raw_paths[e].exists()); raise SystemExit(f"faltan hojas: {missing}")
    if not present and not args.idle_procedural and not procedural_config:
        print("master preparado; no hay hojas raw para procesar"); return
    if (PACK / "evidence/metrics.json").exists():
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        shutil.copy2(PACK / "evidence/metrics.json", PACK / f"evidence/metrics.previous-{stamp}.json")
    previous = json.loads((PACK / "evidence/metrics.json").read_text()).get("emotions", {}) if (PACK / "evidence/metrics.json").exists() else {}
    results, all_preview = dict(previous), []
    selected = set(partial) if partial else (set(args.emotions) if args.emotions else set(EMOTIONS))
    to_process = [e for e in EMOTIONS if e in selected and ((e in procedural_config) or (e in present and not (e == "idle" and args.idle_procedural)) or (e == "idle" and args.idle_procedural))]
    for emotion in to_process:
        origin = "procedural" if emotion in procedural_config or (emotion == "idle" and args.idle_procedural) else "gen"
        frames, result = process_emotion(emotion, raw_paths[emotion], master, palette, origin)
        out = PACK / emotion; out.mkdir(exist_ok=True)
        write_indexes = partial.get(emotion, set(range(8)))
        for i in write_indexes: save(frames[i], out / f"{i:03d}.png")
        if emotion in partial:
            final_frames, result = merge_partial_result(previous, result, emotion, write_indexes, palette)
        else:
            final_frames = frames
        contact(final_frames, PACK / f"previews/{emotion}_contact.png")
        gif(final_frames, PACK / f"previews/{emotion}.gif", 8 if emotion == "idle" else 10, pingpong=emotion == "idle", once=emotion == "triumph", hold_last_ms=1000 if emotion == "triumph" else None)
        results[emotion], all_preview = result, all_preview + final_frames
    if set(to_process) == set(EMOTIONS): contact(all_preview, PACK / "previews/contact-sheet.png", columns=4)
    evidence = {"generatedAt": datetime.now(timezone.utc).isoformat(), "master": "ref/master.png", "palette": ["#%02X%02X%02X" % tuple(c) for c in palette], "emotions": results}
    (PACK / "evidence/metrics.json").write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + "\n")
    write_pack(results, palette); write_qc(results); write_diagnostics(results, raw_paths, previous); write_alpha_review(master)
    print("processed: " + ", ".join(results))


if __name__ == "__main__": main()
