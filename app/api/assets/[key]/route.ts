import { env } from "cloudflare:workers";
import { adminAuthorized } from "@/lib/store";

export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!/^(products|evidences)-[a-f0-9-]+$/.test(key)) return new Response("Not found", { status: 404 });
  if (key.startsWith("evidences-") && !adminAuthorized(request)) return new Response("Forbidden", { status: 403 });
  const object = await env.BUCKET?.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: {
    "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
    "Cache-Control": key.startsWith("products-") ? "public, max-age=86400" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
