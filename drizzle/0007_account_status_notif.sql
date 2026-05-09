ALTER TABLE `notifications` MODIFY COLUMN `type` enum('request_decided','new_pending_request','account_status_changed') NOT NULL;
