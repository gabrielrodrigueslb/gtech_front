'use client'

import { useEffect, useState } from 'react'
import { getConversationProfile } from '@/lib/whatsapp-client'

const avatarCache = new Map<string, string | null>()

export function useConversationAvatar(conversationId?: string | null) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    conversationId ? avatarCache.get(conversationId) ?? null : null
  )

  useEffect(() => {
    let isMounted = true

    async function loadAvatar() {
      if (!conversationId) {
        if (isMounted) setAvatarUrl(null)
        return
      }

      if (avatarCache.has(conversationId)) {
        if (isMounted) setAvatarUrl(avatarCache.get(conversationId) ?? null)
        return
      }

      try {
        const profile = await getConversationProfile(conversationId)
        if (profile.avatarUrl) {
          avatarCache.set(conversationId, profile.avatarUrl)
        }
        if (isMounted) setAvatarUrl(profile.avatarUrl ?? null)
      } catch (error) {
        if (isMounted) setAvatarUrl(null)
      }
    }

    loadAvatar()

    return () => {
      isMounted = false
    }
  }, [conversationId])

  return avatarUrl
}
