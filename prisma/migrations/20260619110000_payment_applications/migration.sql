CREATE TYPE "PaymentApplicationStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'DISABLED');

CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

CREATE TABLE "PaymentApplication" (
  "id" TEXT NOT NULL,
  "ownerId" INTEGER NOT NULL,
  "paymentId" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "homepageUrl" TEXT,
  "callbackUrl" TEXT NOT NULL,
  "status" "PaymentApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "reviewedById" INTEGER,
  "reviewedAt" TIMESTAMPTZ(3),
  "secretRotatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PaymentApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentTransaction" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "payerId" INTEGER,
  "orderId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "platformFee" INTEGER NOT NULL DEFAULT 0,
  "merchantPoints" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "paidAt" TIMESTAMPTZ(3),
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentApplication_paymentId_key" ON "PaymentApplication"("paymentId");
CREATE INDEX "PaymentApplication_ownerId_status_createdAt_idx" ON "PaymentApplication"("ownerId", "status", "createdAt");
CREATE INDEX "PaymentApplication_status_createdAt_idx" ON "PaymentApplication"("status", "createdAt");
CREATE INDEX "PaymentApplication_reviewedById_reviewedAt_idx" ON "PaymentApplication"("reviewedById", "reviewedAt");

CREATE UNIQUE INDEX "PaymentTransaction_transactionId_key" ON "PaymentTransaction"("transactionId");
CREATE UNIQUE INDEX "PaymentTransaction_applicationId_orderId_key" ON "PaymentTransaction"("applicationId", "orderId");
CREATE INDEX "PaymentTransaction_applicationId_status_createdAt_idx" ON "PaymentTransaction"("applicationId", "status", "createdAt");
CREATE INDEX "PaymentTransaction_payerId_createdAt_idx" ON "PaymentTransaction"("payerId", "createdAt");
CREATE INDEX "PaymentTransaction_status_expiresAt_idx" ON "PaymentTransaction"("status", "expiresAt");

ALTER TABLE "PaymentApplication"
  ADD CONSTRAINT "PaymentApplication_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentApplication"
  ADD CONSTRAINT "PaymentApplication_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentTransaction"
  ADD CONSTRAINT "PaymentTransaction_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "PaymentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentTransaction"
  ADD CONSTRAINT "PaymentTransaction_payerId_fkey"
  FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
