CREATE TABLE `version_lineage` (`version_id` text PRIMARY KEY NOT NULL,`parent_version_id` text,`operation` text NOT NULL,`created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TABLE `publications` (`slug` text PRIMARY KEY NOT NULL,`job_id` text NOT NULL,`version_id` text NOT NULL,`fingerprint` text NOT NULL,`status` text NOT NULL,`created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,`updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE INDEX `publications_job_id_idx` ON `publications` (`job_id`);
