CREATE TABLE `demo_reset_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ranAt` timestamp NOT NULL DEFAULT (now()),
	`durationMs` int NOT NULL,
	`patientsInserted` int NOT NULL,
	`visitsInserted` int NOT NULL,
	`inventoryInserted` int NOT NULL,
	`medicinesInserted` int NOT NULL,
	`campsInserted` int NOT NULL,
	`campPatientsInserted` int NOT NULL,
	`success` boolean NOT NULL,
	`errorMessage` text,
	CONSTRAINT `demo_reset_log_id` PRIMARY KEY(`id`)
);
