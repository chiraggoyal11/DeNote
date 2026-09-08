import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminAPI } from '../api'
import AppNav from './AppNav'

function AdminDashboard({ onLogout }) {
  const [stats, setStats] = useState(null)
  const [reports, setReports] = useState([])
  const [logs, setLogs] = useState([])
  const [users, setUsers] = useState([])
  const [userQ, setUserQ] = useState('')
  const [tab, setTab] = useState('overview')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const role = localStorage.getItem('role') || 'student'
  const isStaff = role === 'moderator' || role === 'admin'
  const isAdmin = role === 'admin'

  const load = async () => {
    setError('')
    try {
      const [s, r, a] = await Promise.all([
        adminAPI.stats(),
        adminAPI.reports({ status: 'pending' }),
        adminAPI.auditLogs({ limit: 30 })
      ])
      setStats(s.data.stats)
      setReports(r.data.reports || [])
      setLogs(a.data.logs || [])
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load admin data')
    }
  }

  useEffect(() => {
    if (isStaff) load()
  }, [isStaff])

  if (!isStaff) {
    return (
      <div className="container page-enter">
        <AppNav onLogout={onLogout} />
        <div className="error">Staff access required for moderation tools.</div>
        <Link to="/dashboard" className="link" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Back to home
        </Link>
      </div>
    )
  }

  const searchUsers = async (e) => {
    e?.preventDefault?.()
    setBusy(true)
    try {
      const res = await adminAPI.listUsers({ q: userQ })
      setUsers(res.data.users || [])
    } catch (err) {
      setError(err.response?.data?.msg || 'User search failed')
    } finally {
      setBusy(false)
    }
  }

  const resolve = async (id, reject = false) => {
    const note = window.prompt(reject ? 'Rejection note (optional)' : 'Resolution note (optional)') || ''
    setBusy(true)
    try {
      if (reject) await adminAPI.rejectReport(id, note)
      else await adminAPI.resolveReport(id, note)
      await load()
    } catch (err) {
      setError(err.response?.data?.msg || 'Report action failed')
    } finally {
      setBusy(false)
    }
  }

  const verifyRecent = async (noteId, unverify = false) => {
    setBusy(true)
    try {
      if (unverify) await adminAPI.unverifyNote(noteId)
      else await adminAPI.verifyNote(noteId)
      await load()
    } catch (err) {
      setError(err.response?.data?.msg || 'Verify failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />
      <section className="page-head">
        <div>
          <h1 className="page-title">Moderation</h1>
          <p className="page-sub">Reports, verification, audit logs{isAdmin ? ', and user management' : ''}.</p>
        </div>
      </section>

      <div className="admin-tabs">
        {['overview', 'reports', 'audit', ...(isAdmin ? ['users'] : [])].map((t) => (
          <button
            key={t}
            type="button"
            className={`btn btn-inline ${tab === t ? '' : 'btn-secondary'}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {tab === 'overview' && stats && (
        <>
          <div className="admin-stat-grid">
            <div className="admin-stat"><strong>{stats.totalUsers}</strong><span>Users</span></div>
            <div className="admin-stat"><strong>{stats.totalNotes}</strong><span>Notes</span></div>
            <div className="admin-stat"><strong>{stats.verifiedNotes}</strong><span>Verified</span></div>
            <div className="admin-stat"><strong>{stats.pendingReports}</strong><span>Pending reports</span></div>
            <div className="admin-stat"><strong>{stats.totalComments}</strong><span>Comments</span></div>
            <div className="admin-stat"><strong>{stats.restrictedUsers}</strong><span>Restricted</span></div>
          </div>

          {stats.engagement && (
            <div className="admin-stat-grid" style={{ marginTop: '0.75rem' }}>
              <div className="admin-stat"><strong>{stats.engagement.views}</strong><span>Platform views</span></div>
              <div className="admin-stat"><strong>{stats.engagement.downloads}</strong><span>Platform opens</span></div>
              <div className="admin-stat"><strong>{stats.engagement.likes}</strong><span>Platform upvotes</span></div>
              <div className="admin-stat"><strong>{stats.engagement.saves}</strong><span>Platform saves</span></div>
              <div className="admin-stat"><strong>{stats.engagement.shares}</strong><span>Platform shares</span></div>
            </div>
          )}

          {Array.isArray(stats.topNotes) && stats.topNotes.length > 0 && (
            <section className="panel" style={{ marginTop: '1rem' }}>
              <h2 className="home-section-title" style={{ marginTop: 0 }}>Top notes by views</h2>
              <ul className="admin-simple-list">
                {stats.topNotes.map((n) => (
                  <li key={n._id}>
                    <Link to={`/note/${n.cid}`} className="link">{n.title}</Link>
                    {' '}· @{n.uploader}
                    <div className="page-sub">
                      {n.viewCount || 0} views · {n.downloadCount || 0} opens · {n.likeCount || 0} upvotes · {n.favoriteCount || 0} saves · {n.shareCount || 0} shares
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel" style={{ marginTop: '1rem' }}>
            <h2 className="home-section-title" style={{ marginTop: 0 }}>Popular subjects</h2>
            <ul className="admin-simple-list">
              {(stats.popularSubjects || []).map((s) => (
                <li key={s.subject}>{s.subject} · {s.count}</li>
              ))}
            </ul>
          </section>

          <section className="panel" style={{ marginTop: '1rem' }}>
            <h2 className="home-section-title" style={{ marginTop: 0 }}>Recent uploads</h2>
            <ul className="admin-simple-list">
              {(stats.recentUploads || []).map((n) => (
                <li key={n._id}>
                  <Link to={`/note/${n.cid}`} className="link">{n.title}</Link>
                  {' '}· @{n.uploader}
                  {n.isVerified ? ' · ✓' : ''}
                  <div className="action-row" style={{ marginTop: '0.35rem', gap: '0.4rem' }}>
                    {!n.isVerified ? (
                      <button type="button" className="btn btn-inline btn-secondary" disabled={busy} onClick={() => verifyRecent(n._id)}>Verify</button>
                    ) : (
                      <button type="button" className="btn btn-inline btn-secondary" disabled={busy} onClick={() => verifyRecent(n._id, true)}>Unverify</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {tab === 'reports' && (
        <section className="panel" style={{ marginTop: '1rem' }}>
          <h2 className="home-section-title" style={{ marginTop: 0 }}>Pending reports</h2>
          {reports.length === 0 ? (
            <p className="page-sub">No pending reports.</p>
          ) : (
            <ul className="admin-simple-list">
              {reports.map((r) => (
                <li key={r._id}>
                  <strong>{r.targetType}</strong> · {r.targetLabel || r.targetId}
                  <div className="page-sub">@{r.reporterUsername}: {r.reason}</div>
                  <div className="action-row" style={{ marginTop: '0.4rem', gap: '0.4rem' }}>
                    <button type="button" className="btn btn-inline" disabled={busy} onClick={() => resolve(r._id, false)}>Resolve</button>
                    <button type="button" className="btn btn-inline btn-secondary" disabled={busy} onClick={() => resolve(r._id, true)}>Reject</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'audit' && (
        <section className="panel" style={{ marginTop: '1rem' }}>
          <h2 className="home-section-title" style={{ marginTop: 0 }}>Audit log</h2>
          <ul className="admin-simple-list">
            {logs.map((l) => (
              <li key={l._id}>
                <strong>{l.action}</strong> · @{l.actorUsername || 'system'}
                <div className="page-sub">{l.targetType} {l.targetId} · {l.createdAt ? new Date(l.createdAt).toLocaleString() : ''}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'users' && isAdmin && (
        <section className="panel" style={{ marginTop: '1rem' }}>
          <h2 className="home-section-title" style={{ marginTop: 0 }}>User management</h2>
          <form onSubmit={searchUsers} className="filters" style={{ marginBottom: '1rem' }}>
            <input value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="Search username/email" />
            <button type="submit" className="btn btn-inline" disabled={busy}>Search</button>
          </form>
          <ul className="admin-simple-list">
            {users.map((u) => (
              <li key={u._id}>
                @{u.username} · {u.role}{u.restricted ? ' · restricted' : ''}
                <div className="action-row" style={{ marginTop: '0.35rem', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {['student', 'contributor', 'moderator', 'admin'].map((roleName) => (
                    <button
                      key={roleName}
                      type="button"
                      className="btn btn-inline btn-secondary"
                      disabled={busy || u.role === roleName}
                      onClick={async () => {
                        setBusy(true)
                        try {
                          await adminAPI.setRole(u._id, roleName)
                          await searchUsers()
                        } catch (err) {
                          setError(err.response?.data?.msg || 'Role update failed')
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      {roleName}
                    </button>
                  ))}
                  {!u.restricted ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-inline"
                      disabled={busy}
                      onClick={async () => {
                        const reason = window.prompt('Restriction reason') || 'Restricted by admin'
                        setBusy(true)
                        try {
                          await adminAPI.restrictUser(u._id, reason)
                          await searchUsers()
                        } catch (err) {
                          setError(err.response?.data?.msg || 'Restrict failed')
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      Restrict
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-inline"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        try {
                          await adminAPI.unrestrictUser(u._id)
                          await searchUsers()
                        } catch (err) {
                          setError(err.response?.data?.msg || 'Unrestrict failed')
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      Unrestrict
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default AdminDashboard
