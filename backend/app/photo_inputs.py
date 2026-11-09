"""Validate and re-encode temporary image inputs without retaining originals."""

import base64
import binascii
import warnings
from io import BytesIO

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError


def sanitized_photos(photos: list[str]) -> list[str]:
    result = []
    for value in photos:
        try:
            header, encoded = value.split(",", 1)
            allowed = {
                "data:image/jpeg;base64": "JPEG",
                "data:image/png;base64": "PNG",
                "data:image/webp;base64": "WEBP",
            }
            if header not in allowed:
                raise ValueError("Unsupported type")
            raw = base64.b64decode(encoded, validate=True)
            if not raw or len(raw) > 900_000:
                raise ValueError("Unsupported size")
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(raw)) as source:
                    if source.format != allowed[header] or getattr(source, "n_frames", 1) != 1:
                        raise ValueError("Unsupported image")
                    if source.width * source.height > 20_000_000:
                        raise ValueError("Too many pixels")
                    source.load()
                    oriented = ImageOps.exif_transpose(source)
                    oriented.thumbnail((1536, 1536))
                    # New pixels carry no EXIF, GPS, comments, profiles or original filename.
                    clean = Image.new("RGB", oriented.size, "white")
                    if "A" in oriented.getbands():
                        rgba = oriented.convert("RGBA")
                        clean.paste(rgba, mask=rgba.getchannel("A"))
                    else:
                        clean.paste(oriented.convert("RGB"))
                    output = BytesIO()
                    clean.save(output, format="JPEG", quality=85)
            result.append(
                "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")
            )
        except (
            ValueError,
            binascii.Error,
            OSError,
            UnidentifiedImageError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
        ):
            raise HTTPException(
                422,
                "Use up to three clear, still JPG, PNG or WebP photos, each under 900 KB after resizing.",
            ) from None
    return result
