"use client"

import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

interface PowCaptchaFieldProps {
  scope: "login" | "register" | "sms"
  onTokenChange: (value: string) => void
  onNonceChange: (value: string) => void
  onLoadError?: (message: string) => void
}

type PowChallengeResponse = {
  code?: number
  message?: string
  data?: {
    captchaToken?: string
    difficulty?: number
    expiresAt?: number
  }
}

type PowWorkerMessage =
  | { type: "progress"; attempts: number; workerIndex: number }
  | { type: "success"; attempts: number; nonce: number; hash: string; workerIndex: number }

const POW_WORKER_SOURCE = `var _0x0988cf=(942325^942333)+(191799^191792);const encoder=new TextEncoder();_0x0988cf=(337061^337060)+(738037^738038);function toHex(buffer){return Array['\u0066\u0072\u006F\u006D'](new Uint8Array(buffer),item=>item['\u0074\u006F\u0053\u0074\u0072\u0069\u006E\u0067'](907355^907339)['\u0070\u0061\u0064\u0053\u0074\u0061\u0072\u0074'](355524^355526,"\u0030"))['\u006A\u006F\u0069\u006E']("");}self['\u006F\u006E\u006D\u0065\u0073\u0073\u0061\u0067\u0065']=async function(event,_0x89g43b){var _0xe294ad;const _0x89eb8c=event['\u0064\u0061\u0074\u0061']||{};_0xe294ad=(342048^342057)+(974600^974602);const _0xce_0xe2b=String(_0x89eb8c['\u0063\u0068\u0061\u006C\u006C\u0065\u006E\u0067\u0065']||"");var _0xe630gc=(517323^517314)+(894675^894673);const _0x5db3f=Number(_0x89eb8c['\u0064\u0069\u0066\u0066\u0069\u0063\u0075\u006C\u0074\u0079']||556872^556872);_0xe630gc=322107^322104;var _0xbd61e=(782957^782955)+(269631^269624);const _0xe637f=Number(_0x89eb8c['\u0073\u0074\u0061\u0072\u0074\u004E\u006F\u006E\u0063\u0065']||932987^932987);_0xbd61e=897146^897139;var _0x47c;const _0x8ge72d=Number(_0x89eb8c['\u0073\u0074\u0065\u0070']||312814^312815);_0x47c=(903653^903648)+(372716^372709);const _0xad266f=Number(_0x89eb8c['\u0077\u006F\u0072\u006B\u0065\u0072\u0049\u006E\u0064\u0065\u0078']||701101^701101);var _0x_0x3a1;const _0xa_0xc8c="\u0030"['\u0072\u0065\u0070\u0065\u0061\u0074'](Math['\u006D\u0061\u0078'](216332^216332,_0x5db3f));_0x_0x3a1=(443635^443634)+(428941^428938);const _0x4c59c=_0xce_0xe2b['\u0073\u0070\u006C\u0069\u0074']("\u002D")[198235^198235]||"";let _0x31e=_0xe637f;var _0x3869e=(565227^565226)+(543382^543376);_0x89g43b=663853^663853;_0x3869e=(610108^610101)+(103691^103691);var _0xf5b=(590068^590076)+(624391^624391);let _0x6ffgg=Date['\u006E\u006F\u0077']();_0xf5b=796903^796899;while(!![]){var _0x5fea8b=(965237^965235)+(105898^105891);const _0x72b=await crypto['\u0073\u0075\u0062\u0074\u006C\u0065']['\u0064\u0069\u0067\u0065\u0073\u0074']("\u0053\u0048\u0041\u002D\u0032\u0035\u0036",encoder['\u0065\u006E\u0063\u006F\u0064\u0065'](_0x4c59c+_0x31e));_0x5fea8b="ojejmk".split("").reverse().join("");var _0x1a9dac=(555731^555730)+(820111^820109);const _0xf3f=toHex(_0x72b);_0x1a9dac=(987935^987931)+(484854^484852);_0x89g43b+=164000^164001;if(_0xf3f['\u0073\u0074\u0061\u0072\u0074\u0073\u0057\u0069\u0074\u0068'](_0xa_0xc8c)){self['\u0070\u006F\u0073\u0074\u004D\u0065\u0073\u0073\u0061\u0067\u0065']({'\u0074\u0079\u0070\u0065':"success",'\u0061\u0074\u0074\u0065\u006D\u0070\u0074\u0073':_0x89g43b,'\u006E\u006F\u006E\u0063\u0065':_0x31e,"hash":_0xf3f,'\u0077\u006F\u0072\u006B\u0065\u0072\u0049\u006E\u0064\u0065\u0078':_0xad266f});return;}_0x31e+=_0x8ge72d;var _0xdd156e;const _0xf8f39e=Date['\u006E\u006F\u0077']();_0xdd156e=(685647^685642)+(237691^237691);if(_0xf8f39e-_0x6ffgg>=(875851^875907)){self['\u0070\u006F\u0073\u0074\u004D\u0065\u0073\u0073\u0061\u0067\u0065']({"type":"\u0070\u0072\u006F\u0067\u0072\u0065\u0073\u0073",'\u0061\u0074\u0074\u0065\u006D\u0070\u0074\u0073':_0x89g43b,"workerIndex":_0xad266f});_0x6ffgg=_0xf8f39e;}}};
`
// const POW_WORKER_SOURCE = `
// const encoder = new TextEncoder();

