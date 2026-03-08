'use client'

import { useEffect, useState } from 'react'
import { getConversationProfile } from '@/lib/whatsapp-client'

const AVATAR_CACHE_TTL_MS = 30 * 60 * 1000

type AvatarCacheEntry = {
  value: string | null
  expiresAt: number
}

const avatarCache = new Map<string, AvatarCacheEntry>()
const avatarRequestCache = new Map<string, Promise<string | null>>()

function getCachedAvatar(conversationId?: string | null) {
  if (!conversationId) return null

  const entry = avatarCache.get(conversationId)
  if (!entry) return null
  if (entry.value == null) {
    avatarCache.delete(conversationId)
    return null
  }
  if (entry.expiresAt <= Date.now()) {
    avatarCache.delete(conversationId)
    return null
  }

  return entry.value
}

async function loadAvatarForConversation(conversationId: string) {
  const cachedValue = getCachedAvatar(conversationId)
  if (cachedValue !== null) {
    return cachedValue
  }

  const pendingRequest = avatarRequestCache.get(conversationId)
  if (pendingRequest) return pendingRequest

  const request = getConversationProfile(conversationId)
    .then((profile) => {
      const avatarUrl = profile.avatarUrl ?? null
      if (avatarUrl) {
        avatarCache.set(conversationId, {
          value: avatarUrl,
          expiresAt: Date.now() + AVATAR_CACHE_TTL_MS,
        })
      } else {
        avatarCache.delete(conversationId)
      }
      return avatarUrl
    })
    .catch(() => {
      avatarCache.delete(conversationId)
      return null
    })
    .finally(() => {
      avatarRequestCache.delete(conversationId)
    })

  avatarRequestCache.set(conversationId, request)
  return request
}

export function useConversationAvatar(
  conversationId?: string | null,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getCachedAvatar(conversationId))

  useEffect(() => {
    let isMounted = true

    async function loadAvatar() {
      if (!conversationId || !enabled) {
        if (isMounted) setAvatarUrl(null)
        return
      }

      const cachedValue = getCachedAvatar(conversationId)
      if (cachedValue !== null) {
        if (isMounted) setAvatarUrl(cachedValue)
        return
      }

      const nextAvatarUrl = await loadAvatarForConversation(conversationId)
      if (isMounted) setAvatarUrl(nextAvatarUrl)
    }

    loadAvatar()

    return () => {
      isMounted = false
    }
  }, [conversationId, enabled])

  return avatarUrl
}
