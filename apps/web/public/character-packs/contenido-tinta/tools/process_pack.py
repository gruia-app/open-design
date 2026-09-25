#!/usr/bin/env python3
"""Run the shared character-pack processor with Tinta's local configuration."""
import os
import sys
from pathlib import Path

PACK = Path(__file__).resolve().parents[1]
GUI_TOOLS = Path("/home/roberto/.t3/userdata/leaders-20260923/personajes/packs/gruia-grulla/tools")
os.environ["CHARACTER_PACK_ROOT"] = str(PACK)
sys.path.insert(0, str(GUI_TOOLS))

from process_pack import main

if __name__ == "__main__":
    main()
