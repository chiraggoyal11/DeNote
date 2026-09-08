import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { aiAPI, notesAPI } from '../api'
import AppNav from './AppNav'
import OfflineBanner from './OfflineBanner'
import { EmptyNotes, NoteCard, Pagination } from './NoteCard'
import { NotesGridSkeleton } from './Skeleton'
import { RESOURCE_TYPES } from '../utils/resourceTypes'
import { cacheKeyNotesQuery, withOfflineCache } from '../utils/offlineCache'

function NotesList({ onLogout }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiHits, setAiHits] = useState(null)
  const [filters, setFilters] = useState({
    q: '',
    branch: '',
    semester: '',
    subject: '',
    uploader: '',
    college: '',
    resourceType: 'all',
    tag: '',
    sort: 'recent'
  })

  const fetchNotes = useCallback(async (pageArg = page, filterArg = filters) => {
    setLoading(true)
    setError('')
    setFromCache(false)
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
      if (filterArg.college.trim()) params.college = filterArg.college.trim()
      if (filterArg.tag.trim()) params.tag = filterArg.tag.trim()
      if (filterArg.resourceType && filterArg.resourceType !== 'all') {
        params.resourceType = filterArg.resourceType
      }

      const { data, fromCache: cached } = await withOfflineCache(
        cacheKeyNotesQuery(params),
        () => notesAPI.queryNotes(params)
      )
      setNotes(data.notes || [])
      setPage(data.page || pageArg)
      setTotalPages(data.totalPages || 1)
      setTotal(data.total || 0)
      setFromCache(Boolean(cached))
    } catch (err) {
      setError('Failed to fetch notes')
      console.error('Fetch notes error:', err)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    fetchNotes(1, filters)
    aiAPI.status()
      .then((res) => setAiEnabled(Boolean(res.data?.ai?.enabled)))
      .catch(() => setAiEnabled(false))
    // intentionally run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  const handleSearch = (e) => {
    e?.preventDefault?.()
    setAiHits(null)
    setPage(1)
    fetchNotes(1, filters)
  }

  const handleAiSearch = async (e) => {
    e?.preventDefault?.()
    if (!filters.q.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await aiAPI.search(filters.q.trim(), 12)
      setAiHits(res.data.results || [])
    } catch (err) {
      setError(err.response?.data?.msg || 'AI search failed')
      setAiHits([])
    } finally {
      setLoading(false)
    }
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
      <OfflineBanner fromCache={fromCache} scope="stale" />

      <section className="page-head">
        <div>
          <h1 className="page-title">Browse resources</h1>
          <p className="page-sub">Search by title, subject, tags, or uploader. Filter by type and sort by popularity.</p>
        </div>
      </section>

      <form className="filters filters-search" onSubmit={handleSearch}>
        <input
          type="search"
          name="q"
          placeholder="Search title, subject, tags, uploader…"
          value={filters.q}
          onChange={handleFilterChange}
          className="filters-q"
        />
        <select name="resourceType" value={filters.resourceType} onChange={handleFilterChange} aria-label="Resource type">
          <option value="all">All types</option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input type="text" name="branch" placeholder="Branch" value={filters.branch} onChange={handleFilterChange} />
        <input type="text" name="semester" placeholder="Semester" value={filters.semester} onChange={handleFilterChange} />
        <input type="text" name="subject" placeholder="Subject" value={filters.subject} onChange={handleFilterChange} />
        <input type="text" name="college" placeholder="College" value={filters.college} onChange={handleFilterChange} />
        <input type="text" name="uploader" placeholder="Uploader" value={filters.uploader} onChange={handleFilterChange} />
        <input type="text" name="tag" placeholder="Tag" value={filters.tag} onChange={handleFilterChange} />
        <select name="sort" value={filters.sort} onChange={handleFilterChange} aria-label="Sort notes">
          <option value="recent">Newest</option>
          <option value="likes">Most upvoted</option>
          <option value="views">Most viewed</option>
          <option value="downloads">Most downloaded</option>
          <option value="quality">Highest rated</option>
        </select>
        <button type="submit" className="btn btn-inline">Search</button>
        {aiEnabled && (
          <button type="button" className="btn btn-secondary btn-inline" onClick={handleAiSearch}>
            AI search
          </button>
        )}
      </form>

      {loading && !aiHits && <NotesGridSkeleton count={6} />}
      {error && <div className="error" style={{ marginTop: '1rem' }} role="alert">{error}</div>}

      {aiHits && (
        <section className="panel" style={{ marginTop: '1rem' }}>
          <h2 className="home-section-title" style={{ marginTop: 0 }}>Semantic matches</h2>
          {aiHits.length === 0 ? (
            <p className="page-sub">No semantic matches for that query.</p>
          ) : (
            <ul className="admin-simple-list">
              {aiHits.map((h) => (
                <li key={h.noteId}>
                  <Link to={`/note/${h.cid}`} className="link">{h.title}</Link>
                  <div className="page-sub">
                    score {h.score} · {h.subject || 'General'} · {h.snippet}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!loading && !aiHits && notes.length === 0 && (
        <EmptyNotes title="No resources found." actionTo="/upload" actionLabel="Upload a resource" />
      )}

      {!aiHits && (
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
      )}

      {!loading && !aiHits && (
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
