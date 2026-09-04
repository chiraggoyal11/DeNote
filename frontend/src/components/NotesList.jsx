import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { notesAPI } from '../api'
import AppNav from './AppNav'

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

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="page-head">
        <div>
          <h1 className="page-title">Browse notes</h1>
          <p className="page-sub">Filter by branch, semester, or subject, then open a note to preview.</p>
        </div>
      </section>

      <div className="filters">
        <input
          type="text"
          name="branch"
          placeholder="Branch"
          value={filters.branch}
          onChange={handleFilterChange}
        />
        <input
          type="text"
          name="semester"
          placeholder="Semester"
          value={filters.semester}
          onChange={handleFilterChange}
        />
        <input
          type="text"
          name="subject"
          placeholder="Subject"
          value={filters.subject}
          onChange={handleFilterChange}
        />
        <button type="button" onClick={handleSearch} className="btn btn-inline">
          Search
        </button>
      </div>

      {loading && <p className="loading">Loading notes…</p>}
      {error && <div className="error" style={{ marginTop: '1rem' }}>{error}</div>}

      {!loading && notes.length === 0 && (
        <div className="empty-state">
          <p>No notes found yet.</p>
          <Link to="/upload" className="btn btn-inline" style={{ marginTop: '1rem' }}>
            Upload the first note
          </Link>
        </div>
      )}

      <div className="notes-grid">
        {notes.map((note) => (
          <div
            key={note._id || note.cid}
            className="note-card"
            onClick={() => navigate(`/note/${note.cid}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate(`/note/${note.cid}`)
            }}
          >
            <h3>{note.title || 'Untitled'}</h3>
            <p><strong>Subject:</strong> {note.subject || 'N/A'}</p>
            <p><strong>Branch:</strong> {note.branch || 'N/A'}</p>
            <p><strong>Semester:</strong> {note.sem || 'N/A'}</p>
            <div className="rating">Rating {note.rating || 0}/5</div>
            <span className="cid-chip">{note.cid?.substring(0, 18)}…</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NotesList
