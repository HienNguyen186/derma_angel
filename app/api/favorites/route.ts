import { cleanString, database, json, userId } from "@/lib/store";

export async function GET(request: Request) {
  const uid = userId(request);
  if (!uid) return json({ error: "Vui lòng đăng nhập để xem danh sách yêu thích." }, 401);
  const result = await database().prepare("SELECT product_id FROM favorites WHERE user_id=? ORDER BY created_at DESC").bind(uid).all<{product_id:string}>();
  return json({ ids: (result.results || []).map(x => x.product_id) });
}

export async function POST(request: Request) {
  const uid = userId(request);
  if (!uid) return json({ error: "Vui lòng đăng nhập để lưu sản phẩm yêu thích." }, 401);
  try {
    const body = await request.json() as Record<string, unknown>;
    const productId = cleanString(body.productId, 60);
    const db = database();
    const product = await db.prepare("SELECT id FROM products WHERE id=? AND active=1").bind(productId).first();
    if (!product) return json({ error: "Không tìm thấy sản phẩm." }, 404);
    const existing = await db.prepare("SELECT id FROM favorites WHERE user_id=? AND product_id=?").bind(uid, productId).first();
    if (existing) { await db.prepare("DELETE FROM favorites WHERE user_id=? AND product_id=?").bind(uid, productId).run(); return json({ favorite: false }); }
    await db.prepare("INSERT OR IGNORE INTO favorites (id,user_id,product_id,created_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(), uid, productId, new Date().toISOString()).run();
    return json({ favorite: true });
  } catch { return json({ error: "Không lưu được sản phẩm yêu thích." }, 500); }
}
