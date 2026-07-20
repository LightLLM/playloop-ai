CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`player_x` real DEFAULT 48 NOT NULL,
	`player_y` real DEFAULT 64 NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
