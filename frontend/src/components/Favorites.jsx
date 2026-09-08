import { useCallback, useEffect, useState } from 'react'
import { notesAPI } from '../api'
import AppNav from './AppNav'
import { EmptyNotes, NoteCard, Pagination } from './NoteCard'
import { NotesGridSkeleton } from './Skeleton'

function Favorites({ onLogout }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchFavorites = useCallback(async (pageArg = 1) => {
    setLoading(true)
    setError('')
    try {
      const response = await notesAPI.favorites({ page: pageArg, limit: 12 })
      setNotes(response.data.notes || [])
      setPage(response.data.page || pageArg)
      setTotalPages(response.data.totalPages || 1)
      setTotal(response.data.total || 0)
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load favorites')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFavorites(1)
  }, [fetchFavorites])

  const patchNote = (noteId, patch) => {
    setNotes((prev) => prev.map((n) => (n._id === noteId ? { ...n, ...patch } : n)))
  }

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="page-head">
        <div>
          <h1 className="page-title">Favorites</h1>
          <p className="page-sub">Notes you bookmarked for later.</p>
        </div>
      </section>

      {loading && <NotesGridSkeleton count={4} />}
      {error && <div className="error" role="alert">{error}</div>}

      {!loading && notes.length === 0 && (
        <EmptyNotes title="No favorites yet." actionTo="/notes" actionLabel="Browse notes" />
      )}

      <div className="notes-grid">
        {notes.map((note) => (
          <NoteCard
            key={note._id}
            note={note}
            onToggleLike={async (n) => {
              const res = await notesAPI.toggleLike(n._id)
              patchNote(n._id, { likedByMe: res.data.liked, likeCount: res.data.likeCount })
            }}
            onToggleFavorite={async (n) => {
              const res = await notesAPI.toggleFavorite(n._id)
              if (!res.data.favorited) {
                setNotes((prev) => prev.filter((x) => x._id !== n._id))
                setTotal((t) => Math.max(0, t - 1))
              } else {
                patchNote(n._id, { favoritedByMe: true })
              }
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
            fetchFavorites(next)
          }}
        />
      )}
    </div>
  )
}

export default Favorites
