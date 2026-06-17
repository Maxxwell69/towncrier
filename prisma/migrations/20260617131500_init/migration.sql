-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NetworkStatus" AS ENUM ('active', 'paused');

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('draft', 'publishing', 'published', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Network" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ghlLocationId" TEXT,
    "ghlCompanyId" TEXT,
    "credentialType" TEXT NOT NULL DEFAULT 'manual',
    "encryptedCredentialPayload" TEXT NOT NULL,
    "status" "NetworkStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogConfig" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "blogId" TEXT NOT NULL,
    "defaultTopic" TEXT NOT NULL,
    "categories" TEXT[],
    "postingDays" TEXT[],
    "imageStyle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "categories" TEXT[],
    "imagePrompt" TEXT,
    "imageUrl" TEXT,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'draft',
    "ghlPostId" TEXT,
    "publishResponse" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Network_ownerId_idx" ON "Network"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogConfig_networkId_key" ON "BlogConfig"("networkId");

-- CreateIndex
CREATE INDEX "BlogPost_networkId_idx" ON "BlogPost"("networkId");

-- CreateIndex
CREATE INDEX "BlogPost_status_idx" ON "BlogPost"("status");

-- AddForeignKey
ALTER TABLE "Network" ADD CONSTRAINT "Network_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogConfig" ADD CONSTRAINT "BlogConfig_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;
