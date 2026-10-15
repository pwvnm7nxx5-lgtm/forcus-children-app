"""Check mixed manual/automatic worksheets, including printing during editing."""
from pathlib import Path
import re
import pdfplumber

root = Path(__file__).resolve().parent.parent / "output" / "playwright"
files = sorted(root.glob("dot-manual-*.pdf"))
assert files, "No manual worksheet PDFs found"
for file in files:
    match = re.fullmatch(r"dot-manual-(chrome|edge)(?:-(1|2)-per-page)?\.pdf", file.name)
    if not match:
        continue
    per_page = int(match.group(2) or 4)
    with pdfplumber.open(file) as pdf:
        assert len(pdf.pages) == 4 // per_page, (file.name, len(pdf.pages))
        for index, page in enumerate(pdf.pages):
            assert abs(page.width * 25.4 / 72 - 210) < .3, (file.name, page.width)
            assert abs(page.height * 25.4 / 72 - 297) < .3, (file.name, page.height)
            text = page.extract_text() or ""
            labels = [int(n) for n in re.findall(r"(\d+)\s+おてほん", text)]
            assert labels == list(range(index * per_page + 1, (index + 1) * per_page + 1)), (file.name, labels)
            assert "たて5点" in text and "レベル1" in text, (file.name, "missing footer")
            line_label = "線3〜5本" if index == 0 and per_page > 1 else "線3本" if index == 0 else "線5本"
            assert line_label in text, (file.name, index, line_label, text)
            assert all(label not in text for label in ["全消去", "保存できます", "キャンセル", "手動で編集"]), (file.name, "editor printed")
            dots = [curve for curve in page.curves if curve.get("fill") and not curve.get("stroke")
                    and isinstance(curve.get("non_stroking_color"), tuple)
                    and all(value <= .1 for value in curve["non_stroking_color"])]
            assert len(dots) == per_page * 50, (file.name, index, "grid dots missing", len(dots))
            for item in page.chars + page.lines + page.curves:
                assert -.1 <= item["x0"] <= item["x1"] <= page.width + .1, (file.name, "horizontal clipping")
                assert -.1 <= item["top"] <= item["bottom"] <= page.height + .1, (file.name, "vertical clipping")
    print(f"PASS {file.name}: {4 // per_page} A4 pages, all problems/dots/actual line counts, no editing controls")
