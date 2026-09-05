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

function formFromUser(user) {
  return {
    username: user?.username || '',
    displayName: user?.displayName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    college: user?.college || '',
    branch: user?.branch || '',
    semester: user?.semester || ''
  }
}

function userFromResponse(response) {
  return response?.data?.user ?? response?.user ?? null
}

function messageFromResponse(response, fallback) {
  return response?.data?.msg ?? response?.msg ?? fallback
}

function Profile({ onLogout }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(formFromUser(null))
  const [confirmUsername, setConfirmUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const loadProfile = async () => {
    setError('')
    try {
      const response = await authAPI.getProfile()
      const next = userFromResponse(response)
      if (next) {
        setUser(next)
        setForm(formFromUser(next))
        cacheUserLocal(next)
      } else {
        setError('Could not load profile details. Check that the API URL is configured.')
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

  const startEditing = () => {
    setForm(formFromUser(user))
    setEditing(true)
    setError('')
    setSuccess('')
  }

  const cancelEditing = () => {
    setForm(formFromUser(user))
    setEditing(false)
    setError('')
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const response = await authAPI.updateProfile({
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        college: form.college.trim(),
        branch: form.branch.trim(),
        semester: form.semester.trim()
      })
      const updated = userFromResponse(response)
      if (!updated) {
        setError('Profile saved but the server returned an unexpected response.')
        return
      }
      setUser(updated)
      setForm(formFromUser(updated))
      cacheUserLocal(updated)
      setEditing(false)
      setSuccess(messageFromResponse(response, 'Profile updated.'))
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not update profile')
    } finally {
      setBusy(false)
    }
  }

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
      const updated = userFromResponse(response)
      if (updated) {
        setUser(updated)
        cacheUserLocal(updated)
      }
      setSuccess(messageFromResponse(response, 'Account scheduled for deletion.'))
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
      const updated = userFromResponse(response)
      if (updated) {
        setUser(updated)
        cacheUserLocal(updated)
      }
      setSuccess(messageFromResponse(response, 'Account scheduled for deletion.'))
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
      const updated = userFromResponse(response)
      if (updated) {
        setUser(updated)
        cacheUserLocal(updated)
      }
      setSuccess(messageFromResponse(response, 'Deletion cancelled.'))
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
        <div className="profile-panel-head">
          <h2>Profile details</h2>
          {!editing && (
            <button
              type="button"
              className="profile-edit-btn"
              onClick={startEditing}
              aria-label="Edit profile"
              title="Edit profile"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                />
              </svg>
              Edit
            </button>
          )}
        </div>

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

        {editing ? (
          <form className="profile-edit-form" onSubmit={handleSaveProfile}>
            <div className="profile-edit-grid">
              <label>
                Display name
                <input
                  type="text"
                  name="displayName"
                  value={form.displayName}
                  onChange={handleFormChange}
                  placeholder="Your name"
                  maxLength={60}
                  autoComplete="name"
                />
              </label>
              <label>
                Username
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleFormChange}
                  placeholder="username"
                  minLength={3}
                  maxLength={24}
                  pattern="[A-Za-z0-9_]{3,24}"
                  title="3–24 characters: letters, numbers, or underscore"
                  required
                  autoComplete="username"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleFormChange}
                  placeholder="you@college.edu"
                  autoComplete="email"
                />
              </label>
              <label>
                Phone
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleFormChange}
                  placeholder="+9198xxxxxxxx"
                  autoComplete="tel"
                />
              </label>
              <label>
                College
                <input
                  type="text"
                  name="college"
                  value={form.college}
                  onChange={handleFormChange}
                  placeholder="College / university"
                  maxLength={100}
                />
              </label>
              <label>
                Branch
                <input
                  type="text"
                  name="branch"
                  value={form.branch}
                  onChange={handleFormChange}
                  placeholder="e.g. Computer Science"
                  maxLength={80}
                />
              </label>
              <label>
                Semester
                <input
                  type="text"
                  name="semester"
                  value={form.semester}
                  onChange={handleFormChange}
                  placeholder="e.g. 5"
                  maxLength={40}
                />
              </label>
              <label className="profile-edit-span">
                Bio
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={handleFormChange}
                  placeholder="Short intro about your courses or interests"
                  rows={3}
                  maxLength={280}
                />
              </label>
            </div>
            <p className="auth-hint">
              Username must be unique (letters, numbers, underscore). Keep email/phone current for recovery.
            </p>
            <div className="profile-edit-actions">
              <button type="submit" className="btn btn-inline" disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-inline"
                onClick={cancelEditing}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
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
              <dt>College</dt>
              <dd>{user?.college || 'Not set'}</dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>{user?.branch || 'Not set'}</dd>
            </div>
            <div>
              <dt>Semester</dt>
              <dd>{user?.semester || 'Not set'}</dd>
            </div>
            <div>
              <dt>Bio</dt>
              <dd>{user?.bio || 'Not set'}</dd>
            </div>
            <div>
              <dt>Sign-in</dt>
              <dd>{isGoogle ? 'Google' : 'Username & password'}</dd>
            </div>
          </dl>
        )}
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
