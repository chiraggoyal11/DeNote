import { useState, useEffect } from 'react'
import { authAPI } from '../api'
import AppNav from './AppNav'

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
        if (response.data.user.displayName) {
          localStorage.setItem('displayName', response.data.user.displayName)
        }
        if (response.data.user.picture) {
          localStorage.setItem('userPicture', response.data.user.picture)
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !user?.username) {
    return (
      <div className="container">
        <div className="loading">Loading…</div>
      </div>
    )
  }

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="page-head">
        <div>
          <h1 className="page-title">Welcome, {user?.displayName || user?.username || 'User'}</h1>
          <p className="page-sub">
            Upload notes to IPFS or browse what the community has shared.
          </p>
        </div>
      </section>

      <section className="section panel">
        <h2>About DeNote</h2>
        <p className="about-copy">
          DeNote is a notes-sharing platform built on <em>IPFS</em>.
          Files stay available through decentralized storage, so coursework
          remains easy to find and hard to take offline.
        </p>
      </section>
    </div>
  )
}

export default Dashboard
