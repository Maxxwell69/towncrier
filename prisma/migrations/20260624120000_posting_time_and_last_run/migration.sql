-- Add postingTime (default 08:00) and lastAutoRunDate to BlogConfig
ALTER TABLE "BlogConfig" ADD COLUMN "postingTime" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "BlogConfig" ADD COLUMN "lastAutoRunDate" TIMESTAMP(3);
