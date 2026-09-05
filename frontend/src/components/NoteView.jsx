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
  const [rating, setRating] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    fetchNote()
  }, [cid])

  const fetchNote = async () => {
    try {
      const response = await notesAPI.getNote(cid)
      const noteData = response.data.note
      setNote({
        ...noteData,
        fileUrl: response.data.url || noteData?.fileUrl
      })
      setRating(noteData?.rating || 0)
    } catch (err) {
      setError('Failed to fetch note details')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRatingUpdate = async () => {
    if (!note?._id) {
      alert('Note ID not found')
      return
    }
    try {
      await notesAPI.updateNote(note._id, { rating })
      alert('Rating updated successfully!')
      fetchNote()
    } catch (err) {
      alert('Failed to update rating')
      console.error(err)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this note?')) return
    if (!note?._id) {
      alert('Note ID not found')
      return
    }
    try {
      await notesAPI.deleteNote([note._id])
      navigate('/notes')
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
          <p><strong>Uploader:</strong> {note?.uploader || 'Anonymous'}</p>
          <p><strong>CID:</strong> <code>{cid}</code></p>
        </div>

        <div style={{ marginTop: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.65rem' }}>Rating {rating}/5</h3>
          <div className="action-row" style={{ alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              max="5"
              value={rating}
              onChange={(e) => setRating(parseInt(e.target.value) || 0)}
              style={{ width: '88px', padding: '0.65rem', borderRadius: '10px', border: '1px solid var(--line)' }}
            />
            <button type="button" onClick={handleRatingUpdate} className="btn btn-inline">
              Save rating
            </button>
          </div>
        </div>

        <div className="action-row" style={{ marginTop: '1.25rem' }}>
          <a className="btn btn-inline" href={openUrl} target="_blank" rel="noopener noreferrer">
            Open on IPFS
          </a>
          <button type="button" onClick={handleDelete} className="btn btn-danger btn-inline">
            Delete note
          </button>
        </div>
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
