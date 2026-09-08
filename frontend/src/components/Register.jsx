import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api'
import GoogleSignIn from './GoogleSignIn'
import {
  collegeEmailHint,
  collegeEmailRequiredMsg,
  formatAllowedEmailDomains,
  isAllowedCollegeEmail
} from '../utils/collegeEmail'

function Register({ onLogin }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const domainLabel = formatAllowedEmailDomains()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const finishAuth = (token, user) => {
    if (user?.username) localStorage.setItem('username', user.username)
    if (user?.displayName) localStorage.setItem('displayName', user.displayName)
    else localStorage.removeItem('displayName')
    if (user?.picture) localStorage.setItem('userPicture', user.picture)
    else localStorage.removeItem('userPicture')
    onLogin(token)
    navigate('/dashboard', { replace: true })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.email.trim()) {
      setError(collegeEmailRequiredMsg())
      return
    }
    if (!isAllowedCollegeEmail(formData.email)) {
      setError(collegeEmailRequiredMsg())
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { confirmPassword, ...registerData } = formData
      const response = await authAPI.register(registerData)
      const { success, token, user, msg } = response.data
      if (!success || !token) {
        setError(msg || 'Registration failed. Please try again.')
        return
      }
      finishAuth(token, user)
    } catch (err) {
      setError(err.response?.data?.msg || 'Registration failed. Please try again.')
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
        <p className="auth-lead">Create an account to share and find course notes on decentralized storage.</p>
        <p className="auth-hint">{collegeEmailHint()}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input id="username" type="text" name="username" value={formData.username} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="email">College email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@bmsce.ac.in"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Phone (optional)</label>
            <input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+9198XXXXXXXX" />
          </div>
          <p className="auth-hint">College email ({domainLabel}) is required. Phone is optional for recovery.</p>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" name="password" value={formData.password} onChange={handleChange} required minLength={6} />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required minLength={6} />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '0.35rem' }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <p className="auth-hint">Google must use the same {domainLabel} account.</p>
        <GoogleSignIn onCredential={handleGoogle} disabled={loading} />

        <p className="auth-footer">
          Already have an account? <Link to="/login" className="link">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
