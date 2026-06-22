-- CreateEnum
CREATE TYPE "AutoCategorizeTaskSourceType" AS ENUM ('PREVIEW', 'POST_CREATE');

-- CreateTable
CREATE TABLE "AutoCategorizeTask" (
    "id" TEXT NOT NULL,
    "sourceType" "AutoCategorizeTaskSourceType" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "status" "AiReplyTaskStatus" NOT NULL DEFAULT 'PENDING',
    "postId" TEXT,
    "requesterUserId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "appendedContent" TEXT,
    "allowBoardSuggestion" BOOLEAN NOT NULL DEFAULT true,
    "allowTagSuggestion" BOOLEAN NOT NULL DEFAULT true,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "errorMessage" TEXT,
    "resultStatus" TEXT,
    "resultBoardId" TEXT,
    "resultTagIds" TEXT[],
    "resultReasoning" TEXT,
    "resultModelKey" TEXT,
    "resultRawPreview" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AutoCategorizeTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutoCategorizeTask_sourceKey_key" ON "AutoCategorizeTask"("sourceKey");

-- CreateIndex
CREATE INDEX "AutoCategorizeTask_status_scheduledAt_createdAt_idx" ON "AutoCategorizeTask"("status", "scheduledAt", "createdAt");

-- CreateIndex
CREATE INDEX "AutoCategorizeTask_postId_createdAt_idx" ON "AutoCategorizeTask"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "AutoCategorizeTask_requesterUserId_createdAt_idx" ON "AutoCategorizeTask"("requesterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AutoCategorizeTask_sourceType_createdAt_idx" ON "AutoCategorizeTask"("sourceType", "createdAt");

-- AddForeignKey
ALTER TABLE "AutoCategorizeTask" ADD CONSTRAINT "AutoCategorizeTask_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoCategorizeTask" ADD CONSTRAINT "AutoCategorizeTask_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoCategorizeTask" ADD CONSTRAINT "AutoCategorizeTask_resultBoardId_fkey" FOREIGN KEY ("resultBoardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE;
