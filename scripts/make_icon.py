# -*- coding: utf-8 -*-
"""
生成应用图标：紫色渐变圆角方块 + 白色「简」
输出: build/icon.png (512) 和 build/icon.ico (多尺寸)
用法: python scripts/make_icon.py
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
C1 = (102, 126, 234)   # #667eea
C2 = (118, 75, 162)    # #764ba2
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",   # 微软雅黑 Bold
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]
OUT_DIR = Path(__file__).resolve().parent.parent / "build"


def diagonal_gradient(size: int, c1, c2) -> Image.Image:
    """对角线渐变：先做 2 倍尺寸的竖直渐变，旋转 45° 后居中裁剪"""
    big = size * 2
    grad = Image.new("RGB", (big, 1))
    for x in range(big):
        t = x / (big - 1)
        color = tuple(round(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
        grad.putpixel((x, 0), color)
    grad = grad.resize((big, big))
    grad = grad.rotate(45, resample=Image.BICUBIC)
    left = (big - size) // 2
    return grad.crop((left, left, left + size, left + size))


def rounded_mask(size: int, radius: int) -> Image.Image:
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def load_font(px: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, px)
        except OSError:
            continue
    raise RuntimeError("找不到可用的中文字体（msyh/simhei）")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    grad = diagonal_gradient(SIZE, C1, C2).convert("RGBA")
    mask = rounded_mask(SIZE, radius=SIZE // 5)
    icon.paste(grad, (0, 0), mask)

    draw = ImageDraw.Draw(icon)
    font = load_font(int(SIZE * 0.58))
    text = "简"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (SIZE - tw) / 2 - bbox[0]
    y = (SIZE - th) / 2 - bbox[1] - SIZE * 0.01
    draw.text((x, y), text, font=font, fill=(255, 255, 255, 255))

    icon512 = icon.resize((512, 512), Image.LANCZOS)
    icon512.save(OUT_DIR / "icon.png")
    icon.save(
        OUT_DIR / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"已生成: {OUT_DIR / 'icon.png'} (512), {OUT_DIR / 'icon.ico'}")


if __name__ == "__main__":
    main()
