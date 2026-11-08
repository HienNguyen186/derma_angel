# DermaAngel — Mood in the Clouds

Website giới thiệu và tiếp nhận yêu cầu đặt hàng cho 5 thiết kế DermaAngel của đội Form V. Nội dung và luồng sử dụng được đối chiếu với `01_Noi_dung_website_Form_V.docx` và `02_Yeu_cau_trien_khai_web_Form_V.docx` trong thư mục dự án cha. Bản Sites hiện dành riêng cho chủ dự án.

## Hai khu vực

- **Customer Storefront** (`/`): trang dài gồm giới thiệu, bộ sưu tập, chọn mood, ưu đãi đang hoạt động, câu chuyện, đánh giá, FAQ và liên hệ. Khách có thể tìm, lọc, xem chi tiết, lưu yêu thích trong trình duyệt, gửi yêu cầu đặt hàng và tra cứu bằng mã đơn cùng số điện thoại. Không cần tài khoản.
- **Business Admin** (`/admin`): chỉ người có email trong `ADMIN_EMAILS` được vào. Admin quản lý sản phẩm, giá, tồn kho, hình ảnh, phương thức nhận, chính sách, đơn hàng, voucher, đánh giá, KPI website, minh chứng và báo cáo chiến dịch.

Ảnh bao bì của Glitter, Panda, Cute Paws, Hologram và Kitties dùng tài liệu sản phẩm gốc được cung cấp. Font Be Vietnam Pro và Lora có bộ ký tự tiếng Việt để dấu không bị tách khỏi chữ trên cả hai khu vực.

## Điều kiện mở bán

Giá 63.000 ₫/hộp trong tài liệu là **giá tham khảo**, không được tự coi là giá bán đã duyệt. Sản phẩm chỉ hiện giá và được thêm vào giỏ sau khi Admin nhập và xác nhận giá, nhập và xác nhận tồn kho dương. Admin chỉ bật nhận trực tiếp khi có điểm nhận, chỉ bật giao hàng khi có thông tin giao hàng. Hiện các cờ xác nhận và phương thức nhận mặc định tắt.

Đơn mới là **yêu cầu đặt hàng**. Backend tính lại giá, kiểm tra tồn và voucher, chống gửi trùng bằng `requestKey`, rồi giữ số lượng trong một giao dịch D1. Đội Form V xác nhận phí giao, cách thanh toán và bàn giao hàng thủ công. Doanh thu website chỉ tính đơn đã thanh toán và giao xong, trừ giảm giá và tiền hoàn; không tính phí giao.

Khách mua trực tiếp hoặc qua kênh khác có thể đánh giá không cần mã đơn. Đánh giá này được gắn nhãn **khách gửi trực tiếp, chưa đối chiếu đơn**. Khách đặt qua website có thể đánh giá bằng mã đơn + số điện thoại sau khi đơn đã thanh toán và giao xong; mỗi đơn tối đa một đánh giá. Cả hai luồng đều cần tên hiển thị, 1–5 sao, đồng ý công khai và Admin duyệt trước khi xuất hiện. Số sao trung bình chỉ lấy đánh giá đã duyệt. Số điện thoại không nằm trong đánh giá công khai.

Admin có thể chuẩn bị voucher giảm tiền hoặc giảm phần trăm với giá trị đơn tối thiểu, số lượt và thời hạn. Storefront chỉ hiện ưu đãi đang có hiệu lực. Các combo và quà tặng chưa có quy tắc, giá và tồn được duyệt nên chưa được kích hoạt.

## KPI và nguồn số liệu

- KPI website tách khỏi KPI toàn chiến dịch và các báo cáo kênh khác.
- Các số **120 lượt truy cập, 600.000 ₫, 7%, 4,0 sao** là tham chiếu khởi tạo trong ảnh BTC, **không phải kết quả của Form V**. Admin gắn nhãn nguồn `seed` và có thể sửa mục tiêu, nguồn, minh chứng.
- Lượt truy cập nội bộ đếm một phiên trình duyệt mỗi ngày sau khi khách đồng ý, có cơ chế gửi lại khi sự kiện thất bại. Đây là số phiên có đồng ý, chưa phải số phiên toàn website trong công cụ analytics độc lập. Doanh thu từ đơn đã thanh toán và giao xong; điểm sao từ đánh giá đã duyệt. Tỷ lệ chuyển đổi online sang mua trực tiếp chưa có dữ liệu đối soát nên không tự tính từ lượt truy cập và đơn.
- Mục tiêu chiến dịch 90.000 hộp / 5,67 tỷ ₫ cho 11/2026–01/2027 nằm ở phần chiến dịch riêng. Kết quả các kênh khác cần Admin nhập báo cáo; website không tự nhận toàn bộ doanh số chiến dịch.

