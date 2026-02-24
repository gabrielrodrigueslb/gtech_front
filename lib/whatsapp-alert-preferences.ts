"use client"

export const WHATSAPP_ALERT_PREFS_EVENT = "whatsapp-alert-preferences:updated"

export type WhatsAppAlertPreferences = {
  inAppToastEnabled: boolean
  browserNotificationEnabled: boolean
  soundEnabled: boolean
}

const STORAGE_KEY = "lintra:whatsapp-alert-preferences"

export const DEFAULT_WHATSAPP_ALERT_PREFERENCES: WhatsAppAlertPreferences = {
  inAppToastEnabled: true,
  browserNotificationEnabled: true,
  soundEnabled: true,
}

export function readWhatsAppAlertPreferences(): WhatsAppAlertPreferences {
  if (typeof window === "undefined") return DEFAULT_WHATSAPP_ALERT_PREFERENCES

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_WHATSAPP_ALERT_PREFERENCES
    const parsed = JSON.parse(raw)

    return {
      inAppToastEnabled:
        typeof parsed?.inAppToastEnabled === "boolean"
          ? parsed.inAppToastEnabled
          : DEFAULT_WHATSAPP_ALERT_PREFERENCES.inAppToastEnabled,
      browserNotificationEnabled:
        typeof parsed?.browserNotificationEnabled === "boolean"
          ? parsed.browserNotificationEnabled
          : DEFAULT_WHATSAPP_ALERT_PREFERENCES.browserNotificationEnabled,
      soundEnabled:
        typeof parsed?.soundEnabled === "boolean"
          ? parsed.soundEnabled
          : DEFAULT_WHATSAPP_ALERT_PREFERENCES.soundEnabled,
    }
  } catch {
    return DEFAULT_WHATSAPP_ALERT_PREFERENCES
  }
}

export function writeWhatsAppAlertPreferences(
  next: Partial<WhatsAppAlertPreferences>,
): WhatsAppAlertPreferences {
  const merged = {
    ...readWhatsAppAlertPreferences(),
    ...next,
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    window.dispatchEvent(new CustomEvent(WHATSAPP_ALERT_PREFS_EVENT, { detail: merged }))
  }

  return merged
}
