import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../api'
import { collegeEmailHint, formatAllowedEmailDomains } from '../utils/collegeEmail'

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
  const domainLabel = formatAllowedEmailDomains()

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
    <div className="auth-shell">
      <div className="auth-panel">
        <p className="auth-brand">DeNote</p>
        <p className="auth-lead">
          Reset with your college email ({domainLabel}) or registered phone. Temporary OTP: <strong>123456</strong>
        </p>
        <p className="auth-hint">{collegeEmailHint()}</p>

        {step === 1 ? (
          <form onSubmit={handleSendOtp}>
            <div className="form-group">
              <label htmlFor="channel">Reset via</label>
              <select id="channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="email">College email</option>
                <option value="phone">Phone</option>
              </select>
            </div>
            {channel === 'email' ? (
              <div className="form-group">
                <label htmlFor="email">College email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@bmsce.ac.in"
                />
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+9198XXXXXXXX" />
              </div>
            )}
            {error && <div className="error">{error}</div>}
            {message && <div className="success">{message}</div>}
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <div className="form-group">
              <label htmlFor="otp">OTP</label>
              <input id="otp" type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required maxLength={6} />
            </div>
            <div className="form-group">
              <label htmlFor="newPassword">New password</label>
              <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            {error && <div className="error">{error}</div>}
            {message && <div className="success">{message}</div>}
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
            <button type="button" className="btn btn-secondary" style={{ marginTop: '0.65rem' }} onClick={() => setStep(1)}>
              Back
            </button>
          </form>
        )}

        <p className="auth-footer">
          <Link to="/login" className="link">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default ForgotPassword
