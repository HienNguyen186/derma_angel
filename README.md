# DermaAngel — Mood in the Clouds

Full-stack DermaAngel storefront and Business Admin, built with React/Next.js on Vinext, Cloudflare D1, and R2. The initial hosted Site is owner-private. The customer flow is implemented for a later public launch after verified inventory, shipping policy, product instructions, and access settings are supplied.

## What works

- Storefront: five original package designs, search, design/price/rating/stock filters, sorting, shareable product detail (`/?product=<id>`), cart, favorites for signed-in users, voucher preview, checkout, order tracking by code plus phone, signed-in order history, and verified-purchase review submission.
- Business Admin: server-checked admin access, product and inventory editing, original-image upload, order/payment/shipping updates, voucher configuration, review moderation, website KPI target versus actual, KPI change history, evidence links and private PNG/JPEG/PDF upload, campaign records, manual channel reports, financial estimates, CSV export, and charts from recorded data.
- Checkout: backend prices every item, validates stock and voucher limits, saves the order and decrements stock atomically in D1. Orders start in `pending`. Cancellation restores reserved stock and releases a voucher use. COD and bank transfer remain pending until an administrator confirms payment. Shipping cost can be set by Admin before processing.

## Data provenance and scope

- The **website KPI** seed is 200 visits target / 120 actual; 500,000 VND revenue target / 600,000 actual; 5% conversion target / 7% actual; and 4.5 stars target / 4.0 actual. Every initial actual is marked `seed`. Admin can switch each KPI to `manual` or `auto` and edit targets. Automatic figures come only from consented visits, saved orders, paid revenue, and approved reviews.
- The **campaign target** is separate: 90,000 boxes and 5.67 billion VND across 11/2026–01/2027. The monthly targets are 27,000 / 45,000 / 18,000 boxes. Other-channel results require an Admin report. The campaign summary combines those reports with **paid website orders only**; it never copies the overall target into the website dashboard.
- The 63,000 VND box price and the five package images came from the supplied proposal. Initial stock is **0** because no verified quantities were supplied. Admin must set real stock before checkout can accept an order. No fake orders, reviews, sales, visits, or evidence are seeded.
- The 22,050 VND per-box cost is used only for the Admin financial estimate. Incomplete marketing and promotion costs are called out; the estimate is not final profit.

## Run locally

Requires Node.js 22.13+ and npm. From this directory:

```powershell
npm ci
Copy-Item .env.example .dev.vars
```

Set `ADMIN_EMAILS=seedy@sites.test` in `.dev.vars` for the built-in local sign-in test account. No password is stored or seeded. Then:

```powershell
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_unusual_dark_beast.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_amused_gargoyle.sql
npm run dev
```

Open `http://127.0.0.1:5173/`. To test Admin, open `http://127.0.0.1:5173/signin-with-chatgpt?return_to=/admin`. This local sign-in is provided by the Sites development runtime only. Set product stock in Admin before testing checkout. Local D1 and R2 data remain in `.wrangler/state` and are separate from hosted data.

## Deploy

The tracked `.openai/hosting.json` declares the Sites project, D1 binding `DB`, and R2 binding `BUCKET`. Sites applies the committed Drizzle migrations before deploying the Worker. Configure `ADMIN_EMAILS` as a hosted runtime secret containing the email addresses allowed to manage the store, then build and publish the pushed source through the Sites workflow. The initial Site stays owner-private. A public launch requires an explicit access change and operational review; do not expose the Site publicly while stock, shipping policy, product instructions, and business payment details are unverified.

For another Cloudflare Workers deployment, provision D1 and R2, bind them under the same names, apply `drizzle/*.sql` in order, configure `ADMIN_EMAILS`, and deploy the `npm run build` Worker output. Vercel alone cannot run this D1/R2 configuration unchanged.

Admin CSV exports cover orders and website KPI. Configure provider-level D1 backups and R2 retention before public launch; this source does not claim to implement full database restore.

## Security and privacy

- Admin APIs and evidence files check the Sites-authenticated email against `ADMIN_EMAILS` on the server. A customer cannot use an Admin screen or endpoint without that identity.
- Checkout ignores client prices and discounts. D1 constraints plus a batch transaction prevent negative stock and excess voucher use under concurrent orders.
- Guest order lookup requires both order code and phone. Public reviews require a delivered order and Admin approval. Phone numbers are not shown in public reviews.
- The site records internal visits only after the visitor opts in. The consent choice is stored in the browser. GA4, Meta Pixel, Search Console, and payment gateway scripts are not active.
- R2 evidence files are Admin-only. Uploaded product images are public. Inputs use bound SQL parameters. No card numbers or payment credentials are stored.

## Not yet active

- VNPay/MoMo and automatic bank transfer confirmation: credentials and approved payment details are missing. Bank transfer orders remain pending for manual follow-up.
- Combo 3-box, five-design giftset, pouch gifts, and countdowns: no pricing, stock allocation, gift quantities, or activation rules have been approved. The storefront shows no active offer.
- Official usage instructions, product claims, shipping/returns/privacy policy text, and shipping tariffs: not supplied. The UI explicitly marks these pending; Admin can set shipping for each order.
- GA4, Meta Pixel, Search Console, third-party channel sync/import, automated carrier updates, and production rate limiting: require integration setup. External channels are manually reported today.
- Standalone customer registration/password reset and editable profile/address book: the hosted Site uses ChatGPT sign-in for account identity. Guest checkout and signed-in order history/favorites work; those account features are not implemented.

See [API documentation](docs/API.md) for request contracts. The source PDF remains in the parent workspace and is not part of the deployable Site.
