CREATE TYPE "OAuthClientStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISABLED');

CREATE TABLE "OAuthClient" (
  "id" TEXT NOT NULL,
  "ownerId" INTEGER NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientSecretHash" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "homepageUrl" TEXT,
  "logoUrl" TEXT,
  "redirectUris" TEXT[],
  "scopes" TEXT[],
  "status" "OAuthClientStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "reviewedById" INTEGER,
  "reviewedAt" TIMESTAMPTZ(3),
  "secretRotatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthAuthorizationCode" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "scopes" TEXT[],
  "codeChallenge" TEXT NOT NULL,
  "codeChallengeMethod" TEXT NOT NULL,
  "nonce" TEXT,
  "state" TEXT,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthAuthorizationCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthAccessToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "scopes" TEXT[],
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthRefreshToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "accessTokenId" TEXT,
  "clientId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "scopes" TEXT[],
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMPTZ(3),
  CONSTRAINT "OAuthRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthConsent" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "scopes" TEXT[],
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "OAuthConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");
CREATE INDEX "OAuthClient_ownerId_status_createdAt_idx" ON "OAuthClient"("ownerId", "status", "createdAt");
CREATE INDEX "OAuthClient_status_createdAt_idx" ON "OAuthClient"("status", "createdAt");
CREATE INDEX "OAuthClient_reviewedById_reviewedAt_idx" ON "OAuthClient"("reviewedById", "reviewedAt");

CREATE UNIQUE INDEX "OAuthAuthorizationCode_codeHash_key" ON "OAuthAuthorizationCode"("codeHash");
CREATE INDEX "OAuthAuthorizationCode_clientId_createdAt_idx" ON "OAuthAuthorizationCode"("clientId", "createdAt");
CREATE INDEX "OAuthAuthorizationCode_userId_createdAt_idx" ON "OAuthAuthorizationCode"("userId", "createdAt");
CREATE INDEX "OAuthAuthorizationCode_expiresAt_idx" ON "OAuthAuthorizationCode"("expiresAt");

CREATE UNIQUE INDEX "OAuthAccessToken_tokenHash_key" ON "OAuthAccessToken"("tokenHash");
CREATE INDEX "OAuthAccessToken_clientId_createdAt_idx" ON "OAuthAccessToken"("clientId", "createdAt");
CREATE INDEX "OAuthAccessToken_userId_createdAt_idx" ON "OAuthAccessToken"("userId", "createdAt");
CREATE INDEX "OAuthAccessToken_expiresAt_idx" ON "OAuthAccessToken"("expiresAt");
CREATE INDEX "OAuthAccessToken_revokedAt_idx" ON "OAuthAccessToken"("revokedAt");

CREATE UNIQUE INDEX "OAuthRefreshToken_tokenHash_key" ON "OAuthRefreshToken"("tokenHash");
CREATE INDEX "OAuthRefreshToken_accessTokenId_idx" ON "OAuthRefreshToken"("accessTokenId");
CREATE INDEX "OAuthRefreshToken_clientId_userId_idx" ON "OAuthRefreshToken"("clientId", "userId");
CREATE INDEX "OAuthRefreshToken_userId_createdAt_idx" ON "OAuthRefreshToken"("userId", "createdAt");
CREATE INDEX "OAuthRefreshToken_expiresAt_idx" ON "OAuthRefreshToken"("expiresAt");
CREATE INDEX "OAuthRefreshToken_revokedAt_idx" ON "OAuthRefreshToken"("revokedAt");

CREATE UNIQUE INDEX "OAuthConsent_clientId_userId_key" ON "OAuthConsent"("clientId", "userId");
CREATE INDEX "OAuthConsent_userId_updatedAt_idx" ON "OAuthConsent"("userId", "updatedAt");

ALTER TABLE "OAuthClient"
  ADD CONSTRAINT "OAuthClient_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthClient"
  ADD CONSTRAINT "OAuthClient_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OAuthAuthorizationCode"
  ADD CONSTRAINT "OAuthAuthorizationCode_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthAuthorizationCode"
  ADD CONSTRAINT "OAuthAuthorizationCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthAccessToken"
  ADD CONSTRAINT "OAuthAccessToken_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthAccessToken"
  ADD CONSTRAINT "OAuthAccessToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthRefreshToken"
  ADD CONSTRAINT "OAuthRefreshToken_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthRefreshToken"
  ADD CONSTRAINT "OAuthRefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthRefreshToken"
  ADD CONSTRAINT "OAuthRefreshToken_accessTokenId_fkey"
  FOREIGN KEY ("accessTokenId") REFERENCES "OAuthAccessToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OAuthConsent"
  ADD CONSTRAINT "OAuthConsent_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthConsent"
  ADD CONSTRAINT "OAuthConsent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
