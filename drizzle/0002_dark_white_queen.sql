CREATE TABLE `order_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`old_status` text,
	`new_status` text NOT NULL,
	`old_payment_status` text,
	`new_payment_status` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `store_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`pickup_enabled` integer DEFAULT false NOT NULL,
	`delivery_enabled` integer DEFAULT false NOT NULL,
	`pickup_location` text DEFAULT '' NOT NULL,
	`contact_url` text DEFAULT '' NOT NULL,
	`shipping_policy` text DEFAULT '' NOT NULL,
	`return_policy` text DEFAULT '' NOT NULL,
	`privacy_contact` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `receive_method` text DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `request_key` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `consent_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `refunded_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivered_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_request_key_unique` ON `orders` (`request_key`);--> statement-breakpoint
ALTER TABLE `products` ADD `price_confirmed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `stock_confirmed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `consent_public` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_order_unique` ON `reviews` (`order_id`);
--> statement-breakpoint
UPDATE products SET description='Một chút lấp lánh cho ngày bạn muốn nổi bật. Chọn Glitter để thêm điểm nhấn vui tươi cho phong cách của mình.' WHERE id='glitter' AND description='Mẫu Glitter cho những ngày muốn thêm chút lấp lánh vào phong cách.';
--> statement-breakpoint
UPDATE products SET description='Dịu dàng, gần gũi và có chút đáng yêu. Panda dành cho những ngày bạn muốn chọn một nét nhỏ thật dễ thương.' WHERE id='panda' AND description='Họa tiết gấu trúc đáng yêu, nhẹ nhàng và gần gũi.';
--> statement-breakpoint
UPDATE products SET description='Một chút tinh nghịch từ những dấu chân xinh. Cute Paws cùng bạn thêm nét vui nhộn cho diện mạo hằng ngày.' WHERE id='cute-paws' AND description='Họa tiết dấu chân nhỏ cho mood vui tươi mỗi ngày.';
--> statement-breakpoint
UPDATE products SET description='Đổi góc nhìn, đổi sắc màu. Hologram dành cho những ngày bạn muốn thử một điểm nhấn mới.' WHERE id='hologram' AND description='Hiệu ứng sắc màu cho phong cách nổi bật theo cách riêng.';
--> statement-breakpoint
UPDATE products SET description='Mang một chút đáng yêu theo mình. Kitties là lựa chọn cho những ai yêu những chi tiết nhỏ mang hình mèo.' WHERE id='kitties' AND description='Mẫu mèo nhỏ dành cho những ngày muốn thật dễ thương.';
