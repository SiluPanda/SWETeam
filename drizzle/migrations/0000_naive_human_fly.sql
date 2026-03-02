CREATE TABLE `iterations` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`iteration_number` integer NOT NULL,
	`feedback` text NOT NULL,
	`plan_delta` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`repo_local_path` text,
	`goal` text NOT NULL,
	`status` text NOT NULL,
	`plan_json` text,
	`pr_url` text,
	`pr_number` integer,
	`working_branch` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`stopped_at` integer
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`depends_on` text,
	`files_likely_touched` text,
	`acceptance_criteria` text,
	`branch_name` text,
	`review_verdict` text,
	`review_issues` text,
	`review_cycles` integer DEFAULT 0,
	`diff_patch` text,
	`agent_output` text,
	`order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
