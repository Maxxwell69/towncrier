-- CreateEnum
CREATE TYPE "PublishPlatform" AS ENUM ('vercel', 'ghl', 'wordpress');

-- Alter Network for Vercel site profiles.
ALTER TABLE "Network"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "domain" TEXT,
  ADD COLUMN "platform" "PublishPlatform" NOT NULL DEFAULT 'vercel',
  ADD COLUMN "locationName" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "serviceArea" TEXT,
  ADD COLUMN "authorName" TEXT,
  ADD COLUMN "authorTitle" TEXT,
  ADD COLUMN "authorBio" TEXT,
  ADD COLUMN "authorImageUrl" TEXT,
  ADD COLUMN "siteApiKeyHash" TEXT,
  ADD COLUMN "siteApiKeyHint" TEXT,
  ADD COLUMN "revalidateUrl" TEXT,
  ADD COLUMN "revalidateSecret" TEXT;

UPDATE "Network"
SET "slug" = "id"
WHERE "slug" IS NULL;

ALTER TABLE "Network"
  ALTER COLUMN "slug" SET NOT NULL,
  ALTER COLUMN "encryptedCredentialPayload" DROP NOT NULL;

CREATE UNIQUE INDEX "Network_slug_key" ON "Network"("slug");

-- Vercel-backed sites do not require GHL blog IDs.
ALTER TABLE "BlogConfig"
  ALTER COLUMN "blogId" DROP NOT NULL;

-- Add public blog delivery metadata.
ALTER TABLE "BlogPost"
  ADD COLUMN "bodyHtml" TEXT,
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "seoDescription" TEXT,
  ADD COLUMN "canonicalUrl" TEXT,
  ADD COLUMN "featuredImageAlt" TEXT,
  ADD COLUMN "externalPostId" TEXT,
  ADD COLUMN "publishedTo" TEXT;

CREATE UNIQUE INDEX "BlogPost_networkId_slug_key" ON "BlogPost"("networkId", "slug");
