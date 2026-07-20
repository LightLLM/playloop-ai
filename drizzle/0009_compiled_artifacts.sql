CREATE TABLE `compiled_artifacts` (
  `version_id` text PRIMARY KEY NOT NULL,
  `job_id` text NOT NULL,
  `object_key` text NOT NULL,
  `bytes` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `compiled_artifacts_job_id_idx` ON `compiled_artifacts` (`job_id`);
