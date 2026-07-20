CREATE TABLE `generated_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`prompt` text NOT NULL,
	`model` text NOT NULL,
	`moderation_status` text NOT NULL,
	`created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `generated_assets_job_id_idx` ON `generated_assets` (`job_id`);
