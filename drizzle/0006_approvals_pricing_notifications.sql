CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('request_decided','new_pending_request') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`link` varchar(500),
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pending_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestedBy` int NOT NULL,
	`requestType` enum('delete','update') NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`payload` text,
	`reason` text,
	`status` enum('pending','approved','rejected','cancelled','superseded') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`decidedBy` int,
	`decidedAt` timestamp,
	`decisionNote` text,
	CONSTRAINT `pending_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('inventory','medicine') NOT NULL,
	`entityId` int NOT NULL,
	`oldPrice` decimal(12,2),
	`newPrice` decimal(12,2) NOT NULL,
	`changedBy` int NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	`reason` text,
	CONSTRAINT `price_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inventory` ADD `price` decimal(12,2);--> statement-breakpoint
ALTER TABLE `medicines` ADD `quantity` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `medicines` ADD `price` decimal(12,2);--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`userId`,`readAt`);--> statement-breakpoint
CREATE INDEX `pending_approvals_status_entity_idx` ON `pending_approvals` (`status`,`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `pending_approvals_requester_idx` ON `pending_approvals` (`requestedBy`,`status`);--> statement-breakpoint
CREATE INDEX `price_history_entity_idx` ON `price_history` (`entityType`,`entityId`);