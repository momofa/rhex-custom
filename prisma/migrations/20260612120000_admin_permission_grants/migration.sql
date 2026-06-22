CREATE TABLE "AdminPermissionGrant" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "permissionKey" TEXT NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminPermissionGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminPermissionGrant_userId_permissionKey_key" ON "AdminPermissionGrant"("userId", "permissionKey");
CREATE INDEX "AdminPermissionGrant_userId_idx" ON "AdminPermissionGrant"("userId");
CREATE INDEX "AdminPermissionGrant_permissionKey_idx" ON "AdminPermissionGrant"("permissionKey");

ALTER TABLE "AdminPermissionGrant"
  ADD CONSTRAINT "AdminPermissionGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
