-- AlterTable
ALTER TABLE "AutoCategorizeTask"
ADD COLUMN "resultTagsJson" JSONB;

-- AlterTable
ALTER TABLE "AiModerationSuggestion"
ADD COLUMN "suggestedTagsJson" JSONB;
