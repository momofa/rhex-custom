"use client"

export const POST_BOUNTY_RESOLVED_EVENT = "post:bounty-resolved"
export const POST_REPLY_CREATED_EVENT = "post:reply-created"

export interface PostBountyResolvedDetail {
  postId: string
  acceptedAnswerAuthor?: string | null
}

export interface PostReplyCreatedDetail {
  postId: string
  commentId: string
  reviewRequired?: boolean
}

export function dispatchPostBountyResolved(detail: PostBountyResolvedDetail) {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new CustomEvent<PostBountyResolvedDetail>(POST_BOUNTY_RESOLVED_EVENT, {
    detail,
  }))
}

export function addPostBountyResolvedListener(listener: (detail: PostBountyResolvedDetail) => void) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const handleEvent = (event: Event) => {
    const detail = (event as CustomEvent<PostBountyResolvedDetail>).detail
    if (!detail?.postId) {
      return
    }

    listener(detail)
  }

  window.addEventListener(POST_BOUNTY_RESOLVED_EVENT, handleEvent as EventListener)

  return () => {
    window.removeEventListener(POST_BOUNTY_RESOLVED_EVENT, handleEvent as EventListener)
  }
}

export function dispatchPostReplyCreated(detail: PostReplyCreatedDetail) {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new CustomEvent<PostReplyCreatedDetail>(POST_REPLY_CREATED_EVENT, {
    detail,
  }))
}

export function addPostReplyCreatedListener(listener: (detail: PostReplyCreatedDetail) => void) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const handleEvent = (event: Event) => {
    const detail = (event as CustomEvent<PostReplyCreatedDetail>).detail
    if (!detail?.postId || !detail.commentId) {
      return
    }

    listener(detail)
  }

  window.addEventListener(POST_REPLY_CREATED_EVENT, handleEvent as EventListener)

  return () => {
    window.removeEventListener(POST_REPLY_CREATED_EVENT, handleEvent as EventListener)
  }
}
