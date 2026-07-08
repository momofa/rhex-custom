import type { Metadata } from "next"
import { Suspense } from "react"

import { generateRootMetadata, RootRuntimeProviders } from "@/app/root-runtime-providers"





import "./globals.css"
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const dynamic = "force-dynamic"

const rootInitStyles = `
  @keyframes root-boot-spinner {
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }

  html[data-root-init="pending"] {
    overflow: hidden;
  }

  html[data-root-init="pending"] body {
    visibility: hidden;
    overflow: hidden;
  }

  html[data-root-init="pending"]::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: hsl(var(--background, 0 0% 100%));
  }

  html[data-root-init="pending"]::after {
    content: "";
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 9999;
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    border: 2px solid hsl(var(--border, 0 0% 88%));
    border-top-color: hsl(var(--primary, 0 0% 12%));
    transform: translate(-50%, -50%);
    animation: root-boot-spinner 0.72s linear infinite;
  }
`

const noScriptRootInitStyles = `
  html[data-root-init="pending"] {
    overflow: auto;
  }

  html[data-root-init="pending"] body {
    visibility: visible !important;
    overflow: visible !important;
  }

  html[data-root-init="pending"]::before,
  html[data-root-init="pending"]::after {
    display: none;
  }
`

export async function generateMetadata(): Promise<Metadata> {
  return generateRootMetadata()
}



export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (

    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}
      data-root-init="pending"
    >
      <head>
        <style>{rootInitStyles}</style>
        <noscript>
          <style>{noScriptRootInitStyles}</style>
        </noscript>
      </head>
      <body style={{ visibility: "hidden", overflow: "hidden" }}>
        <Suspense fallback={null}>
          <RootRuntimeProviders>{children}</RootRuntimeProviders>
        </Suspense>




      </body>

    </html>
  )
}
