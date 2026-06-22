DROP INDEX IF EXISTS "rss_source_status_nextRunAt_idx";

ALTER TABLE "rss_source"
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "nextRunAt",
  DROP COLUMN IF EXISTS "lastRunAt",
  DROP COLUMN IF EXISTS "lastSuccessAt",
  DROP COLUMN IF EXISTS "lastErrorAt",
  DROP COLUMN IF EXISTS "lastErrorMessage",
  DROP COLUMN IF EXISTS "failureCount",
  DROP COLUMN IF EXISTS "lastRunDurationMs";

DROP TYPE IF EXISTS "RssSourceStatus";
