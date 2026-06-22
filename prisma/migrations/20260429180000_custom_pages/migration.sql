-- CreateTable
CREATE TABLE "CustomPage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "routePath" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "includeHeader" BOOLEAN NOT NULL DEFAULT true,
    "includeFooter" BOOLEAN NOT NULL DEFAULT true,
    "includeLeftSidebar" BOOLEAN NOT NULL DEFAULT false,
    "includeRightSidebar" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(3),
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CustomPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomPage_routePath_key" ON "CustomPage"("routePath");

-- CreateIndex
CREATE INDEX "CustomPage_status_publishedAt_idx" ON "CustomPage"("status", "publishedAt");

-- AddForeignKey
ALTER TABLE "CustomPage" ADD CONSTRAINT "CustomPage_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
