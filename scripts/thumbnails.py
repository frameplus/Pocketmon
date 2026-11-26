"""Derive small Pokédex thumbnails from the same official artwork used on cards."""
from pathlib import Path
from PIL import Image

dest = Path("public/thumbs")
dest.mkdir(exist_ok=True)
for source in Path("public/art").glob("*.png"):
    with Image.open(source) as art:
        thumbnail = art.convert("RGBA")
        thumbnail.thumbnail((144, 144), Image.Resampling.LANCZOS)
        thumbnail.save(dest / (source.stem + ".webp"), quality=85)
