ALTER TABLE `build_events` ADD `trace_id` text;
--> statement-breakpoint
ALTER TABLE `build_events` ADD `elapsed_ms` integer;
--> statement-breakpoint
CREATE INDEX `build_events_trace_idx` ON `build_events` (`trace_id`);
