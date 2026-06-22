ALTER TABLE "Zone"
  ADD COLUMN "postRequiredVerificationTypeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "postRequiredBadgeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "replyRequiredVerificationTypeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "replyRequiredBadgeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Board"
  ADD COLUMN "postIdentityGateInherit" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "replyIdentityGateInherit" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "postRequiredVerificationTypeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "postRequiredBadgeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "replyRequiredVerificationTypeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "replyRequiredBadgeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
