import { database, json } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { path?: unknown; consent?: unknown };
    if (body.consent !== true) return json({ recorded: false });
    const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 200) : "/";
    await database().prepare("INSERT INTO visits (id,path,created_at) VALUES (?,?,?)").bind(crypto.randomUUID(), path, new Date().toISOString()).run();
    return json({ recorded: true });
  } catch {
    return json({ recorded: false }, 500);
  }
}
