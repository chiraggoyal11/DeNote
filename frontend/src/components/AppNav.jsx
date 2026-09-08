import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

function initialsFrom(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function AppNav({ onLogout }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const username = localStorage.getItem('username') || 'User'
  const displayName = localStorage.getItem('displayName') || username
  const picture = localStorage.getItem('userPicture') || ''

  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('displayName')
    localStorage.removeItem('userPicture')
    if (onLogout) onLogout()
    window.location.href = '/login'
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link to="/dashboard" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">DeNote</span>
        </Link>
        <nav className="topbar-nav" aria-label="Main">
          <NavLink to="/dashboard">Home</NavLink>
          <NavLink to="/notes">Browse</NavLink>
          <NavLink to="/collections">Collections</NavLink>
          <NavLink to="/my-uploads">My uploads</NavLink>
          <NavLink to="/favorites">Favorites</NavLink>
          <NavLink to="/upload" className="nav-cta">Upload</NavLink>
        </nav>
      </div>

      <div className="topbar-right">
        <div className="profile-menu" ref={menuRef}>
          <button
            type="button"
            className="profile-trigger"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Account menu"
            onClick={() => setOpen((v) => !v)}
          >
            {picture ? (
              <img className="profile-avatar-img" src={picture} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="profile-avatar" aria-hidden="true">
                {initialsFrom(displayName)}
              </span>
            )}
          </button>
          {open && (
            <div className="profile-dropdown" role="menu">
              <div className="profile-dropdown-head">
                <span className="profile-dropdown-name">{displayName}</span>
                <span className="profile-dropdown-hint">@{username}</span>
              </div>
              <Link
                to="/my-uploads"
                role="menuitem"
                className="profile-dropdown-item"
                onClick={() => setOpen(false)}
              >
                My uploads
              </Link>
              <Link
                to="/favorites"
                role="menuitem"
                className="profile-dropdown-item"
                onClick={() => setOpen(false)}
              >
                Favorites
              </Link>
              <Link
                to="/profile"
                role="menuitem"
                className="profile-dropdown-item"
                onClick={() => setOpen(false)}
              >
                Profile details
              </Link>
              <button
                type="button"
                role="menuitem"
                className="profile-dropdown-item"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default AppNav
