-- CreateEnum
CREATE TYPE "BlogPostSource" AS ENUM ('claude', 'manual', 'topic_queue');

-- CreateEnum
CREATE TYPE "ImageProvider" AS ENUM ('manual', 'pexels');

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageCandidate" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "provider" "ImageProvider" NOT NULL DEFAULT 'pexels',
    "imageUrl" TEXT NOT NULL,
    "photographer" TEXT,
    "photographerUrl" TEXT,
    "sourceUrl" TEXT,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageCandidate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "BlogPost"
  ADD COLUMN "topicId" TEXT,
  ADD COLUMN "imageProvider" "ImageProvider" NOT NULL DEFAULT 'manual',
  ADD COLUMN "imageCredit" TEXT,
  ADD COLUMN "imageSourceUrl" TEXT,
  ADD COLUMN "source" "BlogPostSource" NOT NULL DEFAULT 'claude',
  ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Topic_networkId_idx" ON "Topic"("networkId");

-- CreateIndex
CREATE INDEX "Topic_isActive_idx" ON "Topic"("isActive");

-- CreateIndex
CREATE INDEX "ImageCandidate_postId_idx" ON "ImageCandidate"("postId");

-- CreateIndex
CREATE INDEX "BlogPost_topicId_idx" ON "BlogPost"("topicId");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageCandidate" ADD CONSTRAINT "ImageCandidate_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
