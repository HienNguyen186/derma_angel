import { headers } from "next/headers";
import { env } from "cloudflare:workers";
import { AdminApp } from "@/components/admin-app";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const email = (await headers()).get("oai-authenticated-user-email")?.toLowerCase();
  const allowed = (env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!email || !allowed.includes(email)) return <main className="admin-denied"><h1>Không có quyền quản trị</h1><p>Khu vực này chỉ dành cho tài khoản quản trị đã được cấu hình.</p><a href="/">← Về cửa hàng</a></main>;
  return <AdminApp email={email} native={env.NATIVE_CLOUDFLARE === "1"} />;
}
