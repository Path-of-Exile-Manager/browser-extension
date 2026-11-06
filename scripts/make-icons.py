"""Иконки расширения: временная монограмма «pm», как AppLogo в дизайн-системе.

Цвета — из токенов (color.bg.surface, color.accent.solid, color.text.accent). Когда у продукта
появится настоящий логотип, достаточно заменить PNG в public/icons/.

Запуск: python scripts/make-icons.py  (нужен Pillow; шрифт — Consolas Bold из Windows или DejaVu Sans Mono Bold)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG = (19, 15, 18, 255)  # color.bg.surface
BORDER = (236, 74, 160, 255)  # color.accent.solid
TEXT = (255, 114, 183, 255)  # color.text.accent

FONT_CANDIDATES = [
    "C:/Windows/Fonts/consolab.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
    "/System/Library/Fonts/Menlo.ttc",
]

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"


def font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise SystemExit("Не найден моноширинный жирный шрифт")


def make(size: int) -> Image.Image:
    scale = 8  # рисуем крупно и уменьшаем — так края ровнее
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    border = max(1, round(size / 16)) * scale
    radius = round(s * 0.22)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=BG)
    d.rounded_rectangle(
        [border // 2, border // 2, s - 1 - border // 2, s - 1 - border // 2],
        radius=radius,
        outline=BORDER,
        width=border,
    )
    text = "pm" if size >= 32 else "p"
    f = font(round(s * (0.46 if text == "pm" else 0.72)))
    box = d.textbbox((0, 0), text, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((s - w) / 2 - box[0], (s - h) / 2 - box[1]), text, font=f, fill=TEXT)
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 128):
    make(size).save(OUT / f"icon-{size}.png")
    print(f"icon-{size}.png")
