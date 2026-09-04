import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api'
import GoogleSignIn from './GoogleSignIn'

function Login({ onLogin }) {
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const finishAuth = (token, user) => {
    if (user?.username) localStorage.setItem('username', user.username)
    onLogin(token)
    navigate('/dashboard', { replace: true })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await authAPI.login(formData)
      const { success, token, user, msg } = response.data
      if (success && token) finishAuth(token, user)
      else setError(msg || 'No token received from server')
    } catch (err) {
      setError(err.response?.data?.msg || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async (credential) => {
    setError('')
    setLoading(true)
    try {
      const response = await authAPI.googleAuth(credential)
      const { success, token, user, msg } = response.data
      if (!success || !token) {
        setError(msg || 'Google sign-in failed.')
        return
      }
      finishAuth(token, user)
    } catch (err) {
      setError(err.response?.data?.msg || 'Google sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <p className="auth-brand">DeNote</p>
        <p className="auth-lead">Sign in to upload and discover academic notes on IPFS.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" name="username" value={formData.username} onChange={handleChange} required autoComplete="username" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" name="password" value={formData.password} onChange={handleChange} required autoComplete="current-password" />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer" style={{ marginTop: '0.85rem' }}>
          <Link to="/forgot-password" className="link">Forgot password?</Link>
        </p>

        <div className="auth-divider"><span>or</span></div>
        <GoogleSignIn onCredential={handleGoogle} disabled={loading} />

        <p className="auth-footer">
          New here? <Link to="/register" className="link">Create an account</Link>
        </p>
      </div>
    </div>
  )
}

export default Login
