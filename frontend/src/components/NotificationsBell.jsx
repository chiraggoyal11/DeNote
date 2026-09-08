import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { communityAPI } from '../api'

const POLL_MS = 45000

function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const menuRef = useRef(null)

  const refreshCount = async () => {
    try {
      const res = await communityAPI.unreadCount()
      setUnread(res.data.unreadCount || 0)
    } catch {
      // ignore polling errors
    }
  }

  const loadList = async () => {
    try {
      const res = await communityAPI.notifications({ limit: 20 })
      setItems(res.data.notifications || [])
      setUnread(res.data.unreadCount || 0)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshCount()
    const id = setInterval(refreshCount, POLL_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next) await loadList()
  }

  const markAll = async () => {
    await communityAPI.markAllRead()
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div className="notif-menu" ref={menuRef}>
      <button
        type="button"
        className="notif-trigger"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={toggle}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-dropdown" role="menu">
          <div className="notif-dropdown-head">
            <strong>Notifications</strong>
            <button type="button" className="link-btn" onClick={markAll}>Mark all read</button>
          </div>
          {items.length === 0 ? (
            <p className="page-sub" style={{ padding: '0.75rem 1rem' }}>You are all caught up.</p>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n._id} className={n.read ? '' : 'is-unread'}>
                  {n.noteCid ? (
                    <Link to={`/note/${n.noteCid}`} onClick={() => setOpen(false)}>{n.message}</Link>
                  ) : n.actorUsername ? (
                    <Link to={`/u/${n.actorUsername}`} onClick={() => setOpen(false)}>{n.message}</Link>
                  ) : (
                    <span>{n.message}</span>
                  )}
                  <span className="page-sub">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationsBell
