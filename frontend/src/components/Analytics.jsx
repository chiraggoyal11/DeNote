import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { notesAPI } from '../api'
import AppNav from './AppNav'

function Analytics({ onLogout }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await notesAPI.analytics()
        if (!cancelled) setData(res.data.analytics)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.msg || 'Failed to load analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const totals = data?.totals || {}

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="page-head">
        <div>
          <h1 className="page-title">Your analytics</h1>
          <p className="page-sub">
            Views, opens, upvotes, saves, and shares across your latest uploads.
          </p>
        </div>
      </section>

      {error && <div className="error">{error}</div>}
      {loading ? (
        <p className="loading">Loading analytics…</p>
      ) : (
        <>
          <div className="admin-stat-grid analytics-stat-grid">
            <div className="admin-stat"><strong>{totals.notes || 0}</strong><span>Notes</span></div>
            <div className="admin-stat"><strong>{totals.views || 0}</strong><span>Views</span></div>
            <div className="admin-stat"><strong>{totals.downloads || 0}</strong><span>Opens</span></div>
            <div className="admin-stat"><strong>{totals.likes || 0}</strong><span>Upvotes</span></div>
            <div className="admin-stat"><strong>{totals.saves || 0}</strong><span>Saves</span></div>
            <div className="admin-stat"><strong>{totals.shares || 0}</strong><span>Shares</span></div>
          </div>

          {(data?.notes || []).length === 0 ? (
            <section className="panel" style={{ marginTop: '1rem' }}>
              <p className="page-sub">No uploads yet. <Link to="/upload" className="link">Upload a note</Link> to start tracking engagement.</p>
            </section>
          ) : (
            <section className="panel" style={{ marginTop: '1rem' }}>
              <h2 className="home-section-title" style={{ marginTop: 0 }}>Per-note breakdown</h2>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Note</th>
                      <th>Views</th>
                      <th>Opens</th>
                      <th>Upvotes</th>
                      <th>Saves</th>
                      <th>Shares</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.notes || []).map((n) => (
                      <tr key={n._id}>
                        <td>
                          <Link to={`/note/${n.cid}`} className="link">{n.title}</Link>
                          <div className="page-sub">{n.subject || '—'}</div>
                        </td>
                        <td>{n.viewCount || 0}</td>
                        <td>{n.downloadCount || 0}</td>
                        <td>{n.likeCount || 0}</td>
                        <td>{n.favoriteCount || 0}</td>
                        <td>{n.shareCount || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default Analytics
