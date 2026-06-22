-- Improve high-concurrency comment list pagination and comment gift aggregation.
CREATE INDEX "comment_thread_order_idx"
  ON "Comment" ("postId", "status", "parentId", "isPinnedByAuthor", "createdAt", "id");

CREATE INDEX "comment_flat_order_idx"
  ON "Comment" ("postId", "status", "isPinnedByAuthor", "createdAt", "id");

CREATE INDEX "post_gift_comment_gift_created_idx"
  ON "PostGiftEvent" ("commentId", "giftId", "createdAt");
