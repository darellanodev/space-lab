"""Converts the PNG textures of public/textures to WebP (much smaller) and updates the file names in the code.

Usage (needs Python 3 and Pillow):
  python tools/optimize_images.py [quality]

- Every public/textures/**/*.png becomes a .webp file (same name) and the .png is deleted.
- The names "something.png" are changed to "something.webp" in src/, index.html and public/levels/*.json.
- The Unity .meta files found in public/ are moved to unity-meta/textures/ (the game does not need them).
Run it only once (the PNG files are removed).
"""
import glob
import os
import re
import shutil
import sys

from PIL import Image

quality = int(sys.argv[1]) if len(sys.argv) > 1 else 85
root = os.path.join(os.path.dirname(__file__), '..')
textures = os.path.join(root, 'public', 'textures')

# 1. Unity .meta files out of public/
for meta in glob.glob(os.path.join(textures, '**', '*.meta'), recursive=True):
    rel = os.path.relpath(meta, textures)
    dest = os.path.join(root, 'unity-meta', 'textures', rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.move(meta, dest)

# 2. PNG -> WebP
before = after = 0
names = []
for png in glob.glob(os.path.join(textures, '**', '*.png'), recursive=True):
    webp = png[:-4] + '.webp'
    img = Image.open(png)
    img = img.convert('RGBA' if img.mode in ('RGBA', 'LA', 'P') else 'RGB')
    img.save(webp, 'WEBP', quality=quality, method=6)
    before += os.path.getsize(png)
    after += os.path.getsize(webp)
    names.append(os.path.basename(png)[:-4])
    os.remove(png)
print(f'{len(names)} images: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB')

# 3. Names in the code and data
pattern = re.compile(r'\b(' + '|'.join(re.escape(n) for n in sorted(names, key=len, reverse=True)) + r')\.png\b')
files = glob.glob(os.path.join(root, 'src', '**', '*.js'), recursive=True)
files += [os.path.join(root, 'index.html')] + glob.glob(os.path.join(root, 'public', 'levels', '*.json'))
for path in files:
    text = open(path, encoding='utf-8').read()
    new = pattern.sub(r'\1.webp', text)
    if new != text:
        open(path, 'w', encoding='utf-8').write(new)
        print('updated', os.path.relpath(path, root))
