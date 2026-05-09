CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(100),
	`entityId` int,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `camp_doctors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campId` int NOT NULL,
	`doctorName` varchar(255) NOT NULL,
	`specialty` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `camp_doctors_id` PRIMARY KEY(`id`)
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
--> statement-breakpoint
CREATE TABLE `camp_tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campId` int NOT NULL,
	`testName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `camp_tests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(100),
	`costCentre` varchar(255),
	`quantity` int DEFAULT 0,
	`unit` varchar(100),
	`notes` text,
	`lowStockThreshold` int DEFAULT 5,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `medicines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(100),
	`form` enum('Tablet','Syrup','Capsule','Injection','Other') DEFAULT 'Tablet',
	`unit` varchar(100),
	`defaultDosage` varchar(255),
	`durationDays` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `medicines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`fatherName` varchar(255),
	`age` int,
	`gender` enum('Male','Female','Other'),
	`phone` varchar(20),
	`area` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patients_id` PRIMARY KEY(`id`),
	CONSTRAINT `patients_patientId_unique` UNIQUE(`patientId`)
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`visitNumber` int NOT NULL DEFAULT 1,
	`visitDate` timestamp NOT NULL DEFAULT (now()),
	`complaint` varchar(500),
	`diagnosis` varchar(500),
	`medicineGiven` varchar(500),
	`bottleSize` varchar(50),
	`dosage` varchar(255),
	`medicineEndDate` timestamp,
	`eligibility` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `visits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','super_admin','receptionist') NOT NULL DEFAULT 'receptionist';