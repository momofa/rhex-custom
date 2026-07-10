"use client"

import { useEffect } from "react"

export function TouchNativeNavigation() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
        || !window.matchMedia("(pointer: coarse)").matches
        || !(event.target instanceof Element)
      ) {
        return
      }

      const anchor = event.target.closest("a")
      if (
        !(anchor instanceof HTMLAnchorElement)
        || anchor.target && anchor.target !== "_self"
        || anchor.hasAttribute("download")
        || anchor.dataset.disableTouchNativeNavigation === "true"
      ) {
        return
      }

      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin) {
        return
      }

      const currentDocumentPath = `${window.location.pathname}${window.location.search}`
      const destinationDocumentPath = `${destination.pathname}${destination.search}`
      if (destinationDocumentPath === currentDocumentPath) {
        return
      }

      event.preventDefault()
      window.location.assign(destination.href)
    }

    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [])

  return null
}
