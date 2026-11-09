import { database, json } from "@/lib/store";

export async function POST(request: Request) {
  try {
    if (request.headers.get("Origin") !== new URL(request.url).origin) return json({ error: "Yêu cầu không hợp lệ." }, 403);
    const body = await request.json() as { pageViewId?: unknown };
    const pageViewId = typeof body.pageViewId === "string" ? body.pageViewId : "";
    if (!/^[a-f0-9-]{36}$/i.test(pageViewId)) return json({ error: "Lượt mở trang không hợp lệ." }, 400);
    const result = await database().prepare("INSERT OR IGNORE INTO visits (id,path,created_at) VALUES (?,?,?)").bind(`view:${pageViewId}`, "/", new Date().toISOString()).run();
    return json({ recorded: true, newPageView: (result.meta?.changes || 0) > 0 });
  } catch {
    return json({ recorded: false }, 500);
  }
}
