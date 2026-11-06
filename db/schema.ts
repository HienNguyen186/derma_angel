import { sql } from "drizzle-orm";
import { check, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  mood: text("mood").notNull(),
  description: text("description").notNull().default(""),
  image: text("image").notNull(),
  price: integer("price").notNull().default(63000),
  stock: integer("stock").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  featured: integer("featured", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
}, (table) => [check("products_stock_nonnegative", sql`${table.stock} >= 0`)]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(), code: text("code").notNull().unique(), userId: text("user_id"),
  customerName: text("customer_name").notNull(), phone: text("phone").notNull(), email: text("email"),
  address: text("address").notNull(), province: text("province").notNull(), district: text("district").notNull(), ward: text("ward").notNull(), note: text("note"),
  paymentMethod: text("payment_method").notNull(), paymentStatus: text("payment_status").notNull().default("pending"),
  status: text("status").notNull().default("pending"), subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0), shippingFee: integer("shipping_fee"), total: integer("total").notNull(),
  voucherCode: text("voucher_code"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => orders.id),
  productId: text("product_id").notNull().references(() => products.id), name: text("name").notNull(), image: text("image").notNull(),
  price: integer("price").notNull(), quantity: integer("quantity").notNull(),
});

export const vouchers = sqliteTable("vouchers", {
  code: text("code").primaryKey(), kind: text("kind").notNull(), amount: integer("amount").notNull(),
  minSubtotal: integer("min_subtotal").notNull().default(0), maxUses: integer("max_uses"), usedCount: integer("used_count").notNull().default(0),
  startsAt: text("starts_at"), endsAt: text("ends_at"), active: integer("active", { mode: "boolean" }).notNull().default(false),
}, (table) => [check("vouchers_uses_within_limit", sql`${table.maxUses} IS NULL OR ${table.usedCount} <= ${table.maxUses}`)]);

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => orders.id), productId: text("product_id").notNull().references(() => products.id),
  rating: integer("rating").notNull(), body: text("body").notNull(), displayName: text("display_name").notNull(), phone: text("phone").notNull(),
  status: text("status").notNull().default("pending"), createdAt: text("created_at").notNull(),
});

export const kpis = sqliteTable("kpis", {
  key: text("key").primaryKey(), label: text("label").notNull(), unit: text("unit").notNull(),
  target: real("target").notNull(), actual: real("actual").notNull(), source: text("source").notNull().default("seed"),
  note: text("note"), updatedAt: text("updated_at").notNull(),
});

export const evidence = sqliteTable("evidence", {
  id: text("id").primaryKey(), kpiKey: text("kpi_key").notNull().references(() => kpis.key), title: text("title").notNull(),
  url: text("url"), objectKey: text("object_key"), mime: text("mime"), note: text("note"),
  collectedAt: text("collected_at").notNull(), createdAt: text("created_at").notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(), name: text("name").notNull(), description: text("description").notNull().default(""),
  startsAt: text("starts_at"), endsAt: text("ends_at"), active: integer("active", { mode: "boolean" }).notNull().default(false),
});

export const channelReports = sqliteTable("channel_reports", {
  id: text("id").primaryKey(), month: text("month").notNull(), channel: text("channel").notNull(),
  units: integer("units").notNull().default(0), revenue: integer("revenue").notNull().default(0),
  marketingCost: integer("marketing_cost").notNull().default(0), promotionCost: integer("promotion_cost").notNull().default(0),
  source: text("source").notNull().default("manual"), note: text("note"), createdAt: text("created_at").notNull(),
});

export const inventoryTransactions = sqliteTable("inventory_transactions", {
  id: text("id").primaryKey(), productId: text("product_id").notNull().references(() => products.id),
  delta: integer("delta").notNull(), reason: text("reason").notNull(), referenceId: text("reference_id"), createdAt: text("created_at").notNull(),
});

export const visits = sqliteTable("visits", {
  id: text("id").primaryKey(), path: text("path").notNull(), createdAt: text("created_at").notNull(),
});

export const favorites = sqliteTable("favorites", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(),
  productId: text("product_id").notNull().references(() => products.id),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("favorites_user_product_unique").on(table.userId, table.productId)]);

export const kpiHistory = sqliteTable("kpi_history", {
  id: text("id").primaryKey(), kpiKey: text("kpi_key").notNull().references(() => kpis.key),
  previousTarget: real("previous_target").notNull(), previousActual: real("previous_actual").notNull(),
  previousSource: text("previous_source").notNull(), target: real("target").notNull(), actual: real("actual").notNull(),
  source: text("source").notNull(), changedBy: text("changed_by").notNull(), createdAt: text("created_at").notNull(),
});