// function toHex(buffer) {
//   return Array.from(new Uint8Array(buffer), (item) => item.toString(16).padStart(2, "0")).join("");
// }

// self.onmessage = async function (event) {
//   const data = event.data || {};
//   const challenge = String(data.challenge || "");
//   const difficulty = Number(data.difficulty || 0);
//   const startNonce = Number(data.startNonce || 0);
//   const step = Number(data.step || 1);
//   const workerIndex = Number(data.workerIndex || 0);
//   const target = "0".repeat(Math.max(0, difficulty));
//   const rawData = challenge.split("-")[0] || "";

//   let nonce = startNonce;
//   let attempts = 0;
//   let lastReportAt = Date.now();

//   while (true) {
//     const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawData + nonce));
//     const hash = toHex(hashBuffer);
//     attempts += 1;

//     if (hash.startsWith(target)) {
//       self.postMessage({ type: "success", attempts, nonce, hash, workerIndex });
//       return;
//     }

//     nonce += step;

//     const now = Date.now();
//     if (now - lastReportAt >= 200) {
//       self.postMessage({ type: "progress", attempts, workerIndex });
//       lastReportAt = now;
//     }
//   }
// };

export function PowCaptchaField({ scope, onTokenChange, onNonceChange, onLoadError }: PowCaptchaFieldProps) {
  const [challengeToken, setChallengeToken] = useState("")
  const [difficulty, setDifficulty] = useState(0)
  const [workerCount, setWorkerCount] = useState(1)
  const [status, setStatus] = useState<"idle" | "loading" | "mining" | "solved" | "error">("idle")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const workersRef = useRef<Worker[]>([])
  const workerAttemptsRef = useRef<number[]>([])
  const workerUrlRef = useRef("")

  const stopMining = useCallback(() => {
    for (const worker of workersRef.current) {
      worker.terminate()
    }

    workersRef.current = []
    workerAttemptsRef.current = []

    if (workerUrlRef.current) {
      URL.revokeObjectURL(workerUrlRef.current)
      workerUrlRef.current = ""
    }
  }, [])

  const refreshChallenge = useCallback(async () => {
    stopMining()
    setChallengeToken("")
    setDifficulty(0)
    setStatus("loading")
    setIsRefreshing(true)
    onTokenChange("")
    onNonceChange("")

    try {
      const response = await fetch(`/api/auth/pow?scope=${scope}&ts=${Date.now()}`, { cache: "no-store" })
      const result = await response.json() as PowChallengeResponse

      if (!response.ok || result.code !== 0) {
        const message = result.message ?? "PoW 挑战加载失败"
        setStatus("error")
        onLoadError?.(message)
        return
      }

      const nextChallenge = result.data?.captchaToken ?? ""
      const nextDifficulty = Number(result.data?.difficulty ?? 0)
      const availableWorkers = typeof navigator === "undefined" ? 1 : Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2) || 1))

      setChallengeToken(nextChallenge)
      setDifficulty(nextDifficulty)
      setWorkerCount(availableWorkers)

      onTokenChange(nextChallenge)

      return {
        challengeToken: nextChallenge,
        difficulty: nextDifficulty,
        workerCount: availableWorkers,
      }
    } catch {
      const message = "PoW 挑战加载失败"
      setStatus("error")
      onLoadError?.(message)
      return null
    } finally {
      setIsRefreshing(false)
    }
  }, [onLoadError, onNonceChange, onTokenChange, scope, stopMining])

  const startMining = useCallback((options?: {
    challengeToken?: string
    difficulty?: number
    workerCount?: number
  }) => {
    const activeChallengeToken = options?.challengeToken ?? challengeToken
    const activeDifficulty = options?.difficulty ?? difficulty
    const activeWorkerCount = Math.max(1, options?.workerCount ?? workerCount)

    if (!activeChallengeToken || activeDifficulty < 1) {
      return
    }

    stopMining()
    onNonceChange("")
    setStatus("mining")

    const workerUrl = URL.createObjectURL(new Blob([POW_WORKER_SOURCE], { type: "application/javascript" }))
    workerUrlRef.current = workerUrl
    workerAttemptsRef.current = Array.from({ length: activeWorkerCount }, () => 0)

    const updateAttempts = (workerIndex: number, value: number) => {
      workerAttemptsRef.current[workerIndex] = value
    }

    const nextWorkers = Array.from({ length: activeWorkerCount }, (_, workerIndex) => {
      const worker = new Worker(workerUrl)

      worker.onmessage = (event: MessageEvent<PowWorkerMessage>) => {
        updateAttempts(event.data.workerIndex, event.data.attempts)

        if (event.data.type !== "success") {
          return
        }

        setStatus("solved")
        onNonceChange(String(event.data.nonce))
        stopMining()
      }

      worker.onerror = () => {
        setStatus("error")
        onNonceChange("")
        stopMining()
      }

      worker.postMessage({
        challenge: activeChallengeToken,
        difficulty: activeDifficulty,
        startNonce: workerIndex,
        step: activeWorkerCount,
        workerIndex,
      })

      return worker
    })

    workersRef.current = nextWorkers
  }, [challengeToken, difficulty, onNonceChange, stopMining, workerCount])

  const startVerification = useCallback(async () => {
    const challenge = await refreshChallenge()

    if (!challenge) {
      return
    }

    startMining(challenge)
  }, [refreshChallenge, startMining])

  useEffect(() => {
    return () => {
      stopMining()
    }
  }, [stopMining])

  return (
    <div className="space-y-2 rounded-xl">
      <p className="text-sm font-medium">验证码</p>
      <div className="rounded-[18px] ">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={status === "solved" ? "flex h-11 min-w-[220px] items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700" : "flex h-11 min-w-[220px] items-center justify-between rounded-2xl border border-border bg-background px-4 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70"}
            disabled={status === "loading" || status === "mining"}
            onClick={() => void startVerification()}
          >
            <span className="flex items-center gap-3">
              {status === "loading" || status === "mining" ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className={status === "solved" ? "flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[11px] text-white" : "flex h-4 w-4  items-center justify-center  rounded-full border border-muted-foreground/40 bg-background"}>✓</span>}
              <span>{status === "solved" ? "验证已完成" : status === "loading" || status === "mining" ? "正在验证..." : "点击开始验证"}</span>
            </span>
            <span className="text-xs text-muted-foreground">PoW</span>
          </button>

          {(status === "solved" || status === "error") && !isRefreshing ? (
            <button type="button" className="text-xs text-primary hover:opacity-80" onClick={() => void startVerification()}>
              重新验证
            </button>
          ) : null}
        </div>

 
      </div>
    </div>
  )
}
