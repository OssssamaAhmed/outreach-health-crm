CREATE TABLE `pending_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`assignedRole` enum('admin','receptionist') NOT NULL,
	`invitedBy` int NOT NULL,
	`invitedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pending_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `pending_invites_email_unique` UNIQUE(`email`)
);
