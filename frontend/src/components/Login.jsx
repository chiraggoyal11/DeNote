import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api'

function Login({ onLogin }) {
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      console.log('Logging in with:', formData)
      const response = await authAPI.login(formData)
      console.log('Login response:', response.data)
      const { token } = response.data
      if (token) {
        console.log('Token received, saving to localStorage')
        localStorage.setItem('token', token)
        console.log('Token saved, redirecting...')
        // Force a full page redirect
        window.location.href = '/dashboard'
      } else {
        setError('No token received from server')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError(err.response?.data?.msg || err.response?.data?.message || 'Login failed. Please try again.')
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
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        Don't have an account? <Link to="/register" className="link">Register here</Link>
      </p>
    </div>
  )
}

export default Login
