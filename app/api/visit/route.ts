import { database, json } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { path?: unknown; consent?: unknown; sessionId?: unknown };
    if (body.consent !== true) return json({ recorded: false });
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    if (!/^[a-f0-9-]{36}$/i.test(sessionId)) return json({ error: "Phiên truy cập không hợp lệ." }, 400);
    const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 200) : "/";
    const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const result = await database().prepare("INSERT OR IGNORE INTO visits (id,path,created_at) VALUES (?,?,?)").bind(`${sessionId}:${day}`, path, new Date().toISOString()).run();
    return json({ recorded: true, newSession: (result.meta?.changes || 0) > 0 });
  } catch {
    return json({ recorded: false }, 500);
  }
}
