CREATE TYPE "LotteryPrizeType" AS ENUM ('MANUAL', 'POINTS', 'VIP');

CREATE TYPE "LotteryVipPlan" AS ENUM ('MONTH', 'QUARTER', 'YEAR');

ALTER TABLE "LotteryPrize"
  ADD COLUMN "type" "LotteryPrizeType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "pointsAmount" INTEGER,
  ADD COLUMN "vipPlan" "LotteryVipPlan",
  ADD COLUMN "unitCostPoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "LotteryWinner"
  ADD COLUMN "deliveredAt" TIMESTAMPTZ(3);

CREATE INDEX "LotteryPrize_postId_type_idx" ON "LotteryPrize"("postId", "type");
