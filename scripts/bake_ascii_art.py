"""Offline authoring: sample source artwork into native glyph/color data.

The PNGs are source references only; the browser imports JSON and renders every
visible cell through the shared glyph renderer. Requires Pillow, no network.
Run: python scripts/bake_ascii_art.py
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAMP = ' .,:;irsxOX#%@'


def bake(source, name, width, anchor_x, anchor_y, region=None):
    image = Image.open(ROOT / source).convert('RGBA')
    if region is not None:
        image = image.crop((round(image.width * region[0]), 0, round(image.width * region[1]), image.height))
    # Alpha is only used to identify source coverage; source files are unedited.
    mask = image.getchannel('A').point(lambda value: 255 if value > 185 else 0)
    box = mask.getbbox()
    if box is None:
        raise ValueError(f'{source}: no opaque artwork')
    image = image.crop(box)
    height = round(width * image.height / image.width * 4 / 6)
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    palette = []
    palette_ids = {}
    rows = []
    ink = []
    for y in range(height):
        row = ''
        for x in range(width):
            r, g, b, alpha = image.getpixel((x, y))
            if alpha < 185:
                row += ' '
                ink.append(0)
                continue
            lum = (.2126 * r + .7152 * g + .0722 * b) / 255
            shade = min(.99, max(.05, lum ** .72))
            glyph = RAMP[max(1, round(shade * (len(RAMP) - 1)))]
            # A restrained cool lift makes dark steel visible in moonlight.
            channels = [min(232, round((value / 255) ** .78 * 240 + 12)) for value in (r, g, b)]
            channels = [round(value / 16) * 16 for value in channels]
            color = '#' + ''.join(f'{min(255, value):02x}' for value in channels)
            if color not in palette_ids:
                palette_ids[color] = len(palette) + 1
                palette.append(color)
            row += glyph
            ink.append(palette_ids[color])
        rows.append(row)
    data = {'width': width, 'height': height, 'anchor': {'x': round(width * anchor_x), 'y': round(height * anchor_y)}, 'palette': palette, 'rows': rows, 'ink': ink}
    target = ROOT / 'src/assets/art' / f'{name}.json'
    target.write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
    print(f'{target.name}: {width}x{height}, {sum(value != 0 for value in ink)} glyphs, {len(palette)} colors')


if __name__ == '__main__':
    bake('artifacts/source-art/horse-v2.png', 'horse', 150, .52, .97)
    bake('artifacts/source-art/knight-v3.png', 'knight', 112, .53, .98)
    for family, names in [('catfolk', ['cat-girl', 'cat-boy']), ('vampire', ['vampire-girl', 'vampire-boy']), ('dwarf', ['dwarf-guardian', 'dwarf-neutral'])]:
        for index, name in enumerate(names):
            bake(f'artifacts/source-art/{family}-family.png', name, 96, .57, .98, (index / 2, (index + 1) / 2))
