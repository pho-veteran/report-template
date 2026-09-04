"""
Ghép bìa không chân trang vào bản có chân trang.

    python merge.py build/report.pdf build/report.nofooter.pdf

Bản gốc để bìa trống chân trang nhưng vẫn tính bìa là trang 1, nên trang 2
mang nhãn "2 / 20". Chrome không cho lọc chân trang theo số trang, vì vậy
render.mjs in hai lượt và script này lấy trang 1 từ lượt không chân trang,
các trang còn lại từ lượt có chân trang.
"""

import os
import sys

import fitz

main_path = sys.argv[1] if len(sys.argv) > 1 else "build/report.pdf"
bare_path = sys.argv[2] if len(sys.argv) > 2 else main_path.replace(".pdf", ".nofooter.pdf")

main = fitz.open(main_path)
bare = fitz.open(bare_path)

if main.page_count != bare.page_count:
    sys.exit(f"Hai lượt in lệch số trang: {main.page_count} vs {bare.page_count}")

out = fitz.open()
out.insert_pdf(bare, from_page=0, to_page=0)          # bìa, không chân trang
if main.page_count > 1:
    out.insert_pdf(main, from_page=1, to_page=main.page_count - 1)

tmp = main_path + ".tmp"
out.save(tmp, garbage=4, deflate=True)
out.close()
main.close()
bare.close()

os.replace(tmp, main_path)
os.remove(bare_path)
print(f"Đã ghép bìa, {main_path} có {fitz.open(main_path).page_count} trang")
