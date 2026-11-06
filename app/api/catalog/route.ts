import { catalog, database, json } from "@/lib/store";

export async function GET(request: Request) {
  try {
    const products = await catalog();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ products });
    const product = products.find(x => x.id === id);
    if (!product) return json({ error: "Không tìm thấy sản phẩm." }, 404);
    const reviews = await database().prepare("SELECT id,rating,body,display_name,created_at FROM reviews WHERE product_id=? AND status='approved' ORDER BY created_at DESC LIMIT 30").bind(id).all();
    return json({ product, reviews: reviews.results || [] });
  } catch (error) {
    return json({ error: "Không tải được sản phẩm.", detail: String(error) }, 500);
  }
}
