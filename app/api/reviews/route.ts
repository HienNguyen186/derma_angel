import { cleanString, database, json } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const code = cleanString(body.code, 50).toUpperCase();
    const phone = cleanString(body.phone, 20).replace(/[\s.-]/g, "");
    const productId = cleanString(body.productId, 60);
    const rating = Number(body.rating);
    const reviewBody = cleanString(body.body, 1000);
    if (!code || !phone || !productId || !Number.isInteger(rating) || rating < 1 || rating > 5 || reviewBody.length < 8) return json({ error: "Thông tin đánh giá chưa hợp lệ." }, 400);
    const db = database();
    const order = await db.prepare("SELECT o.id,o.customer_name FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.code=? AND o.phone=? AND o.status='delivered' AND oi.product_id=?").bind(code, phone, productId).first<Record<string, any>>();
    if (!order) return json({ error: "Chỉ có thể đánh giá sản phẩm trong đơn hàng đã giao." }, 403);
    const previous = await db.prepare("SELECT id FROM reviews WHERE order_id=? AND product_id=?").bind(order.id, productId).first();
    if (previous) return json({ error: "Sản phẩm này đã được đánh giá cho đơn hàng." }, 409);
    await db.prepare("INSERT INTO reviews (id,order_id,product_id,rating,body,display_name,phone,status,created_at) VALUES (?,?,?,?,?,?,?,'pending',?)")
      .bind(crypto.randomUUID(), order.id, productId, rating, reviewBody, order.customer_name, phone, new Date().toISOString()).run();
    return json({ message: "Đánh giá đã được gửi và đang chờ duyệt." }, 201);
  } catch {
    return json({ error: "Không thể gửi đánh giá." }, 500);
  }
}
