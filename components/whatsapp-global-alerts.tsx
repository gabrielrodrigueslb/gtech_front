"use client"

import { useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"

import { getMe } from "@/lib/auth"
import {
  connectWhatsApp,
  getWhatsAppStatus,
  type WhatsAppConversation,
  type WhatsAppMessage,
} from "@/lib/whatsapp"
import {
  DEFAULT_WHATSAPP_ALERT_PREFERENCES,
  type WhatsAppAlertPreferences,
  WHATSAPP_ALERT_PREFS_EVENT,
  readWhatsAppAlertPreferences,
} from "@/lib/whatsapp-alert-preferences"

type AuthUser = {
  id: string
  name: string
  email: string
}

type WhatsAppSocketMessageEvent = {
  conversationId: string
  message: WhatsAppMessage
  conversation?: WhatsAppConversation | null
}

type GlobalAlertToast = {
  id: string
  title: string
  body: string
  conversationId: string
}

function getSocketBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || ""
  return apiUrl.replace(/\/api\/?$/, "")
}

function getConversationTitle(conversation?: WhatsAppConversation | null) {
  if (!conversation) return "Nova mensagem"
  return (
    conversation.contact?.name ||
    conversation.pushName ||
    conversation.waName ||
    conversation.phone ||
    conversation.remoteJid
  )
}

export default function WhatsAppGlobalAlerts() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [toasts, setToasts] = useState<GlobalAlertToast[]>([])
  const [prefs, setPrefs] = useState<WhatsAppAlertPreferences>(DEFAULT_WHATSAPP_ALERT_PREFERENCES)
  const socketRef = useRef<Socket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const alertedMessageIdsRef = useRef<Set<string>>(new Set())
  const timeoutMapRef = useRef<Map<string, number>>(new Map())
  const autoConnectAttemptedRef = useRef(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const me = await getMe()
        if (!mounted || !me?.id) return
        setUser(me)
      } catch {
        // ignore outside auth/session
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    setPrefs(readWhatsAppAlertPreferences())

    const handleStorage = () => setPrefs(readWhatsAppAlertPreferences())
    const handleCustom = () => setPrefs(readWhatsAppAlertPreferences())
    window.addEventListener("storage", handleStorage)
    window.addEventListener(WHATSAPP_ALERT_PREFS_EVENT, handleCustom as EventListener)

    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(WHATSAPP_ALERT_PREFS_EVENT, handleCustom as EventListener)
    }
  }, [])

  useEffect(() => {
    return () => {
      for (const timeoutId of timeoutMapRef.current.values()) {
        window.clearTimeout(timeoutId)
      }
      timeoutMapRef.current.clear()
      try {
        audioCtxRef.current?.close()
      } catch {
        // noop
      }
    }
  }, [])

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    const timeoutId = timeoutMapRef.current.get(id)
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      timeoutMapRef.current.delete(id)
    }
  }

  function playBeep() {
    if (!prefs.soundEnabled) return
    if (typeof window === "undefined") return

    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioCtx) return

    try {
      const ctx = audioCtxRef.current || new AudioCtx()
      audioCtxRef.current = ctx

      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => {})
      }

      const now = ctx.currentTime
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(880, now)
      oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.16)

      gainNode.gain.setValueAtTime(0.0001, now)
      gainNode.gain.exponentialRampToValueAtTime(0.07, now + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.start(now)
      oscillator.stop(now + 0.18)
    } catch {
      // browser may block autoplay audio until user gesture
    }
  }

  function pushToastAndNotify(payload: WhatsAppSocketMessageEvent) {
    if (!payload?.message || payload.message.fromMe || !payload.message.id) return

    if (
      user &&
      payload.conversation?.assignedUserId &&
      payload.conversation.assignedUserId !== user.id
    ) {
      return
    }

    if (alertedMessageIdsRef.current.has(payload.message.id)) return
    alertedMessageIdsRef.current.add(payload.message.id)
    if (alertedMessageIdsRef.current.size > 600) {
      const oldest = alertedMessageIdsRef.current.values().next().value
      if (oldest) alertedMessageIdsRef.current.delete(oldest)
    }

    const title = getConversationTitle(payload.conversation)
    const body =
      (payload.message.body || "").replace(/\s+/g, " ").trim() ||
      `Mensagem ${String(payload.message.type || "").toUpperCase() || "recebida"}`

    if (prefs.inAppToastEnabled) {
      const id = `${payload.message.id}-${Date.now()}`
      setToasts((prev) =>
        [
          {
            id,
            title,
            body,
            conversationId: payload.conversationId,
          },
          ...prev,
        ].slice(0, 5),
      )

      const timeoutId = window.setTimeout(() => dismissToast(id), 7000)
      timeoutMapRef.current.set(id, timeoutId)
    }

    playBeep()

    if (
      prefs.browserNotificationEnabled &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        const notification = new Notification(`WhatsApp: ${title}`, {
          body,
          tag: `wa-global-${payload.conversationId}`,
        })
        notification.onclick = () => {
          window.focus()
          window.location.href = `/main/chat?conversationId=${encodeURIComponent(payload.conversationId)}`
          notification.close()
        }
      } catch {
        // noop
      }
    }
  }

  useEffect(() => {
    if (!user) return

    const socket = io(getSocketBaseUrl(), {
      withCredentials: true,
      transports: ["websocket"],
      autoConnect: true,
    })

    socketRef.current = socket
    socket.on("whatsapp:message.created", (payload: WhatsAppSocketMessageEvent) => {
      pushToastAndNotify(payload)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user, prefs.inAppToastEnabled, prefs.browserNotificationEnabled, prefs.soundEnabled])

  useEffect(() => {
    if (!user?.id) return
    if (autoConnectAttemptedRef.current) return
    autoConnectAttemptedRef.current = true

    ;(async () => {
      try {
        const status = await getWhatsAppStatus()
        if (!status) return

        const shouldConnect = ["disconnected", "logged_out", "error"].includes(
          String(status.status || "").toLowerCase(),
        )

        if (!shouldConnect) return

        await connectWhatsApp()
      } catch (error) {
        console.warn("WhatsApp auto-connect falhou:", error)
      }
    })()
  }, [user?.id])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[80] w-[min(26rem,calc(100vw-2rem))] space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className="w-full text-left rounded-xl border p-3 shadow-lg cursor-pointer pointer-events-auto"
          style={{
            borderColor: "rgba(59,130,246,0.24)",
            backgroundColor: "rgba(17,24,39,0.94)",
          }}
          onClick={() => {
            dismissToast(toast.id)
            window.location.href = `/main/chat?conversationId=${encodeURIComponent(toast.conversationId)}`
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate text-white">{toast.title}</p>
              <p className="text-xs mt-0.5 text-white/60">Nova mensagem recebida</p>
            </div>
            <span className="text-[11px] text-blue-300">Abrir</span>
          </div>
          <p className="text-sm mt-2 line-clamp-2 text-white/90">{toast.body}</p>
        </button>
      ))}
    </div>
  )
}
