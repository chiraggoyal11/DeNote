import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import NotificationsBell from './NotificationsBell'

function initialsFrom(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function AppNav({ onLogout }) {
  const [open, setOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const menuRef = useRef(null)
  const username = localStorage.getItem('username') || 'User'
  const displayName = localStorage.getItem('displayName') || username
  const picture = localStorage.getItem('userPicture') || ''
  const role = localStorage.getItem('role') || 'student'
  const isStaff = role === 'moderator' || role === 'admin'

  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setNavOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle('nav-drawer-open', navOpen)
    return () => document.body.classList.remove('nav-drawer-open')
  }, [navOpen])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('displayName')
    localStorage.removeItem('userPicture')
    localStorage.removeItem('role')
    if (onLogout) onLogout()
    window.location.href = '/login'
  }

  const closeNav = () => setNavOpen(false)

  const navLinks = (
    <>
      <NavLink to="/dashboard" onClick={closeNav}>Home</NavLink>
      <NavLink to="/notes" onClick={closeNav}>Browse</NavLink>
      <NavLink to="/activity" onClick={closeNav}>Following</NavLink>
      <NavLink to="/collections" onClick={closeNav}>Collections</NavLink>
      <NavLink to="/my-uploads" onClick={closeNav}>My uploads</NavLink>
      <NavLink to="/analytics" onClick={closeNav}>Analytics</NavLink>
      <NavLink to="/study" onClick={closeNav}>Study</NavLink>
      <NavLink to="/favorites" onClick={closeNav}>Favorites</NavLink>
      {isStaff && <NavLink to="/admin" onClick={closeNav}>Moderation</NavLink>}
      <NavLink to="/upload" className="nav-cta" onClick={closeNav}>Upload</NavLink>
    </>
  )

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="nav-menu-btn"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          aria-controls="primary-nav"
          onClick={() => setNavOpen((v) => !v)}
        >
          <span className="nav-menu-bars" aria-hidden="true" />
        </button>
        <Link to="/dashboard" className="brand" onClick={closeNav}>
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">DeNote</span>
        </Link>
        <nav id="primary-nav" className="topbar-nav topbar-nav-desktop" aria-label="Main">
          {navLinks}
        </nav>
      </div>

      <div className="topbar-right">
        <NotificationsBell />
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
              <Link to={`/u/${username}`} role="menuitem" className="profile-dropdown-item" onClick={() => setOpen(false)}>
                Public profile
              </Link>
              <Link to="/my-uploads" role="menuitem" className="profile-dropdown-item" onClick={() => setOpen(false)}>
                My uploads
              </Link>
              <Link to="/analytics" role="menuitem" className="profile-dropdown-item" onClick={() => setOpen(false)}>
                Analytics
              </Link>
              <Link to="/study" role="menuitem" className="profile-dropdown-item" onClick={() => setOpen(false)}>
                Study
              </Link>
              <Link to="/favorites" role="menuitem" className="profile-dropdown-item" onClick={() => setOpen(false)}>
                Favorites
              </Link>
              <Link to="/profile" role="menuitem" className="profile-dropdown-item" onClick={() => setOpen(false)}>
                Profile details
              </Link>
              <button type="button" role="menuitem" className="profile-dropdown-item" onClick={handleLogout}>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {navOpen && (
        <>
          <button type="button" className="nav-drawer-backdrop" aria-label="Close menu" onClick={closeNav} />
          <nav id="primary-nav-drawer" className="nav-drawer" aria-label="Mobile main">
            <p className="nav-drawer-title">Navigate</p>
            {navLinks}
          </nav>
        </>
      )}
    </header>
  )
}

export default AppNav
