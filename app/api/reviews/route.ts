import { cleanString, database, json } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const code = cleanString(body.code, 50).toUpperCase();
    const phone = cleanString(body.phone, 20).replace(/[\s.-]/g, "");
    const productId = cleanString(body.productId, 60);
    const rating = Number(body.rating);
    const reviewBody = cleanString(body.body, 1000);
    const displayName = cleanString(body.displayName, 80);
    if (!code || !/^(0|\+84)\d{9,10}$/.test(phone) || !productId || !displayName || !Number.isInteger(rating) || rating < 1 || rating > 5 || body.consentPublic !== true) return json({ error: "Vui lòng điền mã đơn, số điện thoại, tên hiển thị, số sao và đồng ý công khai đánh giá." }, 400);
    const db = database();
    const order = await db.prepare("SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.code=? AND o.phone=? AND o.status='delivered' AND o.payment_status='paid' AND oi.product_id=?").bind(code, phone, productId).first<Record<string, any>>();
    if (!order) return json({ error: "Đơn hàng này chưa đủ điều kiện đánh giá hoặc thông tin chưa đúng." }, 403);
    const previous = await db.prepare("SELECT id FROM reviews WHERE order_id=?").bind(order.id).first();
    if (previous) return json({ error: "Đơn hàng này đã có đánh giá." }, 409);
    await db.prepare("INSERT INTO reviews (id,order_id,product_id,rating,body,display_name,phone,status,created_at,consent_public) VALUES (?,?,?,?,?,?,?,'pending',?,1)")
      .bind(crypto.randomUUID(), order.id, productId, rating, reviewBody, displayName, "", new Date().toISOString()).run();
    return json({ message: "Cảm ơn bạn đã chia sẻ trải nghiệm! Đánh giá đã được tiếp nhận." }, 201);
  } catch (error) {
    if (String(error).includes("reviews_order_unique")) return json({ error: "Đơn hàng này đã có đánh giá." }, 409);
    return json({ error: "Chưa gửi được đánh giá. Bạn thử lại nhé." }, 500);
  }
}
