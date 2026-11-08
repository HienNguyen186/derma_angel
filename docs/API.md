# HTTP API

Phản hồi JSON dùng `Cache-Control: no-store`. Tất cả thao tác thay đổi dữ liệu được kiểm tra tại server. API Admin yêu cầu email đã xác thực trong `ADMIN_EMAILS`.

| Endpoint | Method | Nội dung |
|---|---|---|
| `/api/catalog` | GET | Sản phẩm, cờ xác nhận giá/tồn, đánh giá đã duyệt, cài đặt công khai và voucher đang hiệu lực. `?id=<id>` lấy chi tiết và đánh giá của sản phẩm. |
| `/api/voucher` | POST | Xem trước `{code,subtotal}`. Khi đặt hàng server tính lại. |
| `/api/orders` | POST | Gửi yêu cầu `{requestKey,items:[{id,quantity}],customerName,phone,email?,receiveMethod:"pickup"|"delivery",address?,province?,ward?,district?,note?,voucherCode?,orderConsent:true}`. `requestKey` là UUID cho một lần gửi; gửi lại cùng key và số điện thoại trả cùng đơn. |
| `/api/orders?code=...&phone=...` | GET | Tra cứu đơn bằng mã và số điện thoại. |
| `/api/reviews` | POST | `{source:"direct"|"website_order",productId,displayName,rating,body?,consentPublic:true,requestKey?}`. `direct` không cần mã đơn, cần UUID `requestKey` để chống gửi lặp; `website_order` cần thêm `code,phone`, chỉ đơn đã thanh toán và giao xong, một đánh giá/đơn. Cả hai đều chờ Admin duyệt. |
| `/api/visit` | POST | `{path,consent:true,sessionId}` với UUID phiên. Mỗi phiên/ngày theo múi giờ Việt Nam chỉ ghi một lần; có thể gửi lại an toàn. |
| `/api/admin` | GET | Dữ liệu Admin; `?export=orders` và `?export=kpis` xuất CSV. |
| `/api/admin` | POST | Thay đổi do Admin thực hiện qua `action` bên dưới. |
| `/api/admin/upload` | POST | Multipart `kind=product|evidence`, `file`; minh chứng thêm `kpiKey,title,collectedAt,note?`. Tối đa 8 MB. |
| `/api/assets/<key>` | GET | Ảnh sản phẩm công khai; minh chứng chỉ Admin đọc được. |

## Admin actions

- `product`: `{id?,name,sku,mood,description,image,price,priceConfirmed,stock,stockConfirmed,active,featured}`. Giá và tồn kho chưa xác nhận không được đưa vào luồng mua. Thay đổi tồn tạo giao dịch kho.
- `settings`: `{pickupEnabled,deliveryEnabled,pickupLocation,contactUrl,shippingPolicy,returnPolicy,privacyContact}`. Bật nhận trực tiếp cần điểm nhận; bật giao hàng cần thông tin giao hàng. URL liên hệ cần HTTPS.
- `order_status`: `{id,status,paymentStatus,shippingFee,paidAmount,refundedAmount}`. Trạng thái đơn: `pending`, `confirmed`, `processing`, `shipping`, `delivered`, `cancelled`, `refunded`; thanh toán: `pending`, `paid`, `refunded`. Giao xong yêu cầu ghi đủ số tiền thực thu. Mọi lần đổi trạng thái có lịch sử.
- `voucher`: `{code,kind:"fixed"|"percent",amount,minSubtotal,maxUses?,startsAt?,endsAt?,active}`. Điều kiện, hạn dùng và số lượt được kiểm tra lại ở checkout.
- `review`: `{id,status:"approved"|"rejected"}`. Admin thấy nguồn đánh giá trực tiếp hoặc đơn website đã đối chiếu. Chỉ đánh giá đã duyệt xuất hiện công khai.
- `kpi`: `{key,target,actual,source:"seed"|"manual"|"auto",note?}`. Key gồm `visits`, `revenue`, `conversion`, `rating`. `conversion` không nhận `auto` khi chưa có dữ liệu đối soát. Mỗi lần sửa có lịch sử.
- `evidence`: `{kpiKey,title,url,note?,collectedAt}` cho liên kết HTTPS; file qua endpoint upload.
- `channel_report`: `{month:"YYYY-MM",channel,units,revenue,marketingCost,promotionCost,note?}`. Kênh website không được nhập ở đây vì doanh thu website được tổng hợp riêng.
- `campaign`: `{id?,name,description,startsAt?,endsAt?,active}`.

Lỗi trả `{error}` cùng HTTP status phù hợp: `400` dữ liệu sai, `403` không đủ quyền/điều kiện đánh giá, `404` không tìm thấy, `409` xung đột tồn kho, voucher hoặc đánh giá đã gửi.
