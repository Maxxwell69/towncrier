-- AlterTable
ALTER TABLE "BlogConfig"
  ADD COLUMN "automationEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoPublishEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoImageEnabled" BOOLEAN NOT NULL DEFAULT true;
