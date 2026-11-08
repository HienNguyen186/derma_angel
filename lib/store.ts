import { env } from "cloudflare:workers";

export type Product = {
  id: string; name: string; sku: string; mood: string; description: string;
  image: string; price: number; price_confirmed: number; stock: number; stock_confirmed: number; active: number; featured: number;
  created_at: string; rating?: number | null; review_count?: number; sold?: number;
};

export function database(): D1Database {
  if (!env.DB) throw new Error("Database binding DB is unavailable");
  return env.DB;
}

export function adminAuthorized(request: Request): boolean {
  const email = request.headers.get("oai-authenticated-user-email")?.toLowerCase();
  const allowed = (env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email);
}

export function userId(request: Request): string | null {
  return request.headers.get("oai-authenticated-user-id");
}

export const seedProducts = [
  ["glitter", "Glitter", "DA-ABP-GLI", "Lấp lánh", "Một chút lấp lánh cho ngày bạn muốn nổi bật. Chọn Glitter để thêm điểm nhấn vui tươi cho phong cách của mình."],
  ["panda", "Panda", "DA-ABP-PAN", "Dịu dàng", "Dịu dàng, gần gũi và có chút đáng yêu. Panda dành cho những ngày bạn muốn chọn một nét nhỏ thật dễ thương."],
  ["cute-paws", "Cute Paws", "DA-ABP-PAW", "Tinh nghịch", "Một chút tinh nghịch từ những dấu chân xinh. Cute Paws cùng bạn thêm nét vui nhộn cho diện mạo hằng ngày."],
  ["hologram", "Hologram", "DA-ABP-HOL", "Mộng mơ", "Đổi góc nhìn, đổi sắc màu. Hologram dành cho những ngày bạn muốn thử một điểm nhấn mới."],
  ["kitties", "Kitties", "DA-ABP-KIT", "Đáng yêu", "Mang một chút đáng yêu theo mình. Kitties là lựa chọn cho những ai yêu những chi tiết nhỏ mang hình mèo."],
] as const;

const seedKpis = [
  ["visits", "Lượt truy cập website", "lượt", 200, 120],
  ["revenue", "Doanh thu website", "VND", 500000, 600000],
  ["conversion", "Tỷ lệ chuyển đổi website", "%", 5, 7],
  ["rating", "Đánh giá trung bình website", "sao", 4.5, 4],
] as const;

export async function ensureSeed() {
  const db = database();
  const now = new Date().toISOString();
  const statements = [
    ...seedProducts.map(([id, name, sku, mood, description]) => db.prepare(
      "INSERT OR IGNORE INTO products (id,name,sku,mood,description,image,price,stock,active,featured,created_at) VALUES (?,?,?,?,?,'/product-sheet.png',63000,0,1,1,?)"
    ).bind(id, name, sku, mood, description, now)),
    ...seedKpis.map(([key, label, unit, target, actual]) => db.prepare(
      "INSERT OR IGNORE INTO kpis (key,label,unit,target,actual,source,note,updated_at) VALUES (?,?,?,?,?,'seed','Tham chiếu trong bảng BTC; không phải kết quả của Form V',?)"
    ).bind(key, label, unit, target, actual, now)),
    db.prepare("INSERT OR IGNORE INTO store_settings (id) VALUES ('main')"),
  ];
  await db.batch(statements);
}

export async function publicStoreSettings() {
  await ensureSeed();
  const settings = await database().prepare("SELECT pickup_enabled,delivery_enabled,pickup_location,contact_url,shipping_policy,return_policy,privacy_contact FROM store_settings WHERE id='main'").first<Record<string, any>>();
  return settings || { pickup_enabled: 0, delivery_enabled: 0, pickup_location: "", contact_url: "", shipping_policy: "", return_policy: "", privacy_contact: "" };
}

export async function catalog(includeInactive = false): Promise<Product[]> {
  await ensureSeed();
  const where = includeInactive ? "" : "WHERE p.active = 1";
  const result = await database().prepare(`SELECT p.*, (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.product_id=p.id AND r.status='approved') rating, (SELECT COUNT(*) FROM reviews r WHERE r.product_id=p.id AND r.status='approved') review_count, (SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.product_id=p.id AND o.payment_status='paid' AND o.status='delivered') sold FROM products p ${where} ORDER BY p.featured DESC, CASE p.id WHEN 'glitter' THEN 1 WHEN 'panda' THEN 2 WHEN 'cute-paws' THEN 3 WHEN 'hologram' THEN 4 WHEN 'kitties' THEN 5 ELSE 6 END, p.created_at,p.name`).all<Product>();
  return result.results || [];
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function cleanString(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function money(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value) + " ₫";
}

export async function voucherDiscount(code: string, subtotal: number) {
  if (!code) return { code: "", discount: 0 };
  const row = await database().prepare("SELECT * FROM vouchers WHERE code=?").bind(code.toUpperCase()).first<Record<string, any>>();
  const now = new Date().toISOString();
  if (!row || !row.active || (row.starts_at && row.starts_at > now) || (row.ends_at && row.ends_at < now) ||
      (row.max_uses != null && row.used_count >= row.max_uses) || subtotal < row.min_subtotal) {
    throw new Error("Mã ưu đãi không hợp lệ, chưa có hiệu lực hoặc đã hết lượt sử dụng.");
  }
  const raw = row.kind === "percent" ? Math.floor(subtotal * row.amount / 100) : row.amount;
  return { code: row.code as string, discount: Math.min(subtotal, Math.max(0, raw)) };
}
