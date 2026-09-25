#!/usr/bin/env python3
"""Build a labeled joy/triumph contact and its per-frame comparison metrics."""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import numpy as np

PACK = Path(__file__).resolve().parents[1]
GUI_TOOLS = PACK.parent / "gruia-grulla" / "tools"
import sys
sys.path.insert(0, str(GUI_TOOLS))
import process_pack as pipeline


def main() -> None:
    master = pipeline.rgba(Image.open(PACK / "ref/master.png"))
    palette = pipeline.palette_from_master(master)
    groups = {}
    for emotion in ("joy", "triumph"):
        groups[emotion] = [pipeline.rgba(Image.open(PACK / emotion / f"{i:03d}.png")) for i in range(8)]
    out = Image.new("RGBA", (512, 576), (238, 238, 238, 255)); draw = ImageDraw.Draw(out); font = ImageFont.load_default()
    for label, emotion, y in (("joy", "joy", 20), ("triumph", "triumph", 298)):
        draw.text((8,y),label,fill=(20,20,20,255),font=font); y+=20
        for i, frame in enumerate(groups[emotion]):
            tile=Image.fromarray(frame,"RGBA").resize((128,128),Image.Resampling.LANCZOS)
            out.alpha_composite(tile,((i%4)*128,y+(i//4)*128))
    out.save(PACK / "previews/triumph-vs-joy.png")
    details={}
    for emotion, frames in groups.items():
        deltas=[]; heights=[]; hashes=[]
        for i, frame in enumerate(frames):
            deltas.append(round(pipeline.palette_delta(frame,palette),3))
            box=pipeline.bounds(frame[:,:,3]); heights.append(None if box is None else box[3]-box[1]+1)
            hashes.append(hashlib.sha256((PACK/emotion/f"{i:03d}.png").read_bytes()).hexdigest())
        details[emotion]={"paletteDeltaEByFrame":deltas,"bboxHeightByFrame":heights,"sha256ByFrame":hashes}
    (PACK / "evidence/triumph-joy-comparison.json").write_text(json.dumps(details,indent=2,ensure_ascii=False)+"\n")
    print(PACK / "previews/triumph-vs-joy.png")


if __name__ == "__main__": main()
