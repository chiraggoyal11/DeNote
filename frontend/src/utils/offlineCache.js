import { idbGet, idbSet } from './idb'

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 12 // 12h soft TTL

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}

function stableKey(parts) {
  return parts
    .map((p) => {
      if (p == null) return ''
      if (typeof p === 'string') return p
      try {
        return JSON.stringify(p)
      } catch {
        return String(p)
      }
    })
    .join('::')
}

/**
 * Run a network fetcher; on success persist to IndexedDB.
 * On failure, return cached payload when offline (or within TTL).
 * Returns an axios-like `{ data, fromCache, cachedAt }`.
 */
export async function withOfflineCache(keyParts, fetcher, { ttlMs = DEFAULT_TTL_MS } = {}) {
  const key = stableKey(Array.isArray(keyParts) ? keyParts : [keyParts])
  try {
    const response = await fetcher()
    const data = response?.data !== undefined ? response.data : response
    await idbSet(key, { data, savedAt: Date.now() })
    return { data, fromCache: false, cachedAt: null }
  } catch (err) {
    const cached = await idbGet(key)
    const age = cached?.savedAt ? Date.now() - cached.savedAt : Infinity
    const allowStale = !isOnline() || age <= ttlMs
    if (cached?.data != null && allowStale) {
      return {
        data: cached.data,
        fromCache: true,
        cachedAt: cached.savedAt,
        offline: !isOnline(),
        error: err
      }
    }
    throw err
  }
}

export function cacheKeyNotesQuery(params = {}) {
  return ['notes', 'query', params]
}

export function cacheKeyFavorites(params = {}) {
  return ['notes', 'favorites', params]
}

export function cacheKeyMine(params = {}) {
  return ['notes', 'mine', params]
}

export function cacheKeyNote(cid) {
  return ['notes', 'one', cid]
}

export function cacheKeyStudyProgress() {
  return ['study', 'progress']
}

export function cacheKeyStudyDecks() {
  return ['study', 'decks']
}

export function cacheKeyAnalytics() {
  return ['analytics', 'me']
}
