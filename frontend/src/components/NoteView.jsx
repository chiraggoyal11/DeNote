import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { notesAPI } from '../api'

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
      console.log('Note data:', response.data)
      // Backend returns { note: {...}, url: ... }
      setNote(response.data.note)
      setRating(response.data.note?.rating || 0)
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
      // Backend expects MongoDB _id, not cid
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
      // Backend expects array of MongoDB _id
      await notesAPI.deleteNote([note._id])
      alert('Note deleted successfully!')
      navigate('/notes')
    } catch (err) {
      alert('Failed to delete note: ' + (err.response?.data?.msg || err.message))
      console.error(err)
    }
  }

  const ipfsGatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`

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
        <div>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/upload">Upload Note</Link>
          <Link to="/notes">Browse Notes</Link>
          <button onClick={onLogout} className="btn btn-secondary" style={{ marginLeft: '1rem' }}>
            Logout
          </button>
        </div>
      </nav>

      <div style={{ textAlign: 'left', marginTop: '2rem' }}>
        <Link to="/notes" className="link">← Back to Notes</Link>

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
              <button onClick={handleRatingUpdate} className="btn">
                Update Rating
              </button>
            </div>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <a href={ipfsGatewayUrl} target="_blank" rel="noopener noreferrer">
              <button className="btn">📄 View on IPFS</button>
            </a>
            <button onClick={handleDelete} className="btn btn-secondary" style={{ background: '#ff6b6b' }}>
              🗑️ Delete Note
            </button>
          </div>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h3>Preview</h3>
          <iframe
            src={ipfsGatewayUrl}
            style={{
              width: '100%',
              height: '600px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              marginTop: '1rem'
            }}
            title="Note Preview"
          />
        </div>
      </div>
    </div>
  )
}

export default NoteView
