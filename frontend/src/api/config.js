/**
 * CrackVision Centralized API Configuration & Client
 * Supports VITE_API_BASE_URL for production environments (e.g. Vercel -> Render)
 * and defaults to relative paths for local development (Vite proxy).
 */

const RAW_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')

export const API_BASE_URL = RAW_BASE_URL

/**
 * Resolves a full or relative API endpoint URL based on environment.
 * If endpoint is already absolute (starts with http/https), it returns untouched.
 * If VITE_API_BASE_URL is configured, prepends the base URL cleanly.
 * If VITE_API_BASE_URL is empty, returns relative path (handled by Vite proxy in dev).
 */
export function apiUrl(endpoint = '') {
  if (!endpoint) return API_BASE_URL || ''
  if (/^https?:\/\//i.test(endpoint)) return endpoint

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

  if (!API_BASE_URL) {
    return cleanEndpoint
  }

  // Handle case where base URL ends with /api and endpoint also starts with /api/
  if (API_BASE_URL.endsWith('/api') && cleanEndpoint.startsWith('/api/')) {
    return `${API_BASE_URL}${cleanEndpoint.slice(4)}`
  }

  return `${API_BASE_URL}${cleanEndpoint}`
}

/**
 * Robust fetch wrapper with configurable request timeout.
 * - Defaults to 60,000ms (60s) to comfortably accommodate Render free-tier cold starts.
 * - Injects JWT Bearer token from sessionStorage / localStorage if available.
 * - Sets application/json Content-Type by default for stringified payloads.
 */
export async function apiFetch(endpoint, options = {}, timeoutMs = 60000) {
  const url = apiUrl(endpoint)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headers = new Headers(options.headers || {})

  // Attach authentication header if token exists and not already provided
  if (!headers.has('Authorization')) {
    const token =
      sessionStorage.getItem('crackvision_token') ||
      localStorage.getItem('crackvision_token')
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  // Set default JSON Content-Type when sending body strings
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Performs a lightweight health check probe against the backend.
 * Returns { ok: boolean, status?: string, database?: string, error?: string }
 */
export async function checkServerHealth(timeoutMs = 15000) {
  try {
    const res = await apiFetch('/api/health', { method: 'GET' }, timeoutMs)
    if (!res.ok) {
      return { ok: false, error: `Health check returned HTTP ${res.status}` }
    }
    const data = await res.json()
    return { ok: true, ...data }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Health probe timed out (server may be waking up)' }
    }
    return { ok: false, error: err.message || 'Unable to connect to health endpoint' }
  }
}
