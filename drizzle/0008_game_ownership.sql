ALTER TABLE `games` ADD `owner_id` text;
--> statement-breakpoint
ALTER TABLE `games` ADD `share_token` text;
--> statement-breakpoint
CREATE INDEX `games_owner_id_idx` ON `games` (`owner_id`);
