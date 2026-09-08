import { Link, useNavigate } from 'react-router-dom'

export function NoteCard({
  note,
  onOpen,
  onToggleLike,
  onToggleFavorite,
  showOwnerActions = false,
  onDelete
}) {
  const navigate = useNavigate()
  const open = () => {
    if (onOpen) onOpen(note)
    else navigate(`/note/${note.cid}`)
  }

  return (
    <article className="note-card">
      <button type="button" className="note-card-main" onClick={open}>
        <div className="note-card-topline">
          <span className="type-chip">{note.resourceTypeLabel || 'Notes'}</span>
          {note.isVerified ? <span className="verified-chip" title="Verified">✓ Verified</span> : null}
        </div>
        <h3>{note.title || 'Untitled'}</h3>
        <p><strong>Subject:</strong> {note.subject || 'N/A'}</p>
        <p><strong>Branch:</strong> {note.branch || 'N/A'}</p>
        <p><strong>Semester:</strong> {note.sem || 'N/A'}</p>
        <p>
          <strong>Uploader:</strong>{' '}
          {note.uploader ? (
            <Link
              to={`/u/${note.uploader}`}
              className="link"
              onClick={(e) => e.stopPropagation()}
            >
              @{note.uploader}
            </Link>
          ) : (
            '@anon'
          )}
        </p>
        <p className="note-card-stats">
          Quality {note.qualityScore ?? 0}/100 · {note.viewCount || 0} views · {note.downloadCount || 0} opens · {note.likeCount || 0} upvotes
        </p>
        {Array.isArray(note.tags) && note.tags.length > 0 && (
          <p className="tag-row">{note.tags.slice(0, 4).map((t) => `#${t}`).join(' ')}</p>
        )}
        <span className="cid-chip">{note.cid?.substring(0, 18)}…</span>
      </button>
      <div className="note-card-actions">
        <button
          type="button"
          className={`chip-btn chip-upvote ${note.likedByMe ? 'is-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleLike?.(note)
          }}
          aria-pressed={Boolean(note.likedByMe)}
          title={note.likedByMe ? 'Remove upvote' : 'Upvote'}
        >
          <span className="chip-icon" aria-hidden="true">{note.likedByMe ? '▲' : '△'}</span>
          <span className="chip-label">{note.likeCount || 0}</span>
        </button>
        <button
          type="button"
          className={`chip-btn chip-save ${note.favoritedByMe ? 'is-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite?.(note)
          }}
          aria-pressed={Boolean(note.favoritedByMe)}
          title={note.favoritedByMe ? 'Remove bookmark' : 'Save to favorites'}
        >
          <span className="chip-icon" aria-hidden="true">{note.favoritedByMe ? '★' : '☆'}</span>
          <span className="chip-label">{note.favoritedByMe ? 'Saved' : 'Save'}</span>
        </button>
        {showOwnerActions && note.isOwner && (
          <button
            type="button"
            className="chip-btn chip-danger"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(note)
            }}
          >
            Delete
          </button>
        )}
      </div>
    </article>
  )
}

export function Pagination({ page, totalPages, total, onPageChange }) {
  if (!totalPages || totalPages <= 1) {
    return total != null ? (
      <p className="page-sub pagination-meta">{total} note{total === 1 ? '' : 's'}</p>
    ) : null
  }

  return (
    <div className="pagination">
      <button
        type="button"
        className="btn btn-secondary btn-inline"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span className="pagination-meta">
        Page {page} of {totalPages} · {total} total
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-inline"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  )
}

export function EmptyNotes({ title, actionTo, actionLabel }) {
  return (
    <div className="empty-state">
      <p>{title}</p>
      {actionTo && (
        <Link to={actionTo} className="btn btn-inline" style={{ marginTop: '1rem' }}>
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
