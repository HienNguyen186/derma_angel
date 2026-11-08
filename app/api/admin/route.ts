import { adminAuthorized, catalog, cleanString, database, ensureSeed, json } from "@/lib/store";

const statuses = ["pending", "confirmed", "processing", "shipping", "delivered", "cancelled", "refunded"];
const channels = ["Shopee Mall", "TikTok Shop", "Sociolla", "Lazada", "Offline Retail", "Khác"];

async function dashboard() {
  await ensureSeed();
  const db = database();
  const [products, orders, kpis, evidence, vouchers, reviews, reports, campaigns, inventory, visits, orderStats, rating, history, revenueSeries, visitSeries, productSales, ratingDistribution, settings] = await Promise.all([
    catalog(true),
    db.prepare("SELECT o.*, (SELECT GROUP_CONCAT(oi.name || ' × ' || oi.quantity, ', ') FROM order_items oi WHERE oi.order_id=o.id) items_summary FROM orders o ORDER BY o.created_at DESC LIMIT 200").all(),
    db.prepare("SELECT * FROM kpis ORDER BY CASE key WHEN 'visits' THEN 1 WHEN 'revenue' THEN 2 WHEN 'conversion' THEN 3 ELSE 4 END").all(),
    db.prepare("SELECT * FROM evidence ORDER BY created_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM vouchers ORDER BY code").all(),
    db.prepare("SELECT r.id,r.order_id,r.product_id,r.rating,r.body,r.display_name,r.status,r.created_at,p.name product_name FROM reviews r JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC LIMIT 100").all(),
    db.prepare("SELECT * FROM channel_reports ORDER BY month DESC,channel").all(),
    db.prepare("SELECT * FROM campaigns ORDER BY starts_at DESC").all(),
    db.prepare("SELECT t.*,p.name product_name FROM inventory_transactions t JOIN products p ON p.id=t.product_id ORDER BY t.created_at DESC LIMIT 100").all(),
    db.prepare("SELECT COUNT(*) count FROM visits").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) orders, COUNT(CASE WHEN status NOT IN ('cancelled','refunded') THEN 1 END) valid_orders, COALESCE(SUM(CASE WHEN payment_status='paid' AND status='delivered' THEN MAX(0,subtotal-discount-refunded_amount) ELSE 0 END),0) paid_revenue, COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','refunded') THEN total ELSE 0 END),0) order_value, COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o2 ON o2.id=oi.order_id WHERE o2.status NOT IN ('cancelled','refunded')),0) units, COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o2 ON o2.id=oi.order_id WHERE o2.payment_status='paid' AND o2.status='delivered'),0) paid_units FROM orders").first<Record<string, number>>(),
    db.prepare("SELECT ROUND(AVG(rating),1) average, COUNT(*) count FROM reviews WHERE status='approved'").first<Record<string, number>>(),
    db.prepare("SELECT * FROM kpi_history ORDER BY created_at DESC LIMIT 100").all(),
    db.prepare("SELECT substr(delivered_at,1,10) day, SUM(MAX(0,subtotal-discount-refunded_amount)) revenue, COUNT(*) orders FROM orders WHERE payment_status='paid' AND status='delivered' AND delivered_at IS NOT NULL GROUP BY substr(delivered_at,1,10) ORDER BY day DESC LIMIT 60").all(),
    db.prepare("SELECT substr(created_at,1,10) day, COUNT(*) visits FROM visits GROUP BY substr(created_at,1,10) ORDER BY day DESC LIMIT 60").all(),
    db.prepare("SELECT p.name, COALESCE(SUM(CASE WHEN o.payment_status='paid' AND o.status='delivered' THEN oi.quantity ELSE 0 END),0) units FROM products p LEFT JOIN order_items oi ON oi.product_id=p.id LEFT JOIN orders o ON o.id=oi.order_id GROUP BY p.id ORDER BY units DESC").all(),
    db.prepare("SELECT rating, COUNT(*) count FROM reviews WHERE status='approved' GROUP BY rating ORDER BY rating").all(),
    db.prepare("SELECT * FROM store_settings WHERE id='main'").first(),
  ]);
  const measuredVisits = visits?.count || 0;
  const measuredOrders = orderStats?.valid_orders || 0;
  return {
    products, orders: orders.results || [], kpis: kpis.results || [], evidence: evidence.results || [], settings,
    vouchers: vouchers.results || [], reviews: reviews.results || [], reports: reports.results || [],
    campaigns: campaigns.results || [], inventory: inventory.results || [], history: history.results || [],
    revenueSeries: (revenueSeries.results || []).reverse(), visitSeries: (visitSeries.results || []).reverse(),
    productSales: productSales.results || [], ratingDistribution: ratingDistribution.results || [],
    measured: {
      visits: measuredVisits,
      orders: measuredOrders,
      paidRevenue: orderStats?.paid_revenue || 0,
      orderValue: orderStats?.order_value || 0,
      units: orderStats?.units || 0,
      paidUnits: orderStats?.paid_units || 0,
      conversion: null,
      rating: rating?.average || null,
      reviewCount: rating?.count || 0,
    },
    channels, campaignTarget: { units: 90000, revenue: 5670000000, months: [
      { month: "2026-11", units: 27000 }, { month: "2026-12", units: 45000 }, { month: "2027-01", units: 18000 },
    ] },
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/^[=+\-@]/, "'$&");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  if (!adminAuthorized(request)) return json({ error: "Không có quyền quản trị." }, 403);
  try {
    const data = await dashboard();
    const exportType = new URL(request.url).searchParams.get("export");
    if (exportType === "orders") {
      const columns = ["code", "created_at", "customer_name", "phone", "receive_method", "status", "payment_status", "items_summary", "subtotal", "discount", "shipping_fee", "total", "paid_amount", "refunded_amount", "paid_at", "delivered_at"];
      const lines = [columns.join(","), ...(data.orders as Record<string, unknown>[]).map(row => columns.map(key => csvCell(row[key])).join(","))];
      return new Response("\uFEFF" + lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=dermaangel-orders.csv" } });
    }
    if (exportType === "kpis") {
      const columns = ["key", "label", "target", "actual", "unit", "source", "note", "updated_at"];
      const lines = [columns.join(","), ...(data.kpis as Record<string, unknown>[]).map(row => columns.map(key => csvCell(row[key])).join(","))];
      return new Response("\uFEFF" + lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=dermaangel-website-kpis.csv" } });
    }
    return json(data);
  } catch (error) {
    return json({ error: "Không tải được dữ liệu quản trị.", detail: String(error) }, 500);
  }
}

export async function POST(request: Request) {
  if (!adminAuthorized(request)) return json({ error: "Không có quyền quản trị." }, 403);
  try {
    const body = await request.json() as Record<string, any>;
    const action = cleanString(body.action, 40);
    const db = database();
    const now = new Date().toISOString();
    await ensureSeed();

    if (action === "product") {
      const id = cleanString(body.id, 60) || crypto.randomUUID();
      const name = cleanString(body.name, 100), sku = cleanString(body.sku, 50), mood = cleanString(body.mood, 80);
      const description = cleanString(body.description, 1000), image = cleanString(body.image, 300) || "/product-sheet.png";
      const price = Number(body.price), stock = Number(body.stock);
      if (!name || !sku || !mood || !Number.isInteger(price) || price < 0 || !Number.isInteger(stock) || stock < 0 ||
          !(image === "/product-sheet.png" || /^\/api\/assets\/products-[a-f0-9-]+$/.test(image))) return json({ error: "Thông tin sản phẩm không hợp lệ." }, 400);
      const old = await db.prepare("SELECT stock FROM products WHERE id=?").bind(id).first<{stock:number}>();
      await db.batch([
        db.prepare("INSERT INTO products (id,name,sku,mood,description,image,price,price_confirmed,stock,stock_confirmed,active,featured,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,sku=excluded.sku,mood=excluded.mood,description=excluded.description,image=excluded.image,price=excluded.price,price_confirmed=excluded.price_confirmed,stock=excluded.stock,stock_confirmed=excluded.stock_confirmed,active=excluded.active,featured=excluded.featured")
          .bind(id, name, sku, mood, description, image, price, body.priceConfirmed ? 1 : 0, stock, body.stockConfirmed ? 1 : 0, body.active ? 1 : 0, body.featured ? 1 : 0, now),
        ...(stock !== (old?.stock || 0) ? [db.prepare("INSERT INTO inventory_transactions (id,product_id,delta,reason,reference_id,created_at) VALUES (?,?,?,'admin_adjustment',NULL,?)").bind(crypto.randomUUID(), id, stock - (old?.stock || 0), now)] : []),
      ]);
      return json({ ok: true, id });
    }

    if (action === "settings") {
      const pickupLocation = cleanString(body.pickupLocation, 300);
      const contactUrl = cleanString(body.contactUrl, 500);
      const shippingPolicy = cleanString(body.shippingPolicy, 1500);
      const returnPolicy = cleanString(body.returnPolicy, 1500);
      const privacyContact = cleanString(body.privacyContact, 200);
      if ((body.pickupEnabled && !pickupLocation) || (body.deliveryEnabled && !shippingPolicy) ||
          (contactUrl && !/^https:\/\//.test(contactUrl))) return json({ error: "Cần địa điểm nhận, thông tin giao hàng và liên kết liên hệ hợp lệ trước khi bật." }, 400);
      await db.prepare("UPDATE store_settings SET pickup_enabled=?,delivery_enabled=?,pickup_location=?,contact_url=?,shipping_policy=?,return_policy=?,privacy_contact=? WHERE id='main'")
        .bind(body.pickupEnabled ? 1 : 0, body.deliveryEnabled ? 1 : 0, pickupLocation, contactUrl, shippingPolicy, returnPolicy, privacyContact).run();
      return json({ ok: true });
    }

    if (action === "order_status") {
      const id = cleanString(body.id, 60), status = cleanString(body.status, 30);
      const paymentStatus = cleanString(body.paymentStatus, 30);
      const shippingFee = body.shippingFee === "" || body.shippingFee == null ? null : Number(body.shippingFee);
      const paidAmount = Number(body.paidAmount ?? 0);
      const refundedAmount = Number(body.refundedAmount ?? 0);
      if (!statuses.includes(status) || !["pending", "paid", "refunded"].includes(paymentStatus)) return json({ error: "Trạng thái không hợp lệ." }, 400);
      if (shippingFee !== null && (!Number.isInteger(shippingFee) || shippingFee < 0)) return json({ error: "Phí vận chuyển không hợp lệ." }, 400);
      if (![paidAmount,refundedAmount].every(x => Number.isInteger(x) && x >= 0) || refundedAmount > paidAmount) return json({ error: "Số tiền đã thu hoặc hoàn không hợp lệ." }, 400);
      const old = await db.prepare("SELECT status,voucher_code,subtotal,discount,shipping_fee,payment_status,paid_amount,refunded_amount,receive_method FROM orders WHERE id=?").bind(id).first<{status:string;voucher_code:string|null;subtotal:number;discount:number;shipping_fee:number|null;payment_status:string;paid_amount:number;refunded_amount:number;receive_method:string}>();
      if (!old) return json({ error: "Không tìm thấy đơn hàng." }, 404);
      if (["cancelled", "refunded"].includes(old.status) && status !== old.status) return json({ error: "Đơn đã hủy hoặc hoàn tiền không thể mở lại." }, 400);
      if (status === "cancelled" && ["shipping", "delivered"].includes(old.status)) return json({ error: "Đơn đã giao vận không thể hủy; hãy xử lý hoàn tiền riêng." }, 400);
      if (!["pending", "cancelled", "refunded"].includes(status) && shippingFee === null) return json({ error: "Hãy xác nhận phí vận chuyển trước khi xử lý đơn (nhập 0 nếu miễn phí)." }, 400);
      if (old.payment_status === "paid" && shippingFee !== old.shipping_fee) return json({ error: "Không thể đổi tổng tiền sau khi đã ghi nhận thanh toán." }, 400);
      const due = old.subtotal-old.discount+(shippingFee || 0);
      if (paymentStatus === "paid" && paidAmount < due) return json({ error: "Chỉ đánh dấu đã thanh toán sau khi ghi đủ số tiền thực thu." }, 400);
      if (status === "delivered" && paymentStatus !== "paid") return json({ error: "Chỉ hoàn tất đơn sau khi đã thu tiền và bàn giao hàng." }, 400);
      if (status === "cancelled" && old.payment_status === "paid") return json({ error: "Đơn đã thu tiền cần xử lý hoàn tiền riêng." }, 400);
      if (status === "refunded" && (!paidAmount || !refundedAmount || paymentStatus !== "refunded")) return json({ error: "Cần ghi số tiền hoàn và trạng thái hoàn tiền." }, 400);
      const restock = old.status !== "cancelled" && status === "cancelled";
      const items = restock ? (await db.prepare("SELECT product_id,quantity FROM order_items WHERE order_id=?").bind(id).all<{product_id:string;quantity:number}>()).results : [];
      await db.batch([
        db.prepare("UPDATE orders SET status=?,payment_status=?,shipping_fee=?,total=?,paid_amount=?,refunded_amount=?,paid_at=CASE WHEN ?='paid' AND paid_at IS NULL THEN ? ELSE paid_at END,delivered_at=CASE WHEN ?='delivered' AND delivered_at IS NULL THEN ? ELSE delivered_at END,updated_at=? WHERE id=?").bind(status, paymentStatus, shippingFee, due, paidAmount, refundedAmount, paymentStatus, now, status, now, now, id),
        db.prepare("INSERT INTO order_status_history (id,order_id,old_status,new_status,old_payment_status,new_payment_status,actor,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), id, old.status, status, old.payment_status, paymentStatus, request.headers.get("oai-authenticated-user-email") || "admin", now),
        ...(items || []).flatMap(item => [
          db.prepare("UPDATE products SET stock=stock+? WHERE id=?").bind(item.quantity, item.product_id),
          db.prepare("INSERT INTO inventory_transactions (id,product_id,delta,reason,reference_id,created_at) VALUES (?,?,?, 'order_return', ?,?)").bind(crypto.randomUUID(), item.product_id, item.quantity, id, now),
        ]),
        ...(restock && old.voucher_code ? [db.prepare("UPDATE vouchers SET used_count=MAX(0,used_count-1) WHERE code=?").bind(old.voucher_code)] : []),
      ]);
      return json({ ok: true });
    }

    if (action === "voucher") {
      const code = cleanString(body.code, 40).toUpperCase(), kind = cleanString(body.kind, 20);
      const amount = Number(body.amount), minSubtotal = Number(body.minSubtotal || 0);
      const maxUses = body.maxUses === "" || body.maxUses == null ? null : Number(body.maxUses);
      const startsAt = cleanString(body.startsAt, 40) || null, endsAt = cleanString(body.endsAt, 40) || null;
      if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !["percent", "fixed"].includes(kind) || !Number.isInteger(amount) || amount <= 0 ||
          (kind === "percent" && amount > 100) || !Number.isInteger(minSubtotal) || minSubtotal < 0 ||
          (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) || (startsAt && endsAt && startsAt >= endsAt)) return json({ error: "Cấu hình voucher không hợp lệ." }, 400);
      await db.prepare("INSERT INTO vouchers (code,kind,amount,min_subtotal,max_uses,used_count,starts_at,ends_at,active) VALUES (?,?,?,?,?,0,?,?,?) ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,amount=excluded.amount,min_subtotal=excluded.min_subtotal,max_uses=excluded.max_uses,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active")
        .bind(code, kind, amount, minSubtotal, maxUses, startsAt, endsAt, body.active ? 1 : 0).run();
      return json({ ok: true });
    }

    if (action === "kpi") {
      const key = cleanString(body.key, 30), source = cleanString(body.source, 20);
      const target = Number(body.target), actual = Number(body.actual);
      if (!["visits", "revenue", "conversion", "rating"].includes(key) || !["seed", "manual", "auto"].includes(source) ||
          (key === "conversion" && source === "auto") ||
          !Number.isFinite(target) || !Number.isFinite(actual) || target <= 0 || actual < 0 ||
          ((key === "rating" && (target > 5 || actual > 5)) || (key === "conversion" && (target > 100 || actual > 100)))) return json({ error: "KPI không hợp lệ." }, 400);
      const previous = await db.prepare("SELECT target,actual,source FROM kpis WHERE key=?").bind(key).first<{target:number;actual:number;source:string}>();
      if (!previous) return json({ error: "Không tìm thấy KPI." }, 404);
      await db.batch([
        db.prepare("UPDATE kpis SET target=?,actual=?,source=?,note=?,updated_at=? WHERE key=?").bind(target, actual, source, cleanString(body.note, 500), now, key),
        db.prepare("INSERT INTO kpi_history (id,kpi_key,previous_target,previous_actual,previous_source,target,actual,source,changed_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), key, previous.target, previous.actual, previous.source, target, actual, source, request.headers.get("oai-authenticated-user-email") || "admin", now),
      ]);
      return json({ ok: true });
    }

    if (action === "evidence") {
      const kpiKey = cleanString(body.kpiKey, 30), title = cleanString(body.title, 120);
      const url = cleanString(body.url, 500), note = cleanString(body.note, 500), collectedAt = cleanString(body.collectedAt, 30);
      if (!["visits", "revenue", "conversion", "rating"].includes(kpiKey) || !title || !/^https:\/\//.test(url) || !/^\d{4}-\d{2}-\d{2}$/.test(collectedAt)) return json({ error: "Minh chứng cần tiêu đề, liên kết HTTPS và ngày thu thập." }, 400);
      await db.prepare("INSERT INTO evidence (id,kpi_key,title,url,note,collected_at,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), kpiKey, title, url, note || null, collectedAt, now).run();
      return json({ ok: true });
    }

    if (action === "review") {
      const id = cleanString(body.id, 60), status = cleanString(body.status, 20);
      if (!["approved", "rejected"].includes(status)) return json({ error: "Trạng thái đánh giá không hợp lệ." }, 400);
      await db.prepare("UPDATE reviews SET status=? WHERE id=?").bind(status, id).run();
      return json({ ok: true });
    }

    if (action === "channel_report") {
      const month = cleanString(body.month, 7), channel = cleanString(body.channel, 40);
      const units = Number(body.units), revenue = Number(body.revenue), marketingCost = Number(body.marketingCost || 0), promotionCost = Number(body.promotionCost || 0);
      if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || !channels.includes(channel) ||
          [units,revenue,marketingCost,promotionCost].some(x => !Number.isInteger(x) || x < 0)) return json({ error: "Báo cáo kênh không hợp lệ." }, 400);
      await db.prepare("INSERT INTO channel_reports (id,month,channel,units,revenue,marketing_cost,promotion_cost,source,note,created_at) VALUES (?,?,?,?,?,?,?,'manual',?,?)")
        .bind(crypto.randomUUID(), month, channel, units, revenue, marketingCost, promotionCost, cleanString(body.note, 500) || null, now).run();
      return json({ ok: true });
    }

    if (action === "campaign") {
      const id = cleanString(body.id, 60) || crypto.randomUUID(), name = cleanString(body.name, 120);
      const description = cleanString(body.description, 1000), startsAt = cleanString(body.startsAt, 30) || null, endsAt = cleanString(body.endsAt, 30) || null;
      if (!name || (startsAt && endsAt && startsAt >= endsAt)) return json({ error: "Thông tin chiến dịch không hợp lệ." }, 400);
      await db.prepare("INSERT INTO campaigns (id,name,description,starts_at,ends_at,active) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active")
        .bind(id, name, description, startsAt, endsAt, body.active ? 1 : 0).run();
      return json({ ok: true });
    }

    return json({ error: "Thao tác không được hỗ trợ." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Không lưu được thay đổi." }, 500);
  }
}
