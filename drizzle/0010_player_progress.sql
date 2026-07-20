CREATE TABLE `player_progress` (
	`owner_id` text NOT NULL,
	`game_id` text NOT NULL,
	`high_score` integer DEFAULT 0 NOT NULL,
	`last_state` text DEFAULT 'playing' NOT NULL,
	`achievements_json` text DEFAULT '[]' NOT NULL,
	`progress_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`owner_id`, `game_id`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_progress_game_score_idx` ON `player_progress` (`game_id`,`high_score`);
