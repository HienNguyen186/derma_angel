import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

type NativeEnv = Cloudflare.Env & {
  NATIVE_CLOUDFLARE?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_POLICY_AUD?: string;
  ADMIN_EMAILS?: string;
};

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function accessEmail(request: Request, env: NativeEnv): Promise<string | null> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  const domain = env.ACCESS_TEAM_DOMAIN?.replace(/\/$/, "");
  if (!token || !domain || !env.ACCESS_POLICY_AUD || !domain.endsWith(".cloudflareaccess.com")) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
    if (claims.iss !== `https://${domain}` || !Array.isArray(claims.aud) || !claims.aud.includes(env.ACCESS_POLICY_AUD)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== "number" || claims.exp <= now || (typeof claims.nbf === "number" && claims.nbf > now)) return null;
    if (typeof claims.email !== "string") return null;
    const response = await fetch(`https://${domain}/cdn-cgi/access/certs`);
    if (!response.ok) return null;
    const { keys } = await response.json() as { keys?: JsonWebKey[] };
    const jwk = keys?.find((key) => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(parts[2]), signed)) return null;
    return claims.email.toLowerCase();
  } catch {
    return null;
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
      const path = new URL(request.url).pathname;
      if (path === "/admin" || path.startsWith("/admin/") || path === "/api/admin" || path.startsWith("/api/admin/")) {
        const email = await accessEmail(request, env);
        const allowed = (env.ADMIN_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
        if (!email || !allowed.includes(email)) return new Response("Không có quyền quản trị", { status: 403 });
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
