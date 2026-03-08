"""
Generates butterfly icons at 16, 32, 48, and 128px for the Flee Autofill Chrome Extension.
Requires Pillow: pip install pillow
"""

import os
import math
from PIL import Image, ImageDraw

SIZES = [16, 32, 48, 128]
OUT_DIR = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT_DIR, exist_ok=True)

# Colour palette
BODY_DARK   = (21,  101, 192, 255)   # #1565C0  deep blue
WING_OUTER  = (30,  136, 229, 255)   # #1E88E5  mid blue
WING_INNER  = (100, 181, 246, 255)   # #64B5F6  light blue
WING_SPOT   = (227, 242, 253, 200)   # #E3F2FD  pale blue, semi-transparent
ANTENNAE    = (13,  71,  161, 255)   # #0D47A1  darkest blue


def draw_butterfly(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d   = ImageDraw.Draw(img)

    cx, cy = size / 2, size / 2

    # ------------------------------------------------------------------
    # Scale helpers
    # ------------------------------------------------------------------
    def s(v: float) -> float:
        """Scale a unit value (fraction of canvas size)."""
        return v * size

    # ------------------------------------------------------------------
    # Wings — four ellipses arranged around the body centre
    # Upper wings are larger; lower wings are smaller
    # ------------------------------------------------------------------
    uw = s(0.38)   # upper-wing half-width
    uh = s(0.28)   # upper-wing half-height
    lw = s(0.26)   # lower-wing half-width
    lh = s(0.22)   # lower-wing half-height
    spread = s(0.12)  # horizontal offset from body centre

    # Upper-left wing
    ul_cx = cx - spread
    ul_cy = cy - s(0.08)
    d.ellipse([ul_cx - uw, ul_cy - uh, ul_cx + uw, ul_cy + uh], fill=WING_OUTER)
    d.ellipse([ul_cx - uw * 0.6, ul_cy - uh * 0.6, ul_cx + uw * 0.6, ul_cy + uh * 0.6], fill=WING_INNER)
    if size >= 32:
        spot_r = s(0.06)
        d.ellipse([ul_cx - uw * 0.35 - spot_r, ul_cy - spot_r,
                   ul_cx - uw * 0.35 + spot_r, ul_cy + spot_r], fill=WING_SPOT)

    # Upper-right wing
    ur_cx = cx + spread
    ur_cy = cy - s(0.08)
    d.ellipse([ur_cx - uw, ur_cy - uh, ur_cx + uw, ur_cy + uh], fill=WING_OUTER)
    d.ellipse([ur_cx - uw * 0.6, ur_cy - uh * 0.6, ur_cx + uw * 0.6, ur_cy + uh * 0.6], fill=WING_INNER)
    if size >= 32:
        spot_r = s(0.06)
        d.ellipse([ur_cx + uw * 0.35 - spot_r, ur_cy - spot_r,
                   ur_cx + uw * 0.35 + spot_r, ur_cy + spot_r], fill=WING_SPOT)

    # Lower-left wing
    ll_cx = cx - spread * 1.1
    ll_cy = cy + s(0.18)
    d.ellipse([ll_cx - lw, ll_cy - lh, ll_cx + lw, ll_cy + lh], fill=WING_OUTER)
    d.ellipse([ll_cx - lw * 0.55, ll_cy - lh * 0.55, ll_cx + lw * 0.55, ll_cy + lh * 0.55], fill=WING_INNER)

    # Lower-right wing
    lr_cx = cx + spread * 1.1
    lr_cy = cy + s(0.18)
    d.ellipse([lr_cx - lw, lr_cy - lh, lr_cx + lw, lr_cy + lh], fill=WING_OUTER)
    d.ellipse([lr_cx - lw * 0.55, lr_cy - lh * 0.55, lr_cx + lw * 0.55, lr_cy + lh * 0.55], fill=WING_INNER)

    # ------------------------------------------------------------------
    # Body — thin vertical ellipse in the centre
    # ------------------------------------------------------------------
    bw = max(1, s(0.07))
    bh = s(0.38)
    d.ellipse([cx - bw, cy - bh / 2, cx + bw, cy + bh / 2], fill=BODY_DARK)

    # ------------------------------------------------------------------
    # Antennae (only at ≥ 32 px)
    # ------------------------------------------------------------------
    if size >= 32:
        line_w = max(1, int(s(0.025)))
        tip_r  = max(1, s(0.04))
        # left antenna
        lax0, lay0 = cx - s(0.04), cy - bh / 2
        lax1, lay1 = cx - s(0.20), cy - bh / 2 - s(0.20)
        d.line([(lax0, lay0), (lax1, lay1)], fill=ANTENNAE, width=line_w)
        d.ellipse([lax1 - tip_r, lay1 - tip_r, lax1 + tip_r, lay1 + tip_r], fill=ANTENNAE)
        # right antenna
        rax0, ray0 = cx + s(0.04), cy - bh / 2
        rax1, ray1 = cx + s(0.20), cy - bh / 2 - s(0.20)
        d.line([(rax0, ray0), (rax1, ray1)], fill=ANTENNAE, width=line_w)
        d.ellipse([rax1 - tip_r, ray1 - tip_r, rax1 + tip_r, ray1 + tip_r], fill=ANTENNAE)

    return img


for size in SIZES:
    img = draw_butterfly(size)
    out_path = os.path.join(OUT_DIR, f"icon{size}.png")
    img.save(out_path, "PNG")
    print(f"  Saved {out_path}  ({size}×{size})")

print("Done.")
