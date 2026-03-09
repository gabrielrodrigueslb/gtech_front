function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function normalizeBaseUrl(value?: string | null) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return ''
  return trimTrailingSlash(normalized)
}

function isLoopbackUrl(value?: string | null) {
  const normalized = normalizeBaseUrl(value)
  if (!normalized) return false

  try {
    const hostname = new URL(normalized).hostname.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
  } catch (_) {
    return false
  }
}

export function resolveSocketUrl() {
  const explicitSocketUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SOCKET_URL)
  const apiBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL).replace(/\/api\/?$/, '')
  const browserOrigin =
    typeof window !== 'undefined' ? normalizeBaseUrl(window.location.origin) : ''

  if (browserOrigin && explicitSocketUrl && isLoopbackUrl(explicitSocketUrl) && !isLoopbackUrl(browserOrigin)) {
    return apiBaseUrl || browserOrigin
  }

  return explicitSocketUrl || apiBaseUrl || browserOrigin
}

export function resolveSocketPath() {
  const configuredPath = String(process.env.NEXT_PUBLIC_SOCKET_PATH ?? '').trim()
  if (configuredPath) {
    return configuredPath.startsWith('/') ? configuredPath : `/${configuredPath}`
  }

  return '/api/socket.io'
}

export const DEFAULT_SOCKET_TRANSPORTS = ['polling', 'websocket'] as const
