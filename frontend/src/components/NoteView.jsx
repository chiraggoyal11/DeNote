import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { notesAPI } from '../api'

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
    if (!window.confirm('Are you sure you want to delete this note?')) return

    if (!note?._id) {
      alert('Note ID not found')
      return
    }

    try {
      await notesAPI.deleteNote([note._id])
      alert('Note deleted successfully!')
      navigate('/notes')
    } catch (err) {
      alert('Failed to delete note: ' + (err.response?.data?.msg || err.message))
      console.error(err)
    }
  }

  const openUrl = note?.fileUrl || `${IPFS_GATEWAY}${cid}`
  // Same-origin/API proxy preview so iframe is not blocked by IPFS gateway headers
  const previewUrl = notesAPI.previewUrl(cid)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    if (onLogout) onLogout()
    window.location.href = '/login'
  }

  if (loading) {
    return <div className="container">Loading...</div>
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">{error}</div>
        <Link to="/notes" className="link">Back to Notes</Link>
      </div>
    )
  }

  return (
    <div className="container">
      <nav className="navbar">
        <h1>📚 DeNote</h1>
        <div className="navbar-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/upload">Upload Note</Link>
          <Link to="/notes">Browse Notes</Link>
          <button type="button" onClick={handleLogout} className="btn btn-secondary" style={{ marginLeft: '1rem' }}>
            Logout
          </button>
        </div>
      </nav>

      <div style={{ textAlign: 'left', marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to="/notes" className="link">← Back to Notes</Link>
          <Link to="/upload" className="btn" style={{ width: 'auto', textDecoration: 'none' }}>
            📤 Upload Note
          </Link>
        </div>

        <div className="note-details-card">
          <h2>{note?.title || 'Untitled Note'}</h2>
          
          <div style={{ marginTop: '1.5rem' }}>
            <p><strong>Subject:</strong> {note?.subject || 'N/A'}</p>
            <p><strong>Branch:</strong> {note?.branch || 'N/A'}</p>
            <p><strong>Semester:</strong> {note?.sem || 'N/A'}</p>
            <p><strong>Uploader:</strong> {note?.uploader || 'Anonymous'}</p>
            <p><strong>CID:</strong> <code>{cid}</code></p>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h3>Rating: ⭐ {rating}</h3>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
              <input
                type="number"
                min="0"
                max="5"
                value={rating}
                onChange={(e) => setRating(parseInt(e.target.value) || 0)}
                style={{ width: '80px' }}
              />
              <button type="button" onClick={handleRatingUpdate} className="btn">
                Update Rating
              </button>
            </div>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a
              className="btn"
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none', width: 'auto' }}
            >
              📄 View on IPFS
            </a>
            <button type="button" onClick={handleDelete} className="btn btn-secondary" style={{ background: '#ff6b6b', width: 'auto' }}>
              🗑️ Delete Note
            </button>
          </div>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h3>Preview</h3>
          <p style={{ color: 'rgba(255,255,255,0.55)', marginTop: '0.5rem' }}>
            If the preview stays blank, open the file with <strong>View on IPFS</strong>.
          </p>
          <iframe
            src={previewUrl}
            style={{
              width: '100%',
              height: '700px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              marginTop: '1rem',
              background: '#fff'
            }}
            title="Note Preview"
          />
        </div>
      </div>
    </div>
  )
}

export default NoteView
