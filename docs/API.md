# HTTP API

JSON responses use `Cache-Control: no-store`. All mutations validate on the server. Admin requests need a Sites-authenticated email in hosted dispatch matching `ADMIN_EMAILS`; browser clients cannot grant themselves that identity.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/catalog` | GET | Active products, approved rating/count, recorded sales. `?id=<id>` adds approved reviews. |
| `/api/voucher` | POST | Preview a voucher with `{code, subtotal}`. Checkout independently recomputes it. |
| `/api/orders` | POST | Create a pending order from `{items:[{id,quantity}], customerName, phone, email?, address, province, district, ward, note?, paymentMethod:"cod"|"bank_transfer", voucherCode?}`. Prices and totals come from D1. Returns code, status and temporary total. |
| `/api/orders?code=...&phone=...` | GET | Guest order tracking with both verification fields. |
| `/api/orders?mine=1` | GET | Signed-in customer's own orders. |
| `/api/reviews` | POST | `{code,phone,productId,rating,body}` for a delivered purchase; review starts pending. |
| `/api/favorites` | GET/POST | Signed-in wishlist; POST `{productId}` toggles. |
| `/api/visit` | POST | `{path,consent:true}` records a visit only after consent. |
| `/api/admin` | GET | Admin dashboard datasets. `?export=orders` and `?export=kpis` download CSV. |
| `/api/admin` | POST | Admin mutations, selected by `action` below. |
| `/api/admin/upload` | POST | Multipart `kind=product|evidence`, `file`. Evidence also requires `kpiKey,title,collectedAt,note?`. Max 8 MB. |
| `/api/assets/<key>` | GET | Public product images; Admin-only evidence files. |

## Admin actions

- `product`: `{id?,name,sku,mood,description,image,price,stock,active,featured}`. Set `active:false` to hide a product. Stock changes create an inventory transaction.
- `order_status`: `{id,status,paymentStatus,shippingFee}`. Status is pending, confirmed, processing, shipping, delivered, cancelled, or refunded. Payment status is pending, paid, or refunded. Supply shipping fee before processing; use `0` for free shipping. Paid orders cannot change shipping total. Cancellation restores reserved stock.
- `voucher`: `{code,kind:"fixed"|"percent",amount,minSubtotal,maxUses?,startsAt?,endsAt?,active}`. Voucher checks and usage limits are enforced again at checkout.
- `kpi`: `{key,target,actual,source:"seed"|"manual"|"auto",note?}`. Keys are visits, revenue, conversion, rating. Every change creates an audit record.
- `evidence`: `{kpiKey,title,url,note?,collectedAt}` for an HTTPS link. Files use the upload endpoint.
- `review`: `{id,status:"approved"|"rejected"}`.
- `channel_report`: `{month:"YYYY-MM",channel,units,revenue,marketingCost,promotionCost,note?}`. Website is excluded here because paid website orders are aggregated automatically.
- `campaign`: `{id?,name,description,startsAt?,endsAt?,active}`.

Error responses have `{error}` and an appropriate HTTP status, including 400 for validation, 401/403 for authorization, 404 for missing records, and 409 for stock or voucher conflicts.
