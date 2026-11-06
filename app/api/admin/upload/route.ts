import { env } from "cloudflare:workers";
import { adminAuthorized, cleanString, database, json } from "@/lib/store";

export async function POST(request: Request) {
  if (!adminAuthorized(request)) return json({ error: "Không có quyền quản trị." }, 403);
  try {
    if (!env.BUCKET) return json({ error: "Kho tệp chưa được cấu hình." }, 503);
    const form = await request.formData();
    const file = form.get("file");
    const kind = cleanString(form.get("kind"), 20);
    if (!(file instanceof File) || !["product", "evidence"].includes(kind) || file.size > 8_000_000 || file.size === 0) return json({ error: "Tệp không hợp lệ hoặc vượt quá 8 MB." }, 400);
    const allowed = kind === "product" ? ["image/png", "image/jpeg", "image/webp"] : ["image/png", "image/jpeg", "application/pdf"];
    if (!allowed.includes(file.type)) return json({ error: "Định dạng tệp không được hỗ trợ." }, 400);
    const key = `${kind}s-${crypto.randomUUID()}`;
    await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    const url = `/api/assets/${key}`;
    if (kind === "evidence") {
      const kpiKey = cleanString(form.get("kpiKey"), 30), title = cleanString(form.get("title"), 120);
      const collectedAt = cleanString(form.get("collectedAt"), 30), note = cleanString(form.get("note"), 500);
      if (!["visits", "revenue", "conversion", "rating"].includes(kpiKey) || !title || !/^\d{4}-\d{2}-\d{2}$/.test(collectedAt)) {
        await env.BUCKET.delete(key);
        return json({ error: "Thiếu thông tin minh chứng." }, 400);
      }
      await database().prepare("INSERT INTO evidence (id,kpi_key,title,url,object_key,mime,note,collected_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), kpiKey, title, url, key, file.type, note || null, collectedAt, new Date().toISOString()).run();
    }
    return json({ ok: true, url });
  } catch {
    return json({ error: "Không tải được tệp lên." }, 500);
  }
}
