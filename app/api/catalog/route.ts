import { catalog, database, json, publicStoreSettings } from "@/lib/store";

export async function GET(request: Request) {
  try {
    const products = await catalog();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      const db = database();
      const now = new Date().toISOString();
      const [settings, offers, reviews, rating] = await Promise.all([
        publicStoreSettings(),
        db.prepare("SELECT code,kind,amount,min_subtotal,starts_at,ends_at FROM vouchers WHERE active=1 AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>=?) AND (max_uses IS NULL OR used_count<max_uses) ORDER BY ends_at LIMIT 8").bind(now, now).all(),
        db.prepare("SELECT r.id,r.rating,r.body,r.display_name,r.created_at,p.name product_name FROM reviews r JOIN products p ON p.id=r.product_id WHERE r.status='approved' ORDER BY r.created_at DESC LIMIT 12").all(),
        db.prepare("SELECT ROUND(AVG(rating),1) average,COUNT(*) count FROM reviews WHERE status='approved'").first(),
      ]);
      return json({ products, settings, offers: offers.results || [], reviews: reviews.results || [], rating });
    }
    const product = products.find(x => x.id === id);
    if (!product) return json({ error: "Không tìm thấy sản phẩm." }, 404);
    const reviews = await database().prepare("SELECT id,rating,body,display_name,created_at FROM reviews WHERE product_id=? AND status='approved' ORDER BY created_at DESC LIMIT 30").bind(id).all();
    return json({ product, reviews: reviews.results || [] });
  } catch (error) {
    return json({ error: "Không tải được sản phẩm.", detail: String(error) }, 500);
  }
}
