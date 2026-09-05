"""Measure Chrome paper-autofit PDFs for the checked-in regression runner.

This intentionally uses pdfplumber so the test records the font sizes and
text bounds that survived PDF generation, rather than relying only on the
requested CDP paper dimensions.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
from collections import Counter

import pdfplumber


def numeric_bold_words(page):
    words = page.extract_words(extra_attrs=["fontname", "size"])
    return [
        word
        for word in words
        if re.fullmatch(r"\d+", word.get("text", ""))
        and "BIZ-UDPGothic-Bold" in word.get("fontname", "")
    ]


def problem_label_style(page):
    styles = Counter(
        (word.get("fontname", ""), round(float(word.get("size", 0)), 3))
        for word in numeric_bold_words(page)
    )
    return styles.most_common(1)[0][0] if styles else None


def problem_count(page, label_style):
    if not label_style:
        return 0
    return sum(
        1
        for word in numeric_bold_words(page)
        if (
            word.get("fontname", ""),
            round(float(word.get("size", 0)), 3),
        ) == label_style
    )


def page_metrics(page, label_style):
    chars = page.chars
    sizes = [float(char["size"]) for char in chars if char.get("size") is not None]
    x0 = [float(char["x0"]) for char in chars]
    x1 = [float(char["x1"]) for char in chars]
    top = [float(char["top"]) for char in chars]
    bottom = [float(char["bottom"]) for char in chars]
    bbox = None
    if chars:
        bbox = [min(x0), min(top), max(x1), max(bottom)]
    return {
        "widthPt": float(page.width),
        "heightPt": float(page.height),
        "charCount": len(chars),
        "maxFontPt": max(sizes, default=0),
        "text": page.extract_text() or "",
        "charBbox": bbox,
        "problemCount": problem_count(page, label_style),
    }


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: measure-paper-autofit-pdfs.py <pdf-directory>")
    directory = pathlib.Path(sys.argv[1])
    result = {}
    for path in sorted(directory.glob("*.pdf")):
        with pdfplumber.open(path) as pdf:
            label_style = problem_label_style(pdf.pages[0]) if pdf.pages else None
            pages = [page_metrics(page, label_style) for page in pdf.pages]
        result[path.name] = {
            "pageCount": len(pages),
            "pages": pages,
            "problemLabelStyle": {
                "fontName": label_style[0],
                "fontSize": label_style[1],
            } if label_style else None,
        }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
