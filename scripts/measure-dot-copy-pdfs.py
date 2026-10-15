"""Read-only PDF QA: page size, problem labels, nonblank pages, vector bounds."""
from pathlib import Path
import re
import pdfplumber

root = Path(__file__).resolve().parent.parent / "output" / "playwright"
files = sorted(root.glob("dot-copy-*.pdf"))
assert files, "No dot-copy PDFs found"
for file in files:
    match = re.search(r"-(1|2|4)-per-page", file.name)
    per_page = int(match.group(1)) if match else 4
    expected_questions = 4 if "fallback" in file.name else 5
    # Ignore any stale manual experiments not produced by the verification scripts.
    if not match and "-punch-" not in file.name and "fallback" not in file.name:
        continue
    expected_pages = (expected_questions + per_page - 1) // per_page
    with pdfplumber.open(file) as pdf:
        assert len(pdf.pages) == expected_pages, (file.name, len(pdf.pages), expected_pages)
        all_labels = []
        for index, page in enumerate(pdf.pages):
            assert abs(page.width * 25.4 / 72 - 210) < .3, (file.name, page.width)
            assert abs(page.height * 25.4 / 72 - 297) < .3, (file.name, page.height)
            text = page.extract_text() or ""
            labels = [int(n) for n in re.findall(r"(\d+)\s+おてほん", text)]
            expected = list(range(index * per_page + 1, min((index + 1) * per_page, expected_questions) + 1))
            assert labels == expected, (file.name, index, labels, expected, text)
            assert "おてほんと おなじように せんを ひこう" in text, (file.name, index, "missing instruction")
            assert "作り直す" not in text and "ヒント設定" not in text, (file.name, index, "printable controls")
            all_labels.extend(labels)
            for item in page.lines + page.curves + page.rects:
                # Chrome paints its white page backdrop to CSS pixel boundaries,
                # then clips it to the rounded PDF MediaBox (a sub-point excess).
                if item["object_type"] == "rect" and item.get("fill") and not item.get("stroke") and item.get("non_stroking_color") == (1, 1, 1):
                    continue
                assert item["x0"] >= -.1 and item["x1"] <= page.width + .1, (file.name, index, "horizontal clipping")
                assert item["top"] >= -.1 and item["bottom"] <= page.height + .1, (file.name, index, "vertical clipping")
        assert all_labels == list(range(1, expected_questions + 1)), file.name
    print(f"PASS {file.name}: {expected_pages} A4 pages, {expected_questions} complete problems")

for file in sorted(root.glob("dot-tail-*-*-*.pdf")):
    match = re.match(r"dot-tail-(chrome|edge)-(4|8)-", file.name)
    if not match:
        continue
    count = int(match.group(2))
    with pdfplumber.open(file) as pdf:
        assert len(pdf.pages) == count // 4, (file.name, len(pdf.pages))
        for index, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            labels = [int(n) for n in re.findall(r"(\d+)\s+おてほん", text)]
            assert labels == list(range(index * 4 + 1, index * 4 + 5)), (file.name, index, labels)
            assert "たて3点" in text and "線2本" in text and "レベル1" in text, (file.name, index, "missing footer")
            dots = [curve for curve in page.curves if curve.get("fill") and not curve.get("stroke")
                    and isinstance(curve.get("non_stroking_color"), tuple)
                    and all(component <= .1 for component in curve["non_stroking_color"])]
            assert len(dots) == 72, (file.name, index, "missing grid dots", len(dots))
    print(f"PASS {file.name}: all {count} questions, dots and footers preserved")

for file in sorted(root.glob("dot-connected-*.pdf")):
    match = re.fullmatch(r"dot-connected-(chrome|edge)-(4|8)\.pdf", file.name)
    if not match:
        continue
    count = int(match.group(2))
    with pdfplumber.open(file) as pdf:
        assert len(pdf.pages) == count // 4, (file.name, len(pdf.pages))
        for index, page in enumerate(pdf.pages):
            assert abs(page.width * 25.4 / 72 - 210) < .3, (file.name, page.width)
            assert abs(page.height * 25.4 / 72 - 297) < .3, (file.name, page.height)
            text = page.extract_text() or ""
            labels = [int(n) for n in re.findall(r"(\d+)\s+おてほん", text)]
            assert labels == list(range(index * 4 + 1, index * 4 + 5)), (file.name, index, labels)
            assert "たて5点" in text and "線5本" in text, (file.name, index, "missing footer")
            assert "全ての点を繋げる" not in text, (file.name, index, "printable control")
            dots = [curve for curve in page.curves if curve.get("fill") and not curve.get("stroke")
                    and isinstance(curve.get("non_stroking_color"), tuple)
                    and all(component <= .1 for component in curve["non_stroking_color"])]
            assert len(dots) == 200, (file.name, index, "missing grid dots", len(dots))
            for item in page.chars + page.lines + page.curves:
                assert -.1 <= item["x0"] <= item["x1"] <= page.width + .1, (file.name, index, "horizontal clipping")
                assert -.1 <= item["top"] <= item["bottom"] <= page.height + .1, (file.name, index, "vertical clipping")
    print(f"PASS {file.name}: all {count} connected-mode problems, dots and footers preserved")
