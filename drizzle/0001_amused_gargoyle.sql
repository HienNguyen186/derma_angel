CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_product_unique` ON `favorites` (`user_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `kpi_history` (
	`id` text PRIMARY KEY NOT NULL,
	`kpi_key` text NOT NULL,
	`previous_target` real NOT NULL,
	`previous_actual` real NOT NULL,
	`previous_source` text NOT NULL,
	`target` real NOT NULL,
	`actual` real NOT NULL,
	`source` text NOT NULL,
	`changed_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`kpi_key`) REFERENCES `kpis`(`key`) ON UPDATE no action ON DELETE no action
);
