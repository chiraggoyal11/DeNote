import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { notesAPI } from '../api'

function NotesList({ onLogout }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    branch: '',
    semester: '',
    subject: ''
  })
  const navigate = useNavigate()

  useEffect(() => {
    fetchNotes()
  }, [])

  const fetchNotes = async () => {
    try {
      const params = {}
      if (filters.branch) params.branch = filters.branch
      if (filters.semester) params.sem = filters.semester
      if (filters.subject) params.subject = filters.subject

      const response = await notesAPI.queryNotes(params)
      setNotes(response.data.notes || [])
    } catch (err) {
      setError('Failed to fetch notes')
      console.error('Fetch notes error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  const handleSearch = () => {
    setLoading(true)
    fetchNotes()
  }

  const handleNoteClick = (cid) => {
    navigate(`/note/${cid}`)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    if (onLogout) onLogout()
    window.location.href = '/login'
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>📖 Browse Notes</h2>
          <Link to="/upload" className="btn" style={{ width: 'auto', textDecoration: 'none' }}>
            📤 Upload Note
          </Link>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            name="branch"
            placeholder="Filter by branch"
            value={filters.branch}
            onChange={handleFilterChange}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <input
            type="text"
            name="semester"
            placeholder="Filter by semester"
            value={filters.semester}
            onChange={handleFilterChange}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <input
            type="text"
            name="subject"
            placeholder="Filter by subject"
            value={filters.subject}
            onChange={handleFilterChange}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <button type="button" onClick={handleSearch} className="btn" style={{ width: 'auto' }}>
            Search
          </button>
        </div>

        {loading && <p style={{ marginTop: '2rem' }}>Loading notes...</p>}
        {error && <div className="error" style={{ marginTop: '2rem' }}>{error}</div>}

        {!loading && notes.length === 0 && (
          <div style={{ marginTop: '2rem' }}>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              No notes found. Upload your first note to get started.
            </p>
            <Link to="/upload" className="btn" style={{ width: 'auto', display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}>
              📤 Upload Note
            </Link>
          </div>
        )}

        <div className="notes-grid">
          {notes.map((note) => (
            <div
              key={note._id || note.cid}
              className="note-card"
              onClick={() => handleNoteClick(note.cid)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleNoteClick(note.cid)
              }}
            >
              <h3>{note.title || 'Untitled'}</h3>
              <p><strong>Subject:</strong> {note.subject || 'N/A'}</p>
              <p><strong>Branch:</strong> {note.branch || 'N/A'}</p>
              <p><strong>Semester:</strong> {note.sem || 'N/A'}</p>
              <div className="rating">
                ⭐ Rating: {note.rating || 0}
              </div>
              <p style={{ fontSize: '0.8em', marginTop: '0.5rem' }}>
                CID: {note.cid?.substring(0, 20)}...
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default NotesList
