"""
Điền số trang thật vào mục lục và danh mục bảng.

    python toc.py giam-sat-canh-bao.html build/giam-sat.pdf "Chân trang"

Cách làm: kết xuất, đọc vị trí thật của tiêu đề và nhãn bảng trong PDF, ghi số
trang vào các ô "?" trong HTML, rồi kết xuất lại. Vì độ rộng chữ số có thể làm
tài liệu dồn trang, script lặp tới khi số trang không đổi nữa.

Trong HTML chỉ cần đặt dấu ? ở ô số trang:
    <td class="toc-page">?</td>
Chữ ở ô bên cạnh phải trùng với tiêu đề hoặc nhãn bảng tương ứng.
"""

import html
import re
import subprocess
import sys
from pathlib import Path

import fitz

html_path = Path(sys.argv[1] if len(sys.argv) > 1 else "report.html")
pdf_path = Path(sys.argv[2] if len(sys.argv) > 2 else "build/report.pdf")
footer = sys.argv[3] if len(sys.argv) > 3 else "Tài liệu"

MAX_PASSES = 5
ROW = re.compile(
    r'(<td class="toc-txt">)(.*?)(</td>\s*<td class="toc-page">)(.*?)(</td>)',
    re.S,
)


def norm(s: str) -> str:
    """Bỏ thẻ, gộp khoảng trắng, hạ chữ hoa để so khớp bất kể text-transform."""
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip().casefold()


def render() -> None:
    subprocess.run(
        ["node", "render.mjs", str(html_path), str(pdf_path), footer],
        check=True,
        capture_output=True,
    )
    subprocess.run([sys.executable, "merge.py", str(pdf_path)], check=True, capture_output=True)


def page_of_targets() -> dict[str, int]:
    """Trả về {chữ đã chuẩn hoá: số trang} cho tiêu đề chương, mục, và nhãn bảng."""
    doc = fitz.open(pdf_path)
    found: dict[str, int] = {}
    for i, page in enumerate(doc):
        # Gộp span theo dòng để tiêu đề bị ngắt span vẫn khớp.
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                spans = [s for s in line["spans"] if s["text"].strip()]
                if not spans:
                    continue
                size = round(spans[0]["size"], 1)
                bold = "Bold" in spans[0]["font"]
                # h1 11.3 · h2 9.6 · nhãn bảng 8.4, tất cả đều in đậm
                if not bold or size not in (11.3, 9.6, 8.4):
                    continue
                key = norm("".join(s["text"] for s in spans))
                if key and key not in found:
                    found[key] = i + 1
    doc.close()
    return found


def fill(pages: dict[str, int]) -> tuple[str, int]:
    source = html_path.read_text(encoding="utf-8")
    misses = 0

    def repl(m: re.Match) -> str:
        nonlocal misses
        label, page_cell = m.group(2), m.group(4)
        # Chỉ điền vào ô đang là ? hoặc đã là số, không phá ô khác.
        if page_cell.strip() != "?" and not page_cell.strip().isdigit():
            return m.group(0)
        num = pages.get(norm(label))
        if num is None:
            misses += 1
            return f"{m.group(1)}{label}{m.group(3)}?{m.group(5)}"
        return f"{m.group(1)}{label}{m.group(3)}{num}{m.group(5)}"

    return ROW.sub(repl, source), misses


render()
for attempt in range(1, MAX_PASSES + 1):
    before = html_path.read_text(encoding="utf-8")
    patched, misses = fill(page_of_targets())
    if patched == before:
        print(f"Số trang mục lục đã ổn định sau {attempt} lượt.")
        break
    html_path.write_text(patched, encoding="utf-8")
    render()
else:
    print(f"Chưa ổn định sau {MAX_PASSES} lượt, kiểm tra lại thủ công.")

if misses:
    print(f"Cảnh báo: {misses} mục trong mục lục không tìm được tiêu đề tương ứng.")
print(f"Đã ghi {pdf_path} ({fitz.open(pdf_path).page_count} trang)")
