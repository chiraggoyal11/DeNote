import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../api'

function Dashboard({ onLogout }) {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('username')
    return { username: cached || 'User' }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      const response = await authAPI.getProfile()
      if (response.data?.user) {
        setUser(response.data.user)
        if (response.data.user.username) {
          localStorage.setItem('username', response.data.user.username)
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
      // Keep cached username from register/login if profile call fails
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    if (onLogout) onLogout()
    window.location.href = '/login'
  }

  if (loading && !user?.username) {
    return (
      <div className="container">
        <div style={{ marginTop: '3rem' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="container">
      <nav className="navbar">
        <h1>📚 DeNote</h1>
        <div className="navbar-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/upload">Upload Note</Link>
          <Link to="/notes">Browse Notes</Link>
          <button type="button" onClick={handleLogout} className="btn btn-secondary" style={{ marginLeft: '1rem' }}>
            Logout
          </button>
        </div>
      </nav>

      <div style={{ textAlign: 'left', marginTop: '2rem' }}>
        <h2>Welcome, {user?.username || 'User'}! 👋</h2>
        <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.6)' }}>
          Username: {user?.username}
        </p>

        <div style={{ marginTop: '3rem' }}>
          <h3>Quick Actions</h3>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <Link to="/upload" style={{ textDecoration: 'none' }}>
              <button type="button" className="btn">📤 Upload New Note</button>
            </Link>
            <Link to="/notes" style={{ textDecoration: 'none' }}>
              <button type="button" className="btn">📖 Browse Notes</button>
            </Link>
          </div>
        </div>

        <div className="about-denote-card">
          <h3 className="about-denote-title">About DeNote</h3>
          <p className="about-denote-desc">
            <strong>DeNote</strong> is a decentralized notes sharing platform built on <span style={{color:'#7c82ff'}}>IPFS</span>.<br/>
            Upload, share, and discover high-quality educational notes rated by the community.<br/>
            All notes are stored permanently on IPFS, ensuring <span style={{color:'#ffd43b'}}>censorship resistance</span> and <span style={{color:'#51cf66'}}>global accessibility</span>.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
