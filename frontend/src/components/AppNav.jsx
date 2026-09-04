import { Link, NavLink } from 'react-router-dom'

function AppNav({ onLogout }) {
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    if (onLogout) onLogout()
    window.location.href = '/login'
  }

  return (
    <header className="topbar">
      <Link to="/dashboard" className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">DeNote</span>
      </Link>
      <nav className="topbar-nav" aria-label="Main">
        <NavLink to="/dashboard">Home</NavLink>
        <NavLink to="/notes">Browse</NavLink>
        <NavLink to="/upload" className="nav-cta">Upload</NavLink>
        <button type="button" className="btn btn-ghost" onClick={handleLogout}>
          Log out
        </button>
      </nav>
    </header>
  )
}

export default AppNav
