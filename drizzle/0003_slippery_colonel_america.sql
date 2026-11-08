PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text,
	`product_id` text NOT NULL,
	`rating` integer NOT NULL,
	`body` text NOT NULL,
	`display_name` text NOT NULL,
	`phone` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`consent_public` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'website_order' NOT NULL,
	`request_key` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_reviews`("id", "order_id", "product_id", "rating", "body", "display_name", "phone", "status", "created_at", "consent_public", "source", "request_key") SELECT "id", "order_id", "product_id", "rating", "body", "display_name", "phone", "status", "created_at", "consent_public", 'website_order', NULL FROM `reviews`;--> statement-breakpoint
DROP TABLE `reviews`;--> statement-breakpoint
ALTER TABLE `__new_reviews` RENAME TO `reviews`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_request_key_unique` ON `reviews` (`request_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_order_unique` ON `reviews` (`order_id`);
