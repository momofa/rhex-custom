-- CreateEnum
CREATE TYPE "AiModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "AiUsageDaily" (
    "id" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AiUsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSummaryCache" (
    "id" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHitAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSummaryCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModerationSuggestion" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "suggestedBoardId" TEXT,
    "suggestedTagIds" TEXT[],
    "reasoning" TEXT,
    "modelKey" TEXT NOT NULL,
    "status" "AiModerationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" INTEGER,
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiModerationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageDaily_day_idx" ON "AiUsageDaily"("day");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsageDaily_appKey_day_key" ON "AiUsageDaily"("appKey", "day");

-- CreateIndex
CREATE INDEX "AiSummaryCache_sourceKind_sourceId_idx" ON "AiSummaryCache"("sourceKind", "sourceId");

-- CreateIndex
CREATE INDEX "AiSummaryCache_createdAt_idx" ON "AiSummaryCache"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiSummaryCache_sourceKind_sourceId_contentHash_modelKey_key" ON "AiSummaryCache"("sourceKind", "sourceId", "contentHash", "modelKey");

-- CreateIndex
CREATE INDEX "AiModerationSuggestion_postId_idx" ON "AiModerationSuggestion"("postId");

-- CreateIndex
CREATE INDEX "AiModerationSuggestion_status_createdAt_idx" ON "AiModerationSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiModerationSuggestion_reviewerId_idx" ON "AiModerationSuggestion"("reviewerId");

-- AddForeignKey
ALTER TABLE "AiModerationSuggestion" ADD CONSTRAINT "AiModerationSuggestion_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiModerationSuggestion" ADD CONSTRAINT "AiModerationSuggestion_suggestedBoardId_fkey" FOREIGN KEY ("suggestedBoardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiModerationSuggestion" ADD CONSTRAINT "AiModerationSuggestion_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

