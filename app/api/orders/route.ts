import { catalog, cleanString, database, json, userId, voucherDiscount } from "@/lib/store";

type ItemInput = { id?: unknown; quantity?: unknown };

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, any>;
    const rawItems = Array.isArray(body.items) ? body.items as ItemInput[] : [];
    if (!rawItems.length || rawItems.length > 20) return json({ error: "Giỏ hàng trống hoặc có quá nhiều sản phẩm." }, 400);
    const counts = new Map<string, number>();
    for (const item of rawItems) {
      const id = cleanString(item.id, 60);
      const quantity = Number(item.quantity);
      if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) return json({ error: "Số lượng sản phẩm không hợp lệ." }, 400);
      counts.set(id, (counts.get(id) || 0) + quantity);
    }
    const available = await catalog();
    const items = [...counts.entries()].map(([id, quantity]) => ({ product: available.find(p => p.id === id), quantity }));
    if (items.some(x => !x.product || x.quantity > x.product.stock)) return json({ error: "Sản phẩm không đủ tồn kho. Vui lòng cập nhật giỏ hàng." }, 409);

    const customerName = cleanString(body.customerName, 100);
    const phone = cleanString(body.phone, 20).replace(/[\s.-]/g, "");
    const email = cleanString(body.email, 150);
    const address = cleanString(body.address, 250);
    const province = cleanString(body.province, 100);
    const district = cleanString(body.district, 100);
    const ward = cleanString(body.ward, 100);
    const note = cleanString(body.note, 500);
    const paymentMethod = cleanString(body.paymentMethod, 30);
    if (customerName.length < 2 || !/^(0|\+84)\d{9,10}$/.test(phone) || !address || !province || !district || !ward ||
        (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) || !["cod", "bank_transfer"].includes(paymentMethod)) {
      return json({ error: "Vui lòng kiểm tra họ tên, số điện thoại, địa chỉ và phương thức thanh toán." }, 400);
    }
    const subtotal = items.reduce((sum, x) => sum + x.product!.price * x.quantity, 0);
    let voucherCode = "", discount = 0;
    try {
      const validated = await voucherDiscount(cleanString(body.voucherCode, 40).toUpperCase(), subtotal);
      voucherCode = validated.code; discount = validated.discount;
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Mã ưu đãi không hợp lệ." }, 400);
    }
    const total = subtotal - discount;
    const id = crypto.randomUUID();
    const code = `DA-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
    const now = new Date().toISOString();
    const db = database();
    const statements = [
      db.prepare("INSERT INTO orders (id,code,user_id,customer_name,phone,email,address,province,district,ward,note,payment_method,payment_status,status,subtotal,discount,shipping_fee,total,voucher_code,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'pending','pending',?,?,NULL,?,?,?,?)")
        .bind(id, code, userId(request), customerName, phone, email || null, address, province, district, ward, note || null, paymentMethod, subtotal, discount, total, voucherCode || null, now, now),
      ...items.map(x => db.prepare("UPDATE products SET stock=stock-? WHERE id=? AND active=1").bind(x.quantity, x.product!.id)),
      ...items.map(x => db.prepare("INSERT INTO order_items (id,order_id,product_id,name,image,price,quantity) VALUES (?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), id, x.product!.id, x.product!.name, x.product!.image, x.product!.price, x.quantity)),
      ...items.map(x => db.prepare("INSERT INTO inventory_transactions (id,product_id,delta,reason,reference_id,created_at) VALUES (?,?,?,'order_reservation',?,?)")
        .bind(crypto.randomUUID(), x.product!.id, -x.quantity, id, now)),
      ...(voucherCode ? [db.prepare("UPDATE vouchers SET used_count=used_count+1 WHERE code=?").bind(voucherCode)] : []),
    ];
    await db.batch(statements);
    return json({ order: { code, status: "pending", paymentStatus: "pending", paymentMethod, subtotal, discount, total, shippingFee: null, customerName, phone, address, province, district, ward, items: items.map(x => ({ name: x.product!.name, quantity: x.quantity, price: x.product!.price, image: x.product!.image, id: x.product!.id })) } }, 201);
  } catch (error) {
    const message = String(error);
    if (message.includes("CHECK constraint") || message.includes("constraint failed")) return json({ error: "Tồn kho hoặc lượt dùng mã ưu đãi vừa thay đổi. Vui lòng thử lại." }, 409);
    return json({ error: error instanceof Error ? error.message : "Không thể lưu đơn hàng." }, 500);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const db = database();
    if (url.searchParams.get("mine") === "1") {
      const uid = userId(request);
      if (!uid) return json({ error: "Vui lòng đăng nhập." }, 401);
      const result = await db.prepare("SELECT code,status,payment_status,payment_method,total,shipping_fee,created_at FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 50").bind(uid).all();
      return json({ orders: result.results || [] });
    }
    const code = cleanString(url.searchParams.get("code"), 50).toUpperCase();
    const phone = cleanString(url.searchParams.get("phone"), 20).replace(/[\s.-]/g, "");
    if (!code || !phone) return json({ error: "Cần mã đơn hàng và số điện thoại." }, 400);
    const order = await db.prepare("SELECT id,code,customer_name,address,province,district,ward,status,payment_status,payment_method,subtotal,discount,shipping_fee,total,created_at FROM orders WHERE code=? AND phone=?").bind(code, phone).first<Record<string, any>>();
    if (!order) return json({ error: "Không tìm thấy đơn hàng với thông tin đã nhập." }, 404);
    const items = await db.prepare("SELECT product_id,name,image,price,quantity FROM order_items WHERE order_id=?").bind(order.id).all();
    return json({ order: { ...order, id: undefined, items: items.results || [] } });
  } catch {
    return json({ error: "Không thể tra cứu đơn hàng." }, 500);
  }
}
