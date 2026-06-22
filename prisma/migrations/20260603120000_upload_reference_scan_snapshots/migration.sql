-- CreateTable
CREATE TABLE "UploadReferenceScanJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "backgroundJobId" TEXT,
    "adminId" INTEGER,
    "ip" TEXT,
    "keyword" TEXT,
    "bucketType" TEXT,
    "limit" INTEGER,
    "total" INTEGER NOT NULL DEFAULT 0,
    "scanned" INTEGER NOT NULL DEFAULT 0,
    "referenced" INTEGER NOT NULL DEFAULT 0,
    "orphan" INTEGER NOT NULL DEFAULT 0,
    "deletedRecords" INTEGER NOT NULL DEFAULT 0,
    "deletedFiles" INTEGER NOT NULL DEFAULT 0,
    "retainedSharedFiles" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UploadReferenceScanJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadReferenceSnapshot" (
    "uploadId" TEXT NOT NULL,
    "scanJobId" TEXT,
    "referenceStatus" TEXT NOT NULL,
    "referenceCount" INTEGER NOT NULL DEFAULT 0,
    "postAttachmentCount" INTEGER NOT NULL DEFAULT 0,
    "directReferenceCount" INTEGER NOT NULL DEFAULT 0,
    "referenceSourcesJson" JSONB,
    "scannedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadReferenceSnapshot_pkey" PRIMARY KEY ("uploadId")
);

-- CreateIndex
CREATE INDEX "UploadReferenceScanJob_kind_status_createdAt_idx" ON "UploadReferenceScanJob"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "UploadReferenceScanJob_status_createdAt_idx" ON "UploadReferenceScanJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UploadReferenceScanJob_adminId_createdAt_idx" ON "UploadReferenceScanJob"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "UploadReferenceScanJob_backgroundJobId_idx" ON "UploadReferenceScanJob"("backgroundJobId");

-- CreateIndex
CREATE INDEX "UploadReferenceScanJob_createdAt_idx" ON "UploadReferenceScanJob"("createdAt");

-- CreateIndex
CREATE INDEX "UploadReferenceSnapshot_referenceStatus_scannedAt_idx" ON "UploadReferenceSnapshot"("referenceStatus", "scannedAt");

-- CreateIndex
CREATE INDEX "UploadReferenceSnapshot_scanJobId_idx" ON "UploadReferenceSnapshot"("scanJobId");

-- CreateIndex
CREATE INDEX "UploadReferenceSnapshot_scannedAt_idx" ON "UploadReferenceSnapshot"("scannedAt");

-- AddForeignKey
ALTER TABLE "UploadReferenceScanJob" ADD CONSTRAINT "UploadReferenceScanJob_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadReferenceSnapshot" ADD CONSTRAINT "UploadReferenceSnapshot_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadReferenceSnapshot" ADD CONSTRAINT "UploadReferenceSnapshot_scanJobId_fkey" FOREIGN KEY ("scanJobId") REFERENCES "UploadReferenceScanJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
