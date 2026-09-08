import { useCallback, useEffect, useState } from 'react'
import { notesAPI } from '../api'
import AppNav from './AppNav'
import { EmptyNotes, NoteCard, Pagination } from './NoteCard'
import { NotesGridSkeleton } from './Skeleton'

function MyUploads({ onLogout }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')

  const fetchMine = useCallback(async (pageArg = 1, query = q) => {
    setLoading(true)
    setError('')
    try {
      const params = { page: pageArg, limit: 12 }
      if (query.trim()) params.q = query.trim()
      const response = await notesAPI.myNotes(params)
      setNotes(response.data.notes || [])
      setPage(response.data.page || pageArg)
      setTotalPages(response.data.totalPages || 1)
      setTotal(response.data.total || 0)
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load your uploads')
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    fetchMine(1, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchNote = (noteId, patch) => {
    setNotes((prev) => prev.map((n) => (n._id === noteId ? { ...n, ...patch } : n)))
  }

  const handleDelete = async (note) => {
    if (!window.confirm(`Delete “${note.title}”?`)) return
    try {
      await notesAPI.deleteNote([note._id])
      setNotes((prev) => prev.filter((n) => n._id !== note._id))
      setTotal((t) => Math.max(0, t - 1))
    } catch (err) {
      setError(err.response?.data?.msg || 'Delete failed')
    }
  }

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="page-head">
        <div>
          <h1 className="page-title">My uploads</h1>
          <p className="page-sub">Notes you posted. Only you can delete them.</p>
        </div>
      </section>

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          fetchMine(1, q)
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your notes…"
          className="filters-q"
        />
        <button type="submit" className="btn btn-inline">Search</button>
      </form>

      {loading && <NotesGridSkeleton count={4} />}
      {error && <div className="error" role="alert">{error}</div>}

      {!loading && notes.length === 0 && (
        <EmptyNotes title="You haven’t uploaded any notes yet." actionTo="/upload" actionLabel="Upload a note" />
      )}

      <div className="notes-grid">
        {notes.map((note) => (
          <NoteCard
            key={note._id}
            note={note}
            showOwnerActions
            onDelete={handleDelete}
            onToggleLike={async (n) => {
              const res = await notesAPI.toggleLike(n._id)
              patchNote(n._id, { likedByMe: res.data.liked, likeCount: res.data.likeCount })
            }}
            onToggleFavorite={async (n) => {
              const res = await notesAPI.toggleFavorite(n._id)
              patchNote(n._id, { favoritedByMe: res.data.favorited })
            }}
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
            fetchMine(next, q)
          }}
        />
      )}
    </div>
  )
}

export default MyUploads
