import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api'
import GoogleSignIn from './GoogleSignIn'

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

    if (!formData.email.trim() && !formData.phone.trim()) {
      setError('Provide an email or phone number (needed for verification and password reset).')
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
    <div className="auth-container">
      <h2>📚 Register for DeNote</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Username</label>
          <input type="text" name="username" value={formData.username} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" />
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="+9198XXXXXXXX" />
        </div>
        <p className="auth-hint">Provide at least one of email or phone for OTP password reset.</p>
        <div className="form-group">
          <label>Password</label>
          <input type="password" name="password" value={formData.password} onChange={handleChange} required minLength={6} />
        </div>
        <div className="form-group">
          <label>Confirm Password</label>
          <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required minLength={6} />
        </div>
        {error && <div className="error">{error}</div>}
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>

      <div className="auth-divider"><span>or</span></div>
      <GoogleSignIn onCredential={handleGoogle} disabled={loading} />

      <p style={{ marginTop: '1rem' }}>
        Already have an account? <Link to="/login" className="link">Login here</Link>
      </p>
    </div>
  )
}

export default Register
