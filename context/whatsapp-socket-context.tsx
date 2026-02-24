"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { io, type Socket } from "socket.io-client"

import { getMe } from "@/lib/auth"

export type WhatsAppSocketUser = {
  id: string
  name: string
  email: string
  role?: string
} | null

type WhatsAppSocketContextValue = {
  user: WhatsAppSocketUser
  socket: Socket | null
  isConnected: boolean
  isLoadingUser: boolean
}

const WhatsAppSocketContext = createContext<WhatsAppSocketContextValue | null>(null)

function getSocketBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || ""
  return apiUrl.replace(/\/api\/?$/, "")
}

export function WhatsAppSocketProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<WhatsAppSocketUser>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoadingUser, setIsLoadingUser] = useState(true)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const me = await getMe()
        if (!mounted) return
        setUser(me || null)
      } catch {
        if (!mounted) return
        setUser(null)
      } finally {
        if (mounted) setIsLoadingUser(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setIsConnected(false)
      if (socket) {
        socket.disconnect()
        setSocket(null)
      }
      return
    }

    if (socket) return

    const nextSocket = io(getSocketBaseUrl(), {
      withCredentials: true,
      transports: ["websocket"],
      autoConnect: true,
    })

    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)
    const handleConnectError = () => setIsConnected(false)

    nextSocket.on("connect", handleConnect)
    nextSocket.on("disconnect", handleDisconnect)
    nextSocket.on("connect_error", handleConnectError)

    setSocket(nextSocket)
    setIsConnected(nextSocket.connected)

    return () => {
      nextSocket.off("connect", handleConnect)
      nextSocket.off("disconnect", handleDisconnect)
      nextSocket.off("connect_error", handleConnectError)
      nextSocket.disconnect()
      setSocket((current) => (current === nextSocket ? null : current))
      setIsConnected(false)
    }
  }, [user?.id, socket])

  const value = useMemo(
    () => ({
      user,
      socket,
      isConnected,
      isLoadingUser,
    }),
    [user, socket, isConnected, isLoadingUser],
  )

  return (
    <WhatsAppSocketContext.Provider value={value}>
      {children}
    </WhatsAppSocketContext.Provider>
  )
}

export function useWhatsAppSocket() {
  const context = useContext(WhatsAppSocketContext)
  if (!context) {
    throw new Error("useWhatsAppSocket deve ser usado dentro de WhatsAppSocketProvider")
  }
  return context
}
