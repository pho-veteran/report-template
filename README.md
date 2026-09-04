# Bộ khung tài liệu kỹ thuật

Định dạng trích xuất từ `GitLab-va-GitLab-Runner-hien-trang.pdf` để tái sử dụng
cho tài liệu khác, ví dụ báo cáo hệ thống một ứng dụng.

Bản gốc do **wkhtmltopdf 0.12.6** sinh ra từ HTML/CSS, nên định dạng tái tạo
được gần như y nguyên. Máy này không có wkhtmltopdf, nên `render.mjs` dùng
Microsoft Edge ở chế độ headless qua CDP.

## Tệp

| Tệp | Vai trò |
| --- | --- |
| `style.css` | Toàn bộ định dạng. Chỉnh ở đây, không chỉnh trong HTML. |
| `report.html` | Nội dung mẫu, báo cáo một app. |
| `giam-sat-canh-bao.html` | Ví dụ thứ hai, 16 trang, dùng để kiểm chứng khung. |
| `render.mjs` | Kết xuất HTML sang PDF, chèn chân trang lặp lại. |
| `merge.py` | Bỏ chân trang ở bìa, ghép lại thành bản cuối. |
| `toc.py` | Điền số trang thật vào mục lục và danh mục bảng. |

## Chạy

Cách gọn nhất, `toc.py` tự làm cả ba bước và lặp tới khi số trang ổn định:

```bash
python toc.py report.html build/report.pdf "Tiêu đề chạy ở chân trang"
```

Muốn chạy từng bước:

```bash
node render.mjs report.html build/report.pdf "Tiêu đề chạy ở chân trang"
python merge.py build/report.pdf
```

Bước `merge.py` chỉ để bìa không có chân trang, giống bản gốc. Bỏ qua bước này
thì bìa sẽ có chân trang, còn lại vẫn đúng.

## Số trang trong mục lục

Đặt dấu `?` ở ô số trang, `toc.py` sẽ điền số thật:

```html
<tr class="lvl1"><td class="toc-txt">3. Thu thập chỉ số</td> <td class="toc-page">?</td></tr>
```

Chữ ở ô `toc-txt` phải trùng với tiêu đề chương, tiêu đề mục, hoặc nhãn bảng
tương ứng. Script so khớp không phân biệt chữ hoa, nên `3. Thu thập chỉ số`
khớp với `3. THU THẬP CHỈ SỐ` do `text-transform` sinh ra.

Điền tay thì gần như chắc chắn sai, vì thêm hay bớt một đoạn là toàn bộ số
trang phía sau dịch theo.

## Thông số đo từ bản gốc

| Hạng mục | Giá trị |
| --- | --- |
| Khổ giấy | A4, đúng 595 × 842 pt |
| Lề | trên 63,8pt · phải 57,2pt · dưới 62,4pt · trái 62,2pt |
| Vùng nội dung | x 62,2 → 537,8, rộng 475,6pt |
| Phông thân bài | Times New Roman 9pt, dòng 12,5pt, căn đều hai bên |
| Khoảng cách H2 | trên 17-20pt, dưới 7,8pt |
| Phông mã | Courier New 7,2pt |
| Tiêu đề bìa | Times bold 17,9pt, hoa toàn bộ |
| H1 chương | bold 11,3pt, hoa toàn bộ, kẻ dưới 0,6pt |
| H2 mục | bold 9,6pt |
| Nhãn bảng | bold 8,4pt, đặt trên bảng |
| Nội dung bảng | 7,8pt, kẻ đầu 0,6pt đen, kẻ dòng 0,5pt `#cfcfcf` |
| Khối lưu ý | nền `#f6f6f6`, vạch trái 1,8pt `#555`, chữ thụt 9pt, không padding phải |
| Chân trang | Times 9,6pt, tiêu đề bên trái, `n / N` bên phải |
| Màu | đen tuyền, không màu nhấn |

Lề trái và lề phải **không** bằng nhau. Đây là số đo thật của bản gốc, giữ
nguyên để kẻ ngang trùng vị trí.

## Các khối dùng lại

Xem `report.html` để có ví dụ đầy đủ của từng khối:

- **Bìa**: `.cover` với `.cover-eyebrow`, `.cover-kicker`, `.cover-title`,
  `.cover-rule`, `.cover-tagline`, bảng `.cover-meta`, `.cover-note`.
  Dùng `div.cover-title`, đừng dùng `h1`, vì `h1` có luật tự sang trang.
- **Mục lục**: bảng `.toc`, hàng `.lvl1` in đậm, `.lvl2` thụt 20,4pt. Khối
  Danh mục bảng thêm `class="front-title own-page"` để nằm trang riêng, giống
  bản gốc, thay vì tràn vài dòng lẻ sang trang sau.
- **Chương**: `<h1>` tự sang trang mới. Chương đầu thêm `class="first"`
  nếu không muốn sang trang.
- **Bảng số liệu**: `.caption` rồi `table.data`. Cột số thêm `class="num"`
  để căn phải.
- **Bảng dài**: dùng `table.data.long` và bọc hàng đầu trong `<thead>`. Bảng sẽ
  vắt sang trang và lặp lại đầu bảng, thay vì bị đẩy nguyên khối sang trang mới
  và để trống nửa trang trước đó. Bảng dưới khoảng 12 dòng thì giữ `table.data`.
- **Lưu ý**: `div.note`, câu mở đầu bọc trong `span.lead`.
- **Khối mã**: `<pre>`.
- **Sơ đồ luồng**: `.flow` với các `.node` và `.arrow`, kèm `.figcaption`.

## Quy ước trình bày của bản gốc

Đáng giữ vì chúng làm nên tính chất của tài liệu:

- Định danh tài nguyên, đường dẫn, tham số cấu hình luôn đặt trong phông đơn cách.
- Số thập phân dùng dấu phẩy, phần nghìn dùng dấu chấm.
- Suy luận chưa kiểm chứng phải ghi rõ là suy luận, không trình bày như dữ kiện.
- Mỗi bảng có nhãn đánh số theo chương, ví dụ `Bảng 3.4.`, và được liệt kê ở
  Danh mục bảng.
- Nhãn bảng đặt **trên** bảng, nhãn hình đặt **dưới** hình.
- Bìa ghi rõ ngày đọc số liệu, vì tài liệu hiện trạng chỉ đúng tại một thời điểm.

## Ghi chú kỹ thuật

Lề trang do `@page` trong `style.css` quyết định. Chrome ưu tiên `@page` hơn
tham số lề của CDP, nên khi đổi lề phải sửa **cả hai** chỗ: `@page` trong
`style.css` và `MARGIN` trong `render.mjs`, giữ cho hai bên khớp nhau, nếu
không chân trang sẽ lệch so với thân bài.
