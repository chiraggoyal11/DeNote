import { useEffect, useState } from 'react'
import { authAPI } from '../api'
import AppNav from './AppNav'
import GoogleSignIn from './GoogleSignIn'

function formatDate(value) {
  if (!value) return null
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  } catch {
    return String(value)
  }
}

function cacheUserLocal(user) {
  if (!user) return
  if (user.username) localStorage.setItem('username', user.username)
  if (user.displayName) localStorage.setItem('displayName', user.displayName)
  else localStorage.removeItem('displayName')
  if (user.picture) localStorage.setItem('userPicture', user.picture)
  else localStorage.removeItem('userPicture')
}

function Profile({ onLogout }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmUsername, setConfirmUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const loadProfile = async () => {
    setError('')
    try {
      const response = await authAPI.getProfile()
      const next = response.data?.user
      if (next) {
        setUser(next)
        cacheUserLocal(next)
      } else {
        setError('Could not load profile details.')
      }
    } catch (err) {
      if (err.response?.data?.accountDeleted) {
        localStorage.removeItem('token')
        localStorage.removeItem('username')
        localStorage.removeItem('displayName')
        localStorage.removeItem('userPicture')
        if (onLogout) onLogout()
        window.location.href = '/login'
        return
      }
      setError(err.response?.data?.msg || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const handleScheduleDelete = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const response = await authAPI.scheduleDeletion({
        confirmUsername,
        password: password || undefined
      })
      setUser(response.data.user)
      cacheUserLocal(response.data.user)
      setSuccess(response.data.msg || 'Account scheduled for deletion.')
      setPassword('')
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not schedule deletion')
    } finally {
      setBusy(false)
    }
  }

  const handleGoogleDelete = async (credential) => {
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const response = await authAPI.scheduleDeletion({
        confirmUsername,
        credential
      })
      setUser(response.data.user)
      cacheUserLocal(response.data.user)
      setSuccess(response.data.msg || 'Account scheduled for deletion.')
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not schedule deletion')
    } finally {
      setBusy(false)
    }
  }

  const handleCancelDeletion = async () => {
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const response = await authAPI.cancelDeletion()
      setUser(response.data.user)
      cacheUserLocal(response.data.user)
      setSuccess(response.data.msg || 'Deletion cancelled.')
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not cancel deletion')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <AppNav onLogout={onLogout} />
        <div className="loading">Loading profile…</div>
      </div>
    )
  }

  const needsPassword = Boolean(user?.hasPassword)
  const isGoogle = user?.authProvider === 'google'
  const canUseGoogle = isGoogle || Boolean(user?.email)
  const showName = user?.displayName || user?.username || '—'

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="page-head">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-sub">Your account details and deletion settings.</p>
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <section className="section panel profile-panel">
        <h2>Profile details</h2>
        <div className="profile-identity">
          {user?.picture ? (
            <img
              className="profile-photo"
              src={user.picture}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="profile-photo profile-photo-fallback" aria-hidden="true">
              {String(showName).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="profile-identity-name">{showName}</p>
            <p className="profile-identity-meta">@{user?.username || 'user'}</p>
          </div>
        </div>
        <dl className="profile-details">
          <div>
            <dt>Name</dt>
            <dd>{user?.displayName || 'Not set'}</dd>
          </div>
          <div>
            <dt>Username</dt>
            <dd>{user?.username || '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email || 'Not set'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{user?.phone || 'Not set'}</dd>
          </div>
          <div>
            <dt>Sign-in</dt>
            <dd>{isGoogle ? 'Google' : 'Username & password'}</dd>
          </div>
        </dl>
      </section>

      <section className="section panel profile-panel" id="delete-account">
        <h2>Delete account</h2>
        {user?.deletionScheduledAt ? (
          <>
            <p className="page-sub" style={{ marginBottom: '1rem' }}>
              Deletion is scheduled for <strong>{formatDate(user.deletionScheduledAt)}</strong>.
              Your account and uploaded notes will be removed after that date unless you cancel.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-inline"
              onClick={handleCancelDeletion}
              disabled={busy}
            >
              Cancel deletion
            </button>
          </>
        ) : (
          <>
            <p className="page-sub" style={{ marginBottom: '1rem' }}>
              Confirm with your credentials. The account stays active for 30 days, then is permanently deleted.
            </p>
            <form className="delete-form" onSubmit={handleScheduleDelete}>
              <label>
                Confirm username
                <input
                  type="text"
                  value={confirmUsername}
                  onChange={(e) => setConfirmUsername(e.target.value)}
                  placeholder={user?.username || 'username'}
                  required
                  autoComplete="username"
                />
              </label>
              {needsPassword && (
                <label>
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    required={!isGoogle}
                    autoComplete="current-password"
                  />
                </label>
              )}
              {needsPassword && (
                <button type="submit" className="btn btn-danger btn-inline" disabled={busy}>
                  {busy ? 'Scheduling…' : 'Schedule deletion'}
                </button>
              )}
            </form>
            {!needsPassword && canUseGoogle && (
              <div style={{ marginTop: '1rem' }}>
                <p className="auth-hint">Confirm with Google to schedule deletion.</p>
                <GoogleSignIn
                  onCredential={handleGoogleDelete}
                  disabled={busy || !confirmUsername || confirmUsername !== user?.username}
                />
                {(!confirmUsername || confirmUsername !== user?.username) && (
                  <p className="auth-hint">Enter your exact username above before confirming with Google.</p>
                )}
              </div>
            )}
            {needsPassword && isGoogle && (
              <div style={{ marginTop: '1.25rem' }}>
                <div className="auth-divider">or</div>
                <p className="auth-hint">Confirm with Google instead of password.</p>
                <GoogleSignIn
                  onCredential={handleGoogleDelete}
                  disabled={busy || !confirmUsername || confirmUsername !== user?.username}
                />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default Profile
