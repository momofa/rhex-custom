import { enqueueBackgroundJob, registerBackgroundJobHandler } from "@/lib/background-jobs"

export interface InteractionEffectHooks {
  onPostLike?: (input: {
    postId: string
    userId: number
    targetUserId: number | null
    liked: boolean
  }) => Promise<void>
  onPostFavorite?: (input: {
    postId: string
    userId: number
    favored: boolean
  }) => Promise<void>
  onCommentCreate?: (input: {
    postId: string
    userId: number
    commentId: string
  }) => Promise<void>
}

const interactionEffectHooks: InteractionEffectHooks[] = []

export function registerInteractionEffectHooks(hooks: InteractionEffectHooks) {
  interactionEffectHooks.push(hooks)
}

async function runPostLikeEffects(input: {
  postId: string
  userId: number
  targetUserId: number | null
  liked: boolean
}) {
  for (const hooks of interactionEffectHooks) {
    await hooks.onPostLike?.(input)
  }
}

async function runPostFavoriteEffects(input: {
  postId: string
  userId: number
  favored: boolean
}) {
  for (const hooks of interactionEffectHooks) {
    await hooks.onPostFavorite?.(input)
  }
}

async function runCommentCreateEffects(input: {
  postId: string
  userId: number
  commentId: string
}) {
  for (const hooks of interactionEffectHooks) {
    await hooks.onCommentCreate?.(input)
  }
}

registerBackgroundJobHandler("interaction.dispatch-post-like-effects", async (payload) => {
  await runPostLikeEffects(payload)
})

registerBackgroundJobHandler("interaction.dispatch-post-favorite-effects", async (payload) => {
  await runPostFavoriteEffects(payload)
})

registerBackgroundJobHandler("interaction.dispatch-comment-create-effects", async (payload) => {
  await runCommentCreateEffects(payload)
})

export function dispatchPostLikeEffects(input: {
  postId: string
  userId: number
  targetUserId: number | null
  liked: boolean
}) {
  return runPostLikeEffects(input)
}

export function dispatchPostFavoriteEffects(input: {
  postId: string
  userId: number
  favored: boolean
}) {
  return runPostFavoriteEffects(input)
}

export function dispatchCommentCreateEffects(input: {
  postId: string
  userId: number
  commentId: string
}) {
  return runCommentCreateEffects(input)
}

export function enqueuePostLikeEffects(input: {
  postId: string
  userId: number
  targetUserId: number | null
  liked: boolean
}) {
  return enqueueBackgroundJob("interaction.dispatch-post-like-effects", input)
}

export function enqueuePostFavoriteEffects(input: {
  postId: string
  userId: number
  favored: boolean
}) {
  return enqueueBackgroundJob("interaction.dispatch-post-favorite-effects", input)
}

export function enqueueCommentCreateEffects(input: {
  postId: string
  userId: number
  commentId: string
}) {
  return enqueueBackgroundJob("interaction.dispatch-comment-create-effects", input)
}
