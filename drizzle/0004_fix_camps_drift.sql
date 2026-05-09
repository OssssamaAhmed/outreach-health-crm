-- Custom SQL migration file, put your code below! --
-- Fix production drift on medical_camps and camp_patients.
-- Both tables existed in prod with a stale schema (campName/description/
-- attendance/FKs) that never matched any drizzle migration. Both are
-- empty in production, so a clean drop+recreate is safe.
-- Drop order: camp_patients first (it has FKs to medical_camps).
-- Create order: medical_camps first, then camp_patients (no FKs in the
-- new schema; parent-first reads more naturally).

DROP TABLE `camp_patients`;--> statement-breakpoint
DROP TABLE `medical_camps`;--> statement-breakpoint
CREATE TABLE `medical_camps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`campDate` timestamp NOT NULL,
	`location` varchar(500),
	`notes` text,
	`totalPatients` int DEFAULT 0,
	`totalVolunteers` int DEFAULT 0,
	`totalExpense` decimal(12,2) DEFAULT '0',
	`status` enum('upcoming','completed','cancelled') DEFAULT 'upcoming',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `medical_camps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `camp_patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campId` int NOT NULL,
	`serialNo` int NOT NULL,
	`patientName` varchar(255) NOT NULL,
	`age` varchar(20),
	`phone` varchar(30),
	`fatherHusbandName` varchar(255),
	`area` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `camp_patients_id` PRIMARY KEY(`id`)
);
