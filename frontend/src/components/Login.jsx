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
      if (success && token) {
        finishAuth(token, user)
      } else {
        setError(msg || 'No token received from server')
      }
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
    <div className="auth-container">
      <h2>📚 Login to DeNote</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Username</label>
          <input type="text" name="username" value={formData.username} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" name="password" value={formData.password} onChange={handleChange} required />
        </div>
        {error && <div className="error">{error}</div>}
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p style={{ marginTop: '0.75rem' }}>
        <Link to="/forgot-password" className="link">Forgot password?</Link>
      </p>

      <div className="auth-divider"><span>or</span></div>
      <GoogleSignIn onCredential={handleGoogle} disabled={loading} />

      <p style={{ marginTop: '1rem' }}>
        Don't have an account? <Link to="/register" className="link">Register here</Link>
      </p>
    </div>
  )
}

export default Login
