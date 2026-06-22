ALTER TYPE "LotteryPrizeType" ADD VALUE 'REDEEM_CODE';

ALTER TABLE "LotteryPrize"
  ADD COLUMN "codesJson" JSONB;

ALTER TABLE "LotteryWinner"
  ADD COLUMN "redemptionCode" TEXT;
