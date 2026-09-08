import { useState, useEffect, useCallback } from 'react'
import { notesAPI } from '../api'
import AppNav from './AppNav'
import { EmptyNotes, NoteCard, Pagination } from './NoteCard'

function NotesList({ onLogout }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    q: '',
    branch: '',
    semester: '',
    subject: '',
    uploader: '',
    sort: 'recent'
  })

  const fetchNotes = useCallback(async (pageArg = page, filterArg = filters) => {
    setLoading(true)
    setError('')
    try {
      const params = {
        page: pageArg,
        limit: 12,
        sort: filterArg.sort || 'recent'
      }
      if (filterArg.q.trim()) params.q = filterArg.q.trim()
      if (filterArg.branch.trim()) params.branch = filterArg.branch.trim()
      if (filterArg.semester.trim()) params.sem = filterArg.semester.trim()
      if (filterArg.subject.trim()) params.subject = filterArg.subject.trim()
      if (filterArg.uploader.trim()) params.uploader = filterArg.uploader.trim()

      const response = await notesAPI.queryNotes(params)
      setNotes(response.data.notes || [])
      setPage(response.data.page || pageArg)
      setTotalPages(response.data.totalPages || 1)
      setTotal(response.data.total || 0)
    } catch (err) {
      setError('Failed to fetch notes')
      console.error('Fetch notes error:', err)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    fetchNotes(1, filters)
    // intentionally run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  const handleSearch = (e) => {
    e?.preventDefault?.()
    setPage(1)
    fetchNotes(1, filters)
  }

  const patchNote = (noteId, patch) => {
    setNotes((prev) => prev.map((n) => (n._id === noteId ? { ...n, ...patch } : n)))
  }

  const handleToggleLike = async (note) => {
    try {
      const res = await notesAPI.toggleLike(note._id)
      patchNote(note._id, {
        likedByMe: res.data.liked,
        likeCount: res.data.likeCount
      })
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not update upvote')
    }
  }

  const handleToggleFavorite = async (note) => {
    try {
      const res = await notesAPI.toggleFavorite(note._id)
      patchNote(note._id, { favoritedByMe: res.data.favorited })
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not update favorite')
    }
  }

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="page-head">
        <div>
          <h1 className="page-title">Browse notes</h1>
          <p className="page-sub">Search by title, subject, or uploader. Filter and paginate results.</p>
        </div>
      </section>

      <form className="filters filters-search" onSubmit={handleSearch}>
        <input
          type="search"
          name="q"
          placeholder="Search title, subject, uploader…"
          value={filters.q}
          onChange={handleFilterChange}
          className="filters-q"
        />
        <input type="text" name="branch" placeholder="Branch" value={filters.branch} onChange={handleFilterChange} />
        <input type="text" name="semester" placeholder="Semester" value={filters.semester} onChange={handleFilterChange} />
        <input type="text" name="subject" placeholder="Subject" value={filters.subject} onChange={handleFilterChange} />
        <input type="text" name="uploader" placeholder="Uploader" value={filters.uploader} onChange={handleFilterChange} />
        <select name="sort" value={filters.sort} onChange={handleFilterChange} aria-label="Sort notes">
          <option value="recent">Newest</option>
          <option value="likes">Most upvoted</option>
        </select>
        <button type="submit" className="btn btn-inline">Search</button>
      </form>

      {loading && <p className="loading">Loading notes…</p>}
      {error && <div className="error" style={{ marginTop: '1rem' }}>{error}</div>}

      {!loading && notes.length === 0 && (
        <EmptyNotes title="No notes found." actionTo="/upload" actionLabel="Upload a note" />
      )}

      <div className="notes-grid">
        {notes.map((note) => (
          <NoteCard
            key={note._id || note.cid}
            note={note}
            onToggleLike={handleToggleLike}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
      </div>

      {!loading && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={(next) => {
            setPage(next)
            fetchNotes(next, filters)
          }}
        />
      )}
    </div>
  )
}

export default NotesList
