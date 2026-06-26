-- Facebook page integration fields on Network
ALTER TABLE "Network"
  ADD COLUMN "fbPageId"         TEXT,
  ADD COLUMN "encryptedFbToken" TEXT,
  ADD COLUMN "fbAutoPost"       BOOLEAN NOT NULL DEFAULT false;

-- Facebook post tracking fields on BlogPost
ALTER TABLE "BlogPost"
  ADD COLUMN "fbPostId"   TEXT,
  ADD COLUMN "fbPostedAt" TIMESTAMP(3);
