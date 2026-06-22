ALTER TABLE "Zone" ADD COLUMN "allowPostAuthorOfflineComment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Zone" ADD COLUMN "allowUserOfflineOwnComment" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Board" ADD COLUMN "allowPostAuthorOfflineComment" BOOLEAN;
ALTER TABLE "Board" ADD COLUMN "allowUserOfflineOwnComment" BOOLEAN;
