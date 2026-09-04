import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api'

function ForgotPassword() {
  const [step, setStep] = useState(1)
  const [channel, setChannel] = useState('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const payload = channel === 'email' ? { email } : { phone }
      const response = await authAPI.forgotPassword(payload)
      if (!response.data?.success) {
        setError(response.data?.msg || 'No account found with this email or phone.')
        return
      }
      setMessage(response.data?.msg || 'OTP sent to your registered contact.')
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to send OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const payload = {
        otp,
        newPassword,
        ...(channel === 'email' ? { email } : { phone })
      }
      const response = await authAPI.resetPassword(payload)
      setMessage(response.data?.msg || 'Password updated.')
      setTimeout(() => navigate('/login', { replace: true }), 1200)
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <h2>🔑 Reset password</h2>
      <p className="auth-hint">
        Temporary: use OTP <strong>123456</strong> after requesting a reset (SendGrid/Twilio can be added later).
      </p>

      {step === 1 ? (
        <form onSubmit={handleSendOtp}>
          <div className="form-group">
            <label>Reset via</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
          </div>
          {channel === 'email' ? (
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          ) : (
            <div className="form-group">
              <label>Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+9198XXXXXXXX" />
            </div>
          )}
          {error && <div className="error">{error}</div>}
          {message && <div className="success">{message}</div>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset}>
          <div className="form-group">
            <label>OTP</label>
            <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required maxLength={6} />
          </div>
          <div className="form-group">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="form-group">
            <label>Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <div className="error">{error}</div>}
          {message && <div className="success">{message}</div>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Updating...' : 'Reset password'}
          </button>
          <button type="button" className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => setStep(1)}>
            Back
          </button>
        </form>
      )}

      <p style={{ marginTop: '1rem' }}>
        <Link to="/login" className="link">Back to login</Link>
      </p>
    </div>
  )
}

export default ForgotPassword
