import { useOnlineStatus } from '../hooks/useOnlineStatus'

/**
 * @param {object} props
 * @param {boolean} [props.fromCache]
 * @param {'all'|'offline'|'stale'} [props.scope] - App uses offline; pages use stale to avoid duplicate banners
 */
function OfflineBanner({ fromCache = false, scope = 'all' }) {
  const online = useOnlineStatus()

  const showOffline = !online && (scope === 'all' || scope === 'offline')
  const showStale = online && fromCache && (scope === 'all' || scope === 'stale')

  if (!showOffline && !showStale) return null

  return (
    <div
      className={`offline-banner ${showOffline ? 'is-offline' : 'is-stale'}`}
      role="status"
      aria-live="polite"
    >
      {showOffline
        ? 'You are offline. Showing the app shell and any cached notes on this device.'
        : 'Showing cached data while the network catches up.'}
    </div>
  )
}

export default OfflineBanner
