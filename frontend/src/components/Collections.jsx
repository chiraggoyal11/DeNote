import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collectionsAPI } from '../api'
import AppNav from './AppNav'

function Collections({ onLogout }) {
  const [collections, setCollections] = useState([])
  const [discover, setDiscover] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await collectionsAPI.list({ discover: '1' })
      setCollections(res.data.collections || [])
      setDiscover(res.data.discover || [])
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load collections')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await collectionsAPI.create({ name, description, isPublic })
      setName('')
      setDescription('')
      setIsPublic(false)
      const id = res.data.collection?._id
      if (id) navigate(`/collections/${id}`)
      else await load()
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not create collection')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="page-head">
        <div>
          <h1 className="page-title">Collections</h1>
          <p className="page-sub">Group notes into packs. Keep them private or share a public link.</p>
        </div>
      </section>

      <div className="panel" style={{ marginBottom: '1.25rem' }}>
        <h2 className="home-section-title" style={{ marginTop: 0 }}>Create a collection</h2>
        <form onSubmit={handleCreate} className="collection-create-form">
          <div className="form-group">
            <label htmlFor="cname">Name</label>
            <input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Semester 5 · DBMS" required maxLength={80} />
          </div>
          <div className="form-group">
            <label htmlFor="cdesc">Description</label>
            <input id="cdesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" maxLength={400} />
          </div>
          <label className="check-row">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Public (shareable link)
          </label>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create collection'}</button>
        </form>
      </div>

      {error && <div className="error">{error}</div>}
      {loading && <p className="loading">Loading collections…</p>}

      {!loading && (
        <>
          <h2 className="home-section-title">Your collections</h2>
          {collections.length === 0 ? (
            <p className="page-sub">No collections yet.</p>
          ) : (
            <div className="collections-grid">
              {collections.map((c) => (
                <Link key={c._id} to={`/collections/${c._id}`} className="collection-card">
                  <h3>{c.name}</h3>
                  <p>{c.description || 'No description'}</p>
                  <p className="page-sub">{c.noteCount} note{c.noteCount === 1 ? '' : 's'} · {c.isPublic ? 'Public' : 'Private'}</p>
                </Link>
              ))}
            </div>
          )}

          {discover.length > 0 && (
            <>
              <h2 className="home-section-title" style={{ marginTop: '1.75rem' }}>Public collections</h2>
              <div className="collections-grid">
                {discover.map((c) => (
                  <Link key={c._id} to={`/collections/${c._id}`} className="collection-card">
                    <h3>{c.name}</h3>
                    <p>@{c.ownerUsername}</p>
                    <p className="page-sub">{c.noteCount} notes · Public</p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Collections
