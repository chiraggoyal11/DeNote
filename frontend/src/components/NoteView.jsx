import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { notesAPI } from '../api'
import AppNav from './AppNav'

const IPFS_GATEWAY = (import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/').replace(/\/?$/, '/')

function NoteView({ onLogout }) {
  const { cid } = useParams()
  const [note, setNote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchNote()
  }, [cid])

  const fetchNote = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await notesAPI.getNote(cid)
      const noteData = response.data.note
      setNote({
        ...noteData,
        fileUrl: response.data.url || noteData?.fileUrl
      })
    } catch (err) {
      setError('Failed to fetch note details')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleLike = async () => {
    if (!note?._id || busy) return
    setBusy(true)
    try {
      const res = await notesAPI.toggleLike(note._id)
      setNote((prev) => ({
        ...prev,
        likedByMe: res.data.liked,
        likeCount: res.data.likeCount
      }))
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to update upvote')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!note?._id || busy) return
    setBusy(true)
    try {
      const res = await notesAPI.toggleFavorite(note._id)
      setNote((prev) => ({
        ...prev,
        favoritedByMe: res.data.favorited
      }))
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to update favorite')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!note?.isOwner) {
      alert('Only the uploader can delete this note.')
      return
    }
    if (!window.confirm('Delete this note?')) return
    if (!note?._id) return
    try {
      await notesAPI.deleteNote([note._id])
      navigate('/my-uploads')
    } catch (err) {
      alert('Failed to delete note: ' + (err.response?.data?.msg || err.message))
      console.error(err)
    }
  }

  const openUrl = note?.fileUrl || `${IPFS_GATEWAY}${cid}`
  const previewUrl = notesAPI.previewUrl(cid)

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading note…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container page-enter">
        <AppNav onLogout={onLogout} />
        <div className="error">{error}</div>
        <Link to="/notes" className="link" style={{ marginTop: '1rem', display: 'inline-block' }}>Back to notes</Link>
      </div>
    )
  }

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <div className="page-head">
        <div>
          <Link to="/notes" className="link">← Back to browse</Link>
          <h1 className="page-title" style={{ marginTop: '0.65rem' }}>{note?.title || 'Untitled note'}</h1>
        </div>
      </div>

      <section className="panel">
        <div className="meta-grid">
          <p><strong>Subject:</strong> {note?.subject || 'N/A'}</p>
          <p><strong>Branch:</strong> {note?.branch || 'N/A'}</p>
          <p><strong>Semester:</strong> {note?.sem || 'N/A'}</p>
          <p><strong>Uploader:</strong> @{note?.uploader || 'Anonymous'}</p>
          <p><strong>CID:</strong> <code>{cid}</code></p>
        </div>

        <div className="action-row" style={{ marginTop: '1.25rem', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-inline ${note?.likedByMe ? '' : 'btn-secondary'}`}
            onClick={handleToggleLike}
            disabled={busy}
          >
            {note?.likedByMe ? '▲ Upvoted' : '▲ Upvote'} · {note?.likeCount || 0}
          </button>
          <button
            type="button"
            className={`btn btn-inline ${note?.favoritedByMe ? '' : 'btn-secondary'}`}
            onClick={handleToggleFavorite}
            disabled={busy}
          >
            {note?.favoritedByMe ? '★ Saved' : '☆ Save'}
          </button>
          <a className="btn btn-inline btn-secondary" href={openUrl} target="_blank" rel="noopener noreferrer">
            Open on IPFS
          </a>
          {note?.isOwner && (
            <button type="button" onClick={handleDelete} className="btn btn-danger btn-inline">
              Delete note
            </button>
          )}
        </div>
        {!note?.isOwner && (
          <p className="auth-hint" style={{ marginTop: '0.75rem' }}>
            Only the uploader can delete this note.
          </p>
        )}
      </section>

      <section className="section">
        <h2>Preview</h2>
        <p className="page-sub">If the preview stays blank, use Open on IPFS.</p>
        <iframe
          className="preview-frame"
          src={previewUrl}
          title="Note preview"
        />
      </section>
    </div>
  )
}

export default NoteView
