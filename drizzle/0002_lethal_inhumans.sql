CREATE TABLE `build_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`agent` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`artifact_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `build_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`status` text NOT NULL,
	`spec_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
