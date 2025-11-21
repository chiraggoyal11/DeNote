import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api'

function Dashboard({ onLogout }) {
  const [user, setUser] = useState({ username: 'User' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      const response = await authAPI.getProfile()
      console.log('Profile response:', response.data)
      if (response.data.user) {
        setUser(response.data.user)
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
      // Don't redirect on error, just use default user
      console.log('Using default user data')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  if (loading) {
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
        <div>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/upload">Upload Note</Link>
          <Link to="/notes">Browse Notes</Link>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ marginLeft: '1rem' }}>
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
              <button className="btn">📤 Upload New Note</button>
            </Link>
            <Link to="/notes" style={{ textDecoration: 'none' }}>
              <button className="btn">📖 Browse Notes</button>
            </Link>
          </div>
        </div>

        <div style={{ marginTop: '3rem', padding: '1.5rem', background: '#1a1a1a', borderRadius: '12px' }}>
          <h3>About DeNote</h3>
          <p style={{ marginTop: '1rem', lineHeight: '1.6' }}>
            DeNote is a decentralized notes sharing platform built on IPFS. Upload, share, and discover 
            high-quality educational notes rated by the community. All notes are stored permanently on 
            IPFS, ensuring censorship resistance and global accessibility.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
