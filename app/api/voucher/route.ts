import { cleanString, json, voucherDiscount } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const code = cleanString(body.code, 40).toUpperCase();
    const subtotal = Number(body.subtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) return json({ error: "Giỏ hàng không hợp lệ." }, 400);
    return json(await voucherDiscount(code, subtotal));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Không kiểm tra được mã." }, 400);
  }
}
