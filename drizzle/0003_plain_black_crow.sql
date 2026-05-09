CREATE TABLE `user_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`loginAt` timestamp NOT NULL DEFAULT (now()),
	`logoutAt` timestamp,
	`durationMinutes` int,
	`ipAddress` varchar(64),
	`userAgent` varchar(500),
	`autoClosed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `camp_doctors` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `camp_doctors` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `camp_doctors` ADD `qualification` varchar(255);--> statement-breakpoint
ALTER TABLE `patients` ADD `createdBy` int;--> statement-breakpoint
ALTER TABLE `users` ADD `fullName` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `nicNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `phoneNumber` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_nicNumber_unique` UNIQUE(`nicNumber`);--> statement-breakpoint
CREATE INDEX `user_sessions_user_idx` ON `user_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `user_sessions_login_idx` ON `user_sessions` (`loginAt`);--> statement-breakpoint
CREATE INDEX `user_sessions_open_idx` ON `user_sessions` (`userId`,`logoutAt`);--> statement-breakpoint
CREATE INDEX `activity_logs_user_entity_created_idx` ON `activity_logs` (`userId`,`entityType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `patients_phone_idx` ON `patients` (`phone`);