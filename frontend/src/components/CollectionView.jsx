import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collectionsAPI } from '../api'
import AppNav from './AppNav'
import { NoteCard } from './NoteCard'

function CollectionView({ onLogout, shared = false }) {
  const { id, shareId } = useParams()
  const [collection, setCollection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rename, setRename] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = shared
        ? await collectionsAPI.getShared(shareId)
        : await collectionsAPI.get(id)
      setCollection(res.data.collection)
      setRename(res.data.collection?.name || '')
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load collection')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, shareId, shared])

  const handleRename = async (e) => {
    e.preventDefault()
    if (!collection?.isOwner) return
    setBusy(true)
    try {
      const res = await collectionsAPI.update(collection._id, { name: rename })
      setCollection((prev) => ({ ...prev, ...res.data.collection, notes: prev.notes }))
    } catch (err) {
      setError(err.response?.data?.msg || 'Rename failed')
    } finally {
      setBusy(false)
    }
  }

  const togglePublic = async () => {
    if (!collection?.isOwner) return
    setBusy(true)
    try {
      const res = await collectionsAPI.update(collection._id, { isPublic: !collection.isPublic })
      setCollection((prev) => ({ ...prev, ...res.data.collection, notes: prev.notes }))
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not update visibility')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!collection?.isOwner) return
    if (!window.confirm('Delete this collection? Notes stay uploaded.')) return
    try {
      await collectionsAPI.remove(collection._id)
      navigate('/collections')
    } catch (err) {
      setError(err.response?.data?.msg || 'Delete failed')
    }
  }

  const removeNote = async (note) => {
    if (!collection?.isOwner || !note?._id) return
    setBusy(true)
    try {
      const res = await collectionsAPI.removeNote(collection._id, note._id)
      setCollection(res.data.collection)
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not remove note')
    } finally {
      setBusy(false)
    }
  }

  const move = async (index, dir) => {
    if (!collection?.isOwner) return
    const items = (collection.notes || []).map((n) => String(n.noteId))
    const next = index + dir
    if (next < 0 || next >= items.length) return
    ;[items[index], items[next]] = [items[next], items[index]]
    setBusy(true)
    try {
      const res = await collectionsAPI.reorder(collection._id, items)
      setCollection(res.data.collection)
    } catch (err) {
      setError(err.response?.data?.msg || 'Reorder failed')
    } finally {
      setBusy(false)
    }
  }

  const shareUrl = collection?.shareId && collection?.isPublic
    ? `${window.location.origin}/collections/share/${collection.shareId}`
    : ''

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading collection…</div>
      </div>
    )
  }

  if (error && !collection) {
    return (
      <div className="container page-enter">
        <AppNav onLogout={onLogout} />
        <div className="error">{error}</div>
        <Link to="/collections" className="link">Back to collections</Link>
      </div>
    )
  }

  const notes = (collection?.notes || []).map((item) => item.note).filter(Boolean)

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="page-head">
        <div>
          <Link to="/collections" className="link">← Collections</Link>
          <h1 className="page-title" style={{ marginTop: '0.65rem' }}>{collection?.name}</h1>
          <p className="page-sub">
            {collection?.description || 'No description'} · @{collection?.ownerUsername} ·{' '}
            {collection?.isPublic ? 'Public' : 'Private'} · {notes.length} notes
          </p>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      {collection?.isOwner && (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <form onSubmit={handleRename} className="collection-create-form">
            <div className="form-group">
              <label htmlFor="rename">Rename</label>
              <input id="rename" value={rename} onChange={(e) => setRename(e.target.value)} required maxLength={80} />
            </div>
            <div className="action-row" style={{ gap: '0.65rem', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-inline" disabled={busy}>Save name</button>
              <button type="button" className="btn btn-secondary btn-inline" disabled={busy} onClick={togglePublic}>
                Make {collection.isPublic ? 'private' : 'public'}
              </button>
              <button type="button" className="btn btn-danger btn-inline" onClick={handleDelete}>Delete</button>
            </div>
          </form>
          {shareUrl && (
            <p className="page-sub" style={{ marginTop: '0.85rem' }}>
              Share link: <a className="link" href={shareUrl}>{shareUrl}</a>
            </p>
          )}
        </div>
      )}

      {notes.length === 0 ? (
        <p className="page-sub">No notes in this collection yet. Open a note and use “Add to collection”.</p>
      ) : (
        <div className="notes-grid">
          {notes.map((note, index) => (
            <div key={note._id} className="collection-note-wrap">
              <NoteCard note={note} />
              {collection?.isOwner && (
                <div className="collection-note-controls">
                  <button type="button" className="btn btn-secondary btn-inline" disabled={busy || index === 0} onClick={() => move(index, -1)}>Up</button>
                  <button type="button" className="btn btn-secondary btn-inline" disabled={busy || index === notes.length - 1} onClick={() => move(index, 1)}>Down</button>
                  <button type="button" className="btn btn-danger btn-inline" disabled={busy} onClick={() => removeNote(note)}>Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CollectionView
