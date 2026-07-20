CREATE TABLE `build_owners` (`job_id` text PRIMARY KEY NOT NULL,`owner_id` text NOT NULL,`created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE `quota_events` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`owner_id` text NOT NULL,`kind` text NOT NULL,`window_key` text NOT NULL,`created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE INDEX `quota_owner_window_idx` ON `quota_events` (`owner_id`,`kind`,`window_key`);
