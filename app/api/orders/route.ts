import { catalog, cleanString, database, json, publicStoreSettings, userId, voucherDiscount } from "@/lib/store";

type ItemInput = { id?: unknown; quantity?: unknown };

export async function POST(request: Request) {
  let requestKey = "";
  let clientPhone = "";
  try {
    const body = await request.json() as Record<string, any>;
    requestKey = cleanString(body.requestKey, 60);
    const phone = cleanString(body.phone, 20).replace(/[\s.-]/g, "");
    clientPhone = phone;
    if (!/^[a-f0-9-]{36}$/i.test(requestKey)) return json({ error: "Phiên gửi yêu cầu không hợp lệ. Vui lòng tải lại trang." }, 400);
    const db = database();
    const existing = await db.prepare("SELECT id,code,status,payment_status,total,customer_name,phone FROM orders WHERE request_key=?").bind(requestKey).first<Record<string, any>>();
    if (existing) return existing.phone === phone ? json({ order: { ...existing, phone }, repeated: true }) : json({ error: "Phiên yêu cầu không hợp lệ." }, 409);
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
    if (items.some(x => !x.product || !x.product.active || !x.product.price_confirmed || !x.product.stock_confirmed || x.quantity > x.product.stock)) return json({ error: "Giá hoặc tồn kho sản phẩm chưa được xác nhận, hoặc số lượng không còn đủ. Vui lòng kiểm tra giỏ hàng." }, 409);

    const customerName = cleanString(body.customerName, 100);
    const email = cleanString(body.email, 150);
    const address = cleanString(body.address, 250);
    const province = cleanString(body.province, 100);
    const district = cleanString(body.district, 100);
    const ward = cleanString(body.ward, 100);
    const note = cleanString(body.note, 500);
    const receiveMethod = cleanString(body.receiveMethod, 20);
    const settings = await publicStoreSettings();
    if (customerName.length < 2 || !/^(0|\+84)\d{9,10}$/.test(phone) ||
        (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) || body.orderConsent !== true ||
        !["pickup", "delivery"].includes(receiveMethod) ||
        (receiveMethod === "pickup" && (!settings.pickup_enabled || !settings.pickup_location)) ||
        (receiveMethod === "delivery" && (!settings.delivery_enabled || !address || !province || !ward))) {
      return json({ error: "Vui lòng kiểm tra thông tin liên hệ, hình thức nhận hàng, địa chỉ và đồng ý xử lý dữ liệu." }, 400);
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
    const deliveryAddress = receiveMethod === "pickup" ? settings.pickup_location : address;
    const shippingFee = receiveMethod === "pickup" ? 0 : null;
    const statements = [
      db.prepare("INSERT INTO orders (id,code,user_id,customer_name,phone,email,address,province,district,ward,note,payment_method,payment_status,status,subtotal,discount,shipping_fee,total,voucher_code,created_at,updated_at,receive_method,request_key,consent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending','pending',?,?,?,?,?,?,?,?,?,?)")
        .bind(id, code, userId(request), customerName, phone, email || null, deliveryAddress, receiveMethod === "pickup" ? "" : province, receiveMethod === "pickup" ? "" : district, receiveMethod === "pickup" ? "" : ward, note || null, "manual", subtotal, discount, shippingFee, total, voucherCode || null, now, now, receiveMethod, requestKey, now),
      ...items.map(x => db.prepare("UPDATE products SET stock=CASE WHEN active=1 AND price_confirmed=1 AND stock_confirmed=1 AND price=? THEN stock-? ELSE -1 END WHERE id=?").bind(x.product!.price, x.quantity, x.product!.id)),
      ...items.map(x => db.prepare("INSERT INTO order_items (id,order_id,product_id,name,image,price,quantity) VALUES (?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), id, x.product!.id, x.product!.name, x.product!.image, x.product!.price, x.quantity)),
      ...items.map(x => db.prepare("INSERT INTO inventory_transactions (id,product_id,delta,reason,reference_id,created_at) VALUES (?,?,?,'order_reservation',?,?)")
        .bind(crypto.randomUUID(), x.product!.id, -x.quantity, id, now)),
      ...(voucherCode ? [db.prepare("UPDATE vouchers SET used_count=used_count+1 WHERE code=?").bind(voucherCode)] : []),
      db.prepare("INSERT INTO order_status_history (id,order_id,old_status,new_status,old_payment_status,new_payment_status,actor,created_at) VALUES (?,?,NULL,'pending',NULL,'pending','customer',?)").bind(crypto.randomUUID(), id, now),
    ];
    await db.batch(statements);
    return json({ order: { code, status: "pending", paymentStatus: "pending", paymentMethod: "manual", receiveMethod, subtotal, discount, total, shippingFee, customerName, phone, address: deliveryAddress, province, district, ward, items: items.map(x => ({ name: x.product!.name, quantity: x.quantity, price: x.product!.price, image: x.product!.image, id: x.product!.id })) } }, 201);
  } catch (error) {
    const message = String(error);
    if (message.includes("orders_request_key_unique") && requestKey) {
      const saved = await database().prepare("SELECT code,status,payment_status,total,customer_name,phone FROM orders WHERE request_key=?").bind(requestKey).first<Record<string, any>>();
      if (saved && saved.phone === clientPhone) return json({ order: saved, repeated: true });
    }
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
    const order = await db.prepare("SELECT id,code,customer_name,address,province,district,ward,status,payment_status,payment_method,receive_method,subtotal,discount,shipping_fee,total,created_at FROM orders WHERE code=? AND phone=?").bind(code, phone).first<Record<string, any>>();
    if (!order) return json({ error: "Không tìm thấy đơn hàng với thông tin đã nhập." }, 404);
    const items = await db.prepare("SELECT product_id,name,image,price,quantity FROM order_items WHERE order_id=?").bind(order.id).all();
    return json({ order: { ...order, id: undefined, items: items.results || [] } });
  } catch {
    return json({ error: "Không thể tra cứu đơn hàng." }, 500);
  }
}
