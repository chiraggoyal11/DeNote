import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { adminAPI, collectionsAPI, notesAPI } from '../api'
import AppNav from './AppNav'
import CommentSection from './CommentSection'
import AiPanel from './AiPanel'
import { PageSkeleton } from './Skeleton'

const IPFS_GATEWAY = (import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/').replace(/\/?$/, '/')

function NoteView({ onLogout }) {
  const { cid } = useParams()
  const [note, setNote] = useState(null)
  const [versions, setVersions] = useState([])
  const [collections, setCollections] = useState([])
  const [collectionId, setCollectionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [collectionMsg, setCollectionMsg] = useState('')
  const [shareMsg, setShareMsg] = useState('')
  const [modMsg, setModMsg] = useState('')
  const navigate = useNavigate()
  const role = localStorage.getItem('role') || 'student'
  const isStaff = role === 'moderator' || role === 'admin'

  useEffect(() => {
    fetchNote()
  }, [cid])

  const fetchNote = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await notesAPI.getNote(cid)
      const noteData = response.data.note
      setNote({
        ...noteData,
        fileUrl: response.data.url || noteData?.fileUrl
      })
      if (noteData?._id) {
        const [verRes, colRes] = await Promise.all([
          notesAPI.versions(noteData._id).catch(() => ({ data: { versions: [] } })),
          collectionsAPI.list().catch(() => ({ data: { collections: [] } }))
        ])
        setVersions(verRes.data.versions || [])
        setCollections(colRes.data.collections || [])
      }
    } catch (err) {
      setError('Failed to fetch note details')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleLike = async () => {
    if (!note?._id || busy) return
    setBusy(true)
    try {
      const res = await notesAPI.toggleLike(note._id)
      setNote((prev) => ({
        ...prev,
        likedByMe: res.data.liked,
        likeCount: res.data.likeCount
      }))
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to update upvote')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!note?._id || busy) return
    setBusy(true)
    try {
      const res = await notesAPI.toggleFavorite(note._id)
      setNote((prev) => ({
        ...prev,
        favoritedByMe: res.data.favorited
      }))
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to update favorite')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!note?.isOwner) {
      alert('Only the uploader can delete this note.')
      return
    }
    if (!window.confirm('Delete this note?')) return
    if (!note?._id) return
    try {
      await notesAPI.deleteNote([note._id])
      navigate('/my-uploads')
    } catch (err) {
      alert('Failed to delete note: ' + (err.response?.data?.msg || err.message))
      console.error(err)
    }
  }

  const handleReport = async () => {
    if (!note?._id) return
    const reason = window.prompt('Why are you reporting this note? (spam, wrong content, etc.)')
    if (!reason || reason.trim().length < 3) return
    setBusy(true)
    setModMsg('')
    try {
      const res = await adminAPI.createReport({
        targetType: 'note',
        targetId: note._id,
        reason: reason.trim()
      })
      setModMsg(res.data.msg || 'Report submitted.')
    } catch (err) {
      setModMsg(err.response?.data?.msg || 'Could not submit report')
    } finally {
      setBusy(false)
    }
  }

  const handleStaffVerify = async (unverify = false) => {
    if (!note?._id || !isStaff) return
    setBusy(true)
    setModMsg('')
    try {
      if (unverify) await adminAPI.unverifyNote(note._id)
      else await adminAPI.verifyNote(note._id)
      setNote((n) => ({ ...n, isVerified: !unverify }))
      setModMsg(unverify ? 'Verification removed.' : 'Note verified.')
    } catch (err) {
      setModMsg(err.response?.data?.msg || 'Verify action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleStaffRemove = async () => {
    if (!note?._id || !isStaff) return
    if (!window.confirm('Remove this note as moderator?')) return
    setBusy(true)
    try {
      await adminAPI.removeNote(note._id)
      navigate('/notes')
    } catch (err) {
      setModMsg(err.response?.data?.msg || 'Remove failed')
      setBusy(false)
    }
  }

  const handleAddToCollection = async () => {
    if (!note?._id || !collectionId) return
    setBusy(true)
    setCollectionMsg('')
    try {
      await collectionsAPI.addNote(collectionId, note._id)
      setCollectionMsg('Added to collection.')
    } catch (err) {
      setCollectionMsg(err.response?.data?.msg || 'Could not add to collection')
    } finally {
      setBusy(false)
    }
  }

  const openUrl = note?.fileUrl || `${IPFS_GATEWAY}${cid}`
  const previewUrl = notesAPI.previewUrl(cid)

  if (loading) {
    return (
      <div className="container page-enter">
        <AppNav onLogout={onLogout} />
        <PageSkeleton rows={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container page-enter">
        <AppNav onLogout={onLogout} />
        <div className="error" role="alert">{error}</div>
        <Link to="/notes" className="link" style={{ marginTop: '1rem', display: 'inline-block' }}>Back to notes</Link>
      </div>
    )
  }

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <div className="page-head note-detail-head">
        <div>
          <Link to="/notes" className="link">← Back to browse</Link>
          <h1 className="page-title" style={{ marginTop: '0.65rem' }}>
            {note?.isVerified ? <span className="verified-chip" title="Verified">✓ Verified</span> : null}
            {' '}
            {note?.title || 'Untitled note'}
            {note?.version ? <span className="type-chip" style={{ marginLeft: '0.5rem' }}>v{note.version}</span> : null}
          </h1>
          <p className="page-sub note-detail-kicker">
            {[note?.resourceTypeLabel || 'Notes', note?.subject, note?.branch && `Branch ${note.branch}`, note?.sem && `Sem ${note.sem}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <div className="note-detail-layout">
        <aside className="note-detail-sidebar panel">
          <h2 className="note-aside-title">Details</h2>
          <dl className="meta-list">
            <div><dt>Uploader</dt><dd>{note?.uploader ? <Link to={`/u/${note.uploader}`} className="link">@{note.uploader}</Link> : '@Anonymous'}</dd></div>
            <div><dt>Quality</dt><dd>{note?.qualityScore ?? 0}/100</dd></div>
            <div><dt>Views</dt><dd>{note?.viewCount || 0}</dd></div>
            <div><dt>Opens</dt><dd>{note?.downloadCount || 0}</dd></div>
            <div><dt>Saves</dt><dd>{note?.favoriteCount || 0}</dd></div>
            <div><dt>Shares</dt><dd>{note?.shareCount || 0}</dd></div>
            <div><dt>Version</dt><dd>v{note?.version || 1}{note?.isLatest ? ' (latest)' : ''}</dd></div>
            {note?.college ? <div><dt>College</dt><dd>{note.college}</dd></div> : null}
            {note?.university ? <div><dt>University</dt><dd>{note.university}</dd></div> : null}
            {note?.examYear ? <div><dt>Year</dt><dd>{note.examYear}</dd></div> : null}
            {note?.examType ? <div><dt>Exam</dt><dd>{note.examType}</dd></div> : null}
          </dl>
          <p className="cid-chip" style={{ marginTop: '0.75rem', wordBreak: 'break-all' }}>{cid}</p>
          {Array.isArray(note?.tags) && note.tags.length > 0 && (
            <p className="tag-row" style={{ marginTop: '0.75rem' }}>
              {note.tags.map((t) => `#${t}`).join(' ')}
            </p>
          )}
          {note?.description ? (
            <p className="note-description" style={{ marginTop: '0.85rem' }}>{note.description}</p>
          ) : null}
          {note?.changelog ? (
            <p className="auth-hint" style={{ marginTop: '0.65rem' }}>Changes: {note.changelog}</p>
          ) : null}
        </aside>

        <div className="note-detail-main">
          <section className="panel note-action-bar" aria-label="Note actions">
            <div className="action-row note-view-actions" style={{ alignItems: 'center' }}>
              <button
                type="button"
                className={`chip-btn chip-upvote chip-lg ${note?.likedByMe ? 'is-active' : ''}`}
                onClick={handleToggleLike}
                disabled={busy}
                aria-pressed={Boolean(note?.likedByMe)}
              >
                <span className="chip-icon" aria-hidden="true">{note?.likedByMe ? '▲' : '△'}</span>
                <span className="chip-label">{note?.likedByMe ? 'Upvoted' : 'Upvote'} · {note?.likeCount || 0}</span>
              </button>
              <button
                type="button"
                className={`chip-btn chip-save chip-lg ${note?.favoritedByMe ? 'is-active' : ''}`}
                onClick={handleToggleFavorite}
                disabled={busy}
                aria-pressed={Boolean(note?.favoritedByMe)}
              >
                <span className="chip-icon" aria-hidden="true">{note?.favoritedByMe ? '★' : '☆'}</span>
                <span className="chip-label">{note?.favoritedByMe ? 'Saved' : 'Save'}</span>
              </button>
              <a className="btn btn-inline btn-secondary" href={openUrl} target="_blank" rel="noopener noreferrer">
                Open on IPFS
              </a>
              <button
                type="button"
                className="btn btn-secondary btn-inline"
                onClick={async () => {
                  const url = `${window.location.origin}/note/${cid}`
                  try {
                    await navigator.clipboard.writeText(url)
                    setShareMsg('Note link copied')
                  } catch {
                    setShareMsg(url)
                  }
                  if (note?._id) {
                    try {
                      const res = await notesAPI.recordShare(note._id)
                      const count = res.data.shareCount
                      if (typeof count === 'number') {
                        setNote((n) => ({ ...n, shareCount: count }))
                      }
                    } catch {
                      /* non-blocking */
                    }
                  }
                }}
              >
                Copy link
              </button>
              {note?.isOwner && (
                <Link className="btn btn-inline" to={`/upload?versionOf=${note._id}`}>
                  Upload new version
                </Link>
              )}
              {note?.isOwner && (
                <button type="button" onClick={handleDelete} className="btn btn-danger btn-inline">
                  Delete note
                </button>
              )}
              {!note?.isOwner && (
                <button type="button" className="btn btn-secondary btn-inline" disabled={busy} onClick={handleReport}>
                  Report
                </button>
              )}
              {isStaff && (
                <>
                  {!note?.isVerified ? (
                    <button type="button" className="btn btn-inline" disabled={busy} onClick={() => handleStaffVerify(false)}>
                      Verify
                    </button>
                  ) : (
                    <button type="button" className="btn btn-secondary btn-inline" disabled={busy} onClick={() => handleStaffVerify(true)}>
                      Unverify
                    </button>
                  )}
                  <button type="button" className="btn btn-danger btn-inline" disabled={busy} onClick={handleStaffRemove}>
                    Staff remove
                  </button>
                </>
              )}
            </div>
            {modMsg && <p className="page-sub" role="status" style={{ marginTop: '0.65rem' }}>{modMsg}</p>}
            {shareMsg && <p className="page-sub" role="status">{shareMsg}</p>}

            <div className="collection-add-row">
              <select
                aria-label="Add to collection"
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
              >
                <option value="">Add to collection…</option>
                {collections.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              <button type="button" className="btn btn-secondary btn-inline" disabled={!collectionId || busy} onClick={handleAddToCollection}>
                Add
              </button>
              {collections.length === 0 && (
                <Link to="/collections" className="link">Create a collection</Link>
              )}
            </div>
            {collectionMsg && <p className="page-sub" role="status">{collectionMsg}</p>}
          </section>

          <section className="panel note-preview-panel">
            <div className="note-preview-head">
              <h2 className="home-section-title" style={{ marginTop: 0 }}>Preview</h2>
              <p className="page-sub">If the preview stays blank, use Open on IPFS.</p>
            </div>
            <iframe
              title={`Preview ${note?.title || 'note'}`}
              src={previewUrl}
              className="preview-frame preview-frame-premium"
            />
          </section>
        </div>
      </div>

      {note?._id && <AiPanel noteId={note._id} noteTitle={note.title} />}

      {note?._id && <CommentSection noteId={note._id} />}

      {versions.length > 1 && (
        <section className="panel" style={{ marginTop: '1rem' }}>
          <h2 className="home-section-title" style={{ marginTop: 0 }}>Versions</h2>
          <ul className="version-list">
            {versions.map((v) => (
              <li key={v._id} className={v.cid === cid ? 'is-current' : ''}>
                <Link to={`/note/${v.cid}`}>
                  v{v.version}{v.isLatest ? ' · latest' : ''} — {v.title}
                </Link>
                {v.changelog ? <span className="page-sub"> · {v.changelog}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default NoteView
