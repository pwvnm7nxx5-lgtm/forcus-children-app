"""Verify printed ordinary Euler trails: reported model, square and figure eight."""
from pathlib import Path
import re
import pdfplumber

root = Path(__file__).resolve().parent.parent / "output" / "playwright"
files = sorted(root.glob("dot-euler-*.pdf"))
assert files, "No Euler worksheet PDFs found"
counts = [6, 4, 8, 6]
for file in files:
    match = re.fullmatch(r"dot-euler-(chrome|edge)-(1|2|4)\.pdf", file.name)
    if not match:
        continue
    per = int(match[2])
    with pdfplumber.open(file) as pdf:
        assert len(pdf.pages) == 4 // per, (file.name, "page count")
        for index, page in enumerate(pdf.pages):
            assert abs(page.width * 25.4 / 72 - 210) < .3 and abs(page.height * 25.4 / 72 - 297) < .3
            text = page.extract_text() or ""
            assert [int(n) for n in re.findall(r"(\d+)\s+おてほん", text)] == list(range(index * per + 1, (index + 1) * per + 1))
            values = counts[index * per:(index + 1) * per]
            label = str(values[0]) if min(values) == max(values) else f"{min(values)}〜{max(values)}"
            assert f"線{label}本" in text and "たて3点" in text, (file.name, index, "footer")
            assert "かきはじめ" in text and "おわり" in text
            assert "やさしい一筆書き" not in text and "全消去" not in text
            dots = [c for c in page.curves if c.get("fill") and not c.get("stroke")
                    and isinstance(c.get("non_stroking_color"), tuple) and max(c["non_stroking_color"]) < .1]
            assert len(dots) == 18 * per, (file.name, index, "grid dots", len(dots))
            goals = [r for r in page.rects if r.get("stroke") and not r.get("fill") and abs(r["width"] - r["height"]) < .1]
            assert len(goals) >= 2 * per, (file.name, index, "goal markers")
            for item in page.chars + page.lines + page.curves + goals:
                assert -.1 <= item["x0"] <= item["x1"] <= page.width + .1, (file.name, "horizontal clipping")
                assert -.1 <= item["top"] <= item["bottom"] <= page.height + .1, (file.name, "vertical clipping")
    print(f"PASS {file.name}: complete A4 problems/dots/goals/footer, no extra pages or editing controls")
