CREATE TABLE `build_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`version` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`project_json` text NOT NULL,
	`created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `build_versions_job_id_idx` ON `build_versions` (`job_id`);