## Chạy cục bộ

Yêu cầu Node.js 22.13+ và npm. Trong thư mục này:

```powershell
npm ci
Copy-Item .env.example .dev.vars
```

Đặt `ADMIN_EMAILS=seedy@sites.test` trong `.dev.vars` để thử tài khoản Admin của môi trường Sites cục bộ. Sau đó:

```powershell
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_unusual_dark_beast.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_amused_gargoyle.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_dark_white_queen.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_slippery_colonel_america.sql
npm run dev
```

Mở `http://127.0.0.1:5173/`. Admin cục bộ: `http://127.0.0.1:5173/signin-with-chatgpt?return_to=/admin`. Dữ liệu D1/R2 cục bộ nằm trong `.wrangler/state`, riêng với bản Sites. Chỉ áp dụng mỗi migration một lần cho cùng database.

## Triển khai Cloudflare Workers + D1

`wrangler.cloudflare.jsonc` dùng Worker `dermaangel-form-v` và D1 `dermaangel-form-v`. Bản này độc lập với Sites. Từ thư mục repo:

```powershell
npm ci
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply dermaangel-form-v --remote --config wrangler.cloudflare.jsonc
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js deploy --config wrangler.cloudflare.jsonc
```

Cloudflare Workers không tự cung cấp các header đăng nhập của Sites. Worker loại bỏ header giả do khách gửi. Admin đăng nhập tại `/admin/login` bằng email và mật khẩu riêng. Bản chạy thật cần ba secret: `ADMIN_EMAILS` (danh sách email cách nhau bằng dấu phẩy), `ADMIN_PASSWORD_HASHES` (JSON ánh xạ email sang SHA-256 của mật khẩu ngẫu nhiên dài, mã hóa base64url) và `ADMIN_SESSION_KEY` (khóa HMAC ngẫu nhiên 32 byte, mã hóa base64url). Không commit mật khẩu hoặc các secret vào repo. Phiên đăng nhập có cookie HttpOnly, Secure, SameSite=Lax, hết hạn sau 12 giờ; các yêu cầu ghi dữ liệu Admin phải có Origin cùng website. Đăng xuất trong thanh bên Admin.

Tài khoản Cloudflare hiện chưa bật R2. Không khai báo `BUCKET` trong bản Workers, nên chức năng tải ảnh từ Admin báo chưa cấu hình. Các ảnh sản phẩm gốc trong `public/` vẫn hiển thị. D1 của Workers mới không tự sao chép dữ liệu từ Sites; sản phẩm và KPI khởi tạo được tạo ở lần truy cập đầu. Admin cần xác nhận giá và tồn kho trước khi mở nhận đơn.

## Triển khai Sites và việc cần Form V xác nhận

`.openai/hosting.json` khai báo Sites project, D1 `DB` và R2 `BUCKET`. Sites áp dụng migration đã commit trước khi phát hành Worker. Cần cấu hình secret `ADMIN_EMAILS` cho bản chạy thật và giữ bản phát hành riêng tư cho đến khi đủ dữ liệu vận hành.

Cần Form V cung cấp hoặc xác nhận giá bán, số lượng từng mẫu, điểm và lịch nhận, khu vực/phí giao, kênh liên hệ, hướng dẫn sản phẩm, điều kiện đổi trả, nội dung bảo mật và chi tiết thanh toán. UI thể hiện phần chưa được xác nhận; không tự điền thông tin kinh doanh. Chưa tích hợp VNPay/MoMo, GA4, Meta Pixel, đồng bộ sàn hay đơn vị vận chuyển. Ghi nhận lượt truy cập nội bộ chỉ sau khi khách đồng ý. Admin cần cấu hình sao lưu D1/R2 trước khi vận hành công khai.

Xem [hợp đồng API](docs/API.md) để tích hợp và kiểm tra.
