-- Add timezone to BlogConfig (default Eastern Time)
ALTER TABLE "BlogConfig" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/New_York';
