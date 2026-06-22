-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('NEWBIE', 'DAILY', 'CHALLENGE');

-- CreateEnum
CREATE TYPE "TaskCycleType" AS ENUM ('PERMANENT', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "TaskConditionType" AS ENUM (
    'CHECK_IN_COUNT',
    'APPROVED_POST_COUNT',
    'APPROVED_COMMENT_COUNT',
    'GIVEN_LIKE_COUNT',
    'RECEIVED_LIKE_COUNT',
    'APPROVED_COMMENT_DISTINCT_POST_COUNT'
);

-- CreateEnum
CREATE TYPE "TaskDefinitionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskRewardTier" AS ENUM ('NORMAL', 'VIP1', 'VIP2', 'VIP3');

-- CreateEnum
CREATE TYPE "UserTaskProgressStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "TaskDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL,
    "cycleType" "TaskCycleType" NOT NULL,
    "conditionType" "TaskConditionType" NOT NULL,
    "conditionConfigJson" JSONB,
    "targetCount" INTEGER NOT NULL,
    "rewardNormalMin" INTEGER NOT NULL DEFAULT 0,
    "rewardNormalMax" INTEGER NOT NULL DEFAULT 0,
    "rewardVip1Min" INTEGER NOT NULL DEFAULT 0,
    "rewardVip1Max" INTEGER NOT NULL DEFAULT 0,
    "rewardVip2Min" INTEGER NOT NULL DEFAULT 0,
    "rewardVip2Max" INTEGER NOT NULL DEFAULT 0,
    "rewardVip3Min" INTEGER NOT NULL DEFAULT 0,
    "rewardVip3Max" INTEGER NOT NULL DEFAULT 0,
    "status" "TaskDefinitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TaskDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTaskProgress" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "categorySnapshot" "TaskCategory" NOT NULL,
    "cycleTypeSnapshot" "TaskCycleType" NOT NULL,
    "conditionTypeSnapshot" "TaskConditionType" NOT NULL,
    "targetCountSnapshot" INTEGER NOT NULL,
    "rewardTierSnapshot" "TaskRewardTier" NOT NULL,
    "rewardMinSnapshot" INTEGER NOT NULL,
    "rewardMaxSnapshot" INTEGER NOT NULL,
    "progressCount" INTEGER NOT NULL DEFAULT 0,
    "settledRewardPoints" INTEGER,
    "status" "UserTaskProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMPTZ(3),
    "settledAt" TIMESTAMPTZ(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserTaskProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTaskEventLedger" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTaskEventLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskDefinition_code_key" ON "TaskDefinition"("code");

-- CreateIndex
CREATE INDEX "TaskDefinition_status_conditionType_sortOrder_idx" ON "TaskDefinition"("status", "conditionType", "sortOrder");

-- CreateIndex
CREATE INDEX "TaskDefinition_category_cycleType_sortOrder_idx" ON "TaskDefinition"("category", "cycleType", "sortOrder");

-- CreateIndex
CREATE INDEX "TaskDefinition_startsAt_endsAt_idx" ON "TaskDefinition"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserTaskProgress_userId_taskId_cycleKey_key" ON "UserTaskProgress"("userId", "taskId", "cycleKey");

-- CreateIndex
CREATE INDEX "UserTaskProgress_userId_categorySnapshot_cycleKey_idx" ON "UserTaskProgress"("userId", "categorySnapshot", "cycleKey");

-- CreateIndex
CREATE INDEX "UserTaskProgress_userId_status_updatedAt_idx" ON "UserTaskProgress"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "UserTaskProgress_taskId_cycleKey_idx" ON "UserTaskProgress"("taskId", "cycleKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserTaskEventLedger_userId_taskId_cycleKey_eventKey_key" ON "UserTaskEventLedger"("userId", "taskId", "cycleKey", "eventKey");

-- CreateIndex
CREATE INDEX "UserTaskEventLedger_userId_createdAt_idx" ON "UserTaskEventLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserTaskEventLedger_taskId_cycleKey_createdAt_idx" ON "UserTaskEventLedger"("taskId", "cycleKey", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskDefinition" ADD CONSTRAINT "TaskDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDefinition" ADD CONSTRAINT "TaskDefinition_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaskProgress" ADD CONSTRAINT "UserTaskProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaskProgress" ADD CONSTRAINT "UserTaskProgress_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaskEventLedger" ADD CONSTRAINT "UserTaskEventLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTaskEventLedger" ADD CONSTRAINT "UserTaskEventLedger_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
