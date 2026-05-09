ALTER TABLE `camp_patients` ADD `patientId` int;--> statement-breakpoint
ALTER TABLE `camp_patients` ADD `visitId` int;--> statement-breakpoint
ALTER TABLE `camp_patients` ADD `doctor` varchar(255);--> statement-breakpoint
ALTER TABLE `camp_patients` ADD `complaint` text;--> statement-breakpoint
ALTER TABLE `camp_patients` ADD `diagnosis` text;--> statement-breakpoint
ALTER TABLE `camp_patients` ADD `tests` text;--> statement-breakpoint
ALTER TABLE `camp_patients` ADD `medicines` text;--> statement-breakpoint
ALTER TABLE `visits` ADD `campId` int;--> statement-breakpoint
ALTER TABLE `visits` ADD `doctor` varchar(255);--> statement-breakpoint
CREATE INDEX `camp_patients_patient_idx` ON `camp_patients` (`patientId`);--> statement-breakpoint
CREATE INDEX `visits_camp_idx` ON `visits` (`campId`);