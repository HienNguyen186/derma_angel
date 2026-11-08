import { cleanString, database, json } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const source = body.source === "direct" ? "direct" : "website_order";
    const code = cleanString(body.code, 50).toUpperCase();
    const phone = cleanString(body.phone, 20).replace(/[\s.-]/g, "");
    const productId = cleanString(body.productId, 60);
    const rating = Number(body.rating);
    const reviewBody = cleanString(body.body, 1000);
    const displayName = cleanString(body.displayName, 80);
    const requestKey = cleanString(body.requestKey, 60);
    if (!productId || !displayName || !Number.isInteger(rating) || rating < 1 || rating > 5 || body.consentPublic !== true) {
      return json({ error: "Vui lòng chọn thiết kế, tên hiển thị, số sao và đồng ý công khai đánh giá." }, 400);
    }
    const db = database();
    const product = await db.prepare("SELECT id FROM products WHERE id=? AND active=1").bind(productId).first();
    if (!product) return json({ error: "Thiết kế này hiện không còn trên website." }, 400);
    let orderId: string | null = null;
    if (source === "website_order") {
      if (!/^(0|\+84)\d{9,10}$/.test(phone)) return json({ error: "Số điện thoại đặt hàng cần đủ 10–11 chữ số." }, 400);
      if (!/^DA-[A-Z0-9]+-[A-Z0-9]{5}$/.test(code)) return json({ error: "Vui lòng nhập mã đơn được website cấp sau khi gửi yêu cầu đặt hàng." }, 400);
      const order = await db.prepare("SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.code=? AND o.phone=? AND o.status='delivered' AND o.payment_status='paid' AND oi.product_id=?")
        .bind(code, phone, productId).first<{ id: string }>();
      if (!order) return json({ error: "Không tìm thấy đơn đã thanh toán và giao xong khớp với mã, số điện thoại và thiết kế này. Hãy kiểm tra mục Tra cứu đơn hàng." }, 403);
      orderId = order.id;
      const previous = await db.prepare("SELECT id FROM reviews WHERE order_id=?").bind(orderId).first();
      if (previous) return json({ error: "Đơn hàng này đã có đánh giá." }, 409);
    } else if (!/^[a-f0-9-]{36}$/i.test(requestKey)) {
      return json({ error: "Phiên gửi đánh giá không hợp lệ. Vui lòng tải lại trang." }, 400);
    } else {
      const previous = await db.prepare("SELECT id FROM reviews WHERE request_key=?").bind(requestKey).first();
      if (previous) return json({ message: "Đánh giá đã được tiếp nhận và đang chờ duyệt.", repeated: true });
    }
    await db.prepare("INSERT INTO reviews (id,order_id,product_id,rating,body,display_name,phone,status,created_at,consent_public,source,request_key) VALUES (?,?,?,?,?,?,?,'pending',?,1,?,?)")
      .bind(crypto.randomUUID(), orderId, productId, rating, reviewBody, displayName, "", new Date().toISOString(), source, source === "direct" ? requestKey : null).run();
    return json({ message: "Đánh giá đã được tiếp nhận và đang chờ Admin duyệt." }, 201);
  } catch (error) {
    if (String(error).includes("reviews_order_unique")) return json({ error: "Đơn hàng này đã có đánh giá." }, 409);
    if (String(error).includes("reviews_request_key_unique")) return json({ message: "Đánh giá đã được tiếp nhận và đang chờ duyệt.", repeated: true });
    return json({ error: "Chưa gửi được đánh giá. Bạn thử lại nhé." }, 500);
  }
}
