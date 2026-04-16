"""
Generate the Flinch app icon set for Tauri.

Design: monogram "F." — bold sans-serif F in off-white on pure black,
with a small red square dot to the lower-right (referencing the "refused"
classification badge color from the web UI).

Outputs into src-tauri/icons/:
- 32x32.png
- 128x128.png
- 128x128@2x.png   (256x256)
- icon.ico         (multi-resolution: 16, 32, 48, 64, 128, 256)
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "src-tauri" / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)

BG = (10, 10, 10, 255)          # #0a0a0a
FG = (245, 245, 245, 255)        # off-white
ACCENT = (220, 38, 38, 255)      # tailwind red-600 — matches refused badge

MASTER_SIZE = 1024


def find_bold_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "C:\\Windows\\Fonts\\segoeuib.ttf",
        "C:\\Windows\\Fonts\\seguibl.ttf",  # Segoe UI Black
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def render_master() -> Image.Image:
    img = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), BG)
    draw = ImageDraw.Draw(img)

    font_size = int(MASTER_SIZE * 0.78)
    font = find_bold_font(font_size)

    text = "F"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    # Center the F slightly left to leave room for the accent dot on the right.
    cx = (MASTER_SIZE - text_w) // 2 - bbox[0] - int(MASTER_SIZE * 0.06)
    cy = (MASTER_SIZE - text_h) // 2 - bbox[1]
    draw.text((cx, cy), text, font=font, fill=FG)

    # Red square dot at the lower-right baseline of the F.
    dot_size = int(MASTER_SIZE * 0.13)
    f_right = cx + bbox[2]
    baseline_y = cy + bbox[3]
    dot_x = f_right + int(MASTER_SIZE * 0.02)
    dot_y = baseline_y - dot_size
    draw.rectangle(
        [dot_x, dot_y, dot_x + dot_size, dot_y + dot_size],
        fill=ACCENT,
    )

    return img


def downscale(master: Image.Image, size: int) -> Image.Image:
    return master.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    master = render_master()

    targets = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
    }
    for filename, size in targets.items():
        downscale(master, size).save(ICONS_DIR / filename, "PNG")
        print(f"wrote {ICONS_DIR / filename}")

    ico_sizes = [16, 32, 48, 64, 128, 256]
    ico_imgs = [downscale(master, s) for s in ico_sizes]
    ico_path = ICONS_DIR / "icon.ico"
    ico_imgs[0].save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_imgs[1:],
    )
    print(f"wrote {ico_path}")

    preview_path = ICONS_DIR / "preview-512.png"
    downscale(master, 512).save(preview_path, "PNG")
    print(f"wrote {preview_path} (preview only — not bundled)")


if __name__ == "__main__":
    main()
