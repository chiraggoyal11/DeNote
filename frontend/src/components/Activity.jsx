import { useEffect, useState } from 'react'
import { communityAPI } from '../api'
import AppNav from './AppNav'
import { EmptyNotes, NoteCard, Pagination } from './NoteCard'

function Activity({ onLogout }) {
  const [notes, setNotes] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async (pageArg = 1) => {
    setLoading(true)
    setError('')
    try {
      const res = await communityAPI.activity({ page: pageArg, limit: 12 })
      setNotes(res.data.notes || [])
      setPage(res.data.page || pageArg)
      setTotalPages(res.data.totalPages || 1)
      setTotal(res.data.total || 0)
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
  }, [])

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />
      <section className="page-head">
        <div>
          <h1 className="page-title">Following feed</h1>
          <p className="page-sub">Latest uploads from people you follow.</p>
        </div>
      </section>
      {loading && <p className="loading">Loading…</p>}
      {error && <div className="error">{error}</div>}
      {!loading && notes.length === 0 && (
        <EmptyNotes title="Follow classmates to see their uploads here." actionTo="/notes" actionLabel="Browse notes" />
      )}
      <div className="notes-grid">
        {notes.map((note) => (
          <NoteCard key={note._id} note={note} />
        ))}
      </div>
      {!loading && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={(next) => {
            setPage(next)
            load(next)
          }}
        />
      )}
    </div>
  )
}

export default Activity
