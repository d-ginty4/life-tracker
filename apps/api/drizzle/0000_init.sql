CREATE TABLE `diary_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`position` integer NOT NULL,
	`type` text NOT NULL,
	`meal_id` text,
	`meal_name` text,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `diary_entries_date_position_idx` ON `diary_entries` (`date`,`position`);--> statement-breakpoint
CREATE TABLE `diary_entry_items` (
	`id` text PRIMARY KEY NOT NULL,
	`diary_entry_id` text NOT NULL,
	`position` integer NOT NULL,
	`ingredient_id` text,
	`ingredient_name` text NOT NULL,
	`basis_amount` real NOT NULL,
	`basis_unit` text NOT NULL,
	`basis_calories` real NOT NULL,
	`basis_protein` real NOT NULL,
	`basis_carbs` real NOT NULL,
	`basis_fat` real NOT NULL,
	`basis_fiber` real NOT NULL,
	`amount` real NOT NULL,
	FOREIGN KEY (`diary_entry_id`) REFERENCES `diary_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `diary_entry_items_entry_id_position_idx` ON `diary_entry_items` (`diary_entry_id`,`position`);--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`basis_amount` real NOT NULL,
	`basis_unit` text NOT NULL,
	`calories` real NOT NULL,
	`protein` real NOT NULL,
	`carbs` real NOT NULL,
	`fat` real NOT NULL,
	`fiber` real NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `meal_items` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`default_amount` real NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `meal_items_meal_id_position_idx` ON `meal_items` (`meal_id`,`position`);--> statement-breakpoint
CREATE INDEX `meal_items_ingredient_id_idx` ON `meal_items` (`ingredient_id`);--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`goal_weight_kg` real,
	`preferred_unit` text DEFAULT 'kg' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weight_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`weight_kg` real NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weight_entries_date_idx` ON `weight_entries` (`date`);