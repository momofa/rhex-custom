import { registerBackgroundJobHandler } from "@/lib/background-jobs"
import {
  ATTACHMENT_CLEANUP_JOB_NAME,
  ATTACHMENT_REFERENCE_SCAN_JOB_NAME,
  runAttachmentCleanupJob,
  runAttachmentReferenceScanJob,
} from "@/lib/admin-attachments"

registerBackgroundJobHandler(ATTACHMENT_REFERENCE_SCAN_JOB_NAME, async (payload) => {
  await runAttachmentReferenceScanJob(payload.scanJobId)
})

registerBackgroundJobHandler(ATTACHMENT_CLEANUP_JOB_NAME, async (payload) => {
  await runAttachmentCleanupJob(payload.cleanupJobId)
})
