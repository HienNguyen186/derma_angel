import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

type NativeEnv = Cloudflare.Env & {
  NATIVE_CLOUDFLARE?: string;
  ADMIN_EMAILS?: string;
  ADMIN_PASSWORD_HASHES?: string;
  ADMIN_SESSION_KEY?: string;
};

const sessionCookie = "dermaangel_admin_session";
const sessionSeconds = 12 * 60 * 60;

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(env: NativeEnv): Promise<CryptoKey | null> {
  if (!env.ADMIN_SESSION_KEY) return null;
  try {
    return await crypto.subtle.importKey("raw", decodeBase64Url(env.ADMIN_SESSION_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  } catch {
    return null;
  }
}

function allowedEmails(env: NativeEnv): string[] {
  return (env.ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function sameOrigin(request: Request): boolean {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

async function sessionEmail(request: Request, env: NativeEnv): Promise<string | null> {
  const value = request.headers.get("Cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
  if (!value) return null;
  try {
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra) return null;
    const key = await hmacKey(env);
    if (!key || !await crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), new TextEncoder().encode(payload))) return null;
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    if (typeof claims.email !== "string" || typeof claims.exp !== "number" || claims.exp <= Date.now()) return null;
    const email = claims.email.toLowerCase();
    return allowedEmails(env).includes(email) ? email : null;
  } catch {
    return null;
  }
}

async function makeSession(email: string, env: NativeEnv): Promise<string | null> {
  const key = await hmacKey(env);
  if (!key) return null;
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ email, exp: Date.now() + sessionSeconds * 1000 })));
  const signature = encodeBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
  return `${payload}.${signature}`;
}

function loginPage(invalid = false): Response {
  const message = invalid ? '<p role="alert" class="error">Email hoặc mật khẩu không đúng.</p>' : "";
  return new Response(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Đăng nhập Admin · DermaAngel</title><style>body{font-family:Arial,sans-serif;background:#eef8fb;color:#173e5d;min-height:100vh;display:grid;place-items:center;margin:0}main{background:#fff;border:1px solid #c9e1eb;border-radius:20px;padding:32px;width:min(400px,calc(100% - 48px));box-shadow:0 16px 40px #163e5d14}h1{font-size:28px;margin:0 0 8px}p{line-height:1.5}label{display:block;font-weight:600;margin:18px 0 6px}input{box-sizing:border-box;width:100%;padding:13px;border:1px solid #aacbd8;border-radius:9px;font-size:16px}button{background:#195c91;color:#fff;border:0;border-radius:9px;padding:13px 20px;margin-top:22px;font-size:16px;cursor:pointer}.error{color:#a12228}a{color:#195c91}</style></head><body><main><h1>Quản trị DermaAngel</h1><p>Đăng nhập bằng email và mật khẩu được cấp riêng.</p>${message}<form method="post" action="/admin/login"><label for="email">Email quản trị</label><input id="email" name="email" type="email" autocomplete="username" required><label for="password">Mật khẩu</label><input id="password" name="password" type="password" autocomplete="current-password" required><button type="submit">Đăng nhập</button></form><p><a href="/">← Về cửa hàng</a></p></main></body></html>`, { status: invalid ? 401 : 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } });
}

async function validPassword(email: string, password: string, env: NativeEnv): Promise<boolean> {
  if (!allowedEmails(env).includes(email) || !env.ADMIN_PASSWORD_HASHES || password.length > 256) return false;
  try {
    const hashes = JSON.parse(env.ADMIN_PASSWORD_HASHES) as Record<string, string>;
    const expected = hashes[email];
    if (typeof expected !== "string") return false;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    const actual = encodeBase64Url(new Uint8Array(digest));
    return actual === expected;
  } catch {
    return false;
  }
}

const worker = {
  async fetch(request: Request, env: NativeEnv, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if (env.NATIVE_CLOUDFLARE === "1") {
      // Sites supplies these headers inside its trusted boundary. A public
      // Workers request can set them freely, so never forward them to the app.
      const headers = new Headers(request.headers);
      for (const key of headers.keys()) {
        if (key.toLowerCase().startsWith("oai-authenticated-user-")) headers.delete(key);
      }
      let path: string;
      try { path = decodeURIComponent(new URL(request.url).pathname).toLowerCase(); }
      catch { return new Response("Invalid URL", { status: 400 }); }
      if (path === "/admin/login") {
        if (request.method === "GET") return loginPage();
        if (request.method !== "POST" || !sameOrigin(request)) return new Response("Forbidden", { status: 403 });
        const form = await request.formData();
        const email = String(form.get("email") || "").trim().toLowerCase();
        const password = String(form.get("password") || "");
        if (!await validPassword(email, password, env)) return loginPage(true);
        const session = await makeSession(email, env);
        if (!session) return new Response("Đăng nhập chưa được cấu hình", { status: 503 });
        return new Response(null, { status: 303, headers: { "Location": "/admin", "Set-Cookie": `${sessionCookie}=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${sessionSeconds}`, "Cache-Control": "no-store" } });
      }
      if (path === "/admin/logout") {
        if (request.method !== "POST" || !sameOrigin(request)) return new Response("Forbidden", { status: 403 });
        return new Response(null, { status: 303, headers: { "Location": "/", "Set-Cookie": `${sessionCookie}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`, "Cache-Control": "no-store" } });
      }
      if (path === "/admin" || path.startsWith("/admin/") || path === "/api/admin" || path.startsWith("/api/admin/") || path.startsWith("/api/assets/evidences-")) {
        const email = await sessionEmail(request, env);
        if (!email) return path.startsWith("/api/") ? Response.json({ error: "Vui lòng đăng nhập quản trị." }, { status: 401 }) : Response.redirect(new URL("/admin/login", request.url), 302);
        if (request.method !== "GET" && request.method !== "HEAD" && !sameOrigin(request)) return new Response("Forbidden", { status: 403 });
        headers.set("oai-authenticated-user-email", email);
      }
      request = new Request(request, { headers });
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
