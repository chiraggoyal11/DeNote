export function Skeleton({ className = '', style }) {
  return <span className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />
}

export function NoteCardSkeleton() {
  return (
    <article className="note-card note-card-skeleton" aria-hidden="true">
      <div className="note-card-main" style={{ pointerEvents: 'none' }}>
        <Skeleton className="skeleton-line" style={{ width: '30%', height: 14 }} />
        <Skeleton className="skeleton-line" style={{ width: '78%', height: 22, marginTop: 12 }} />
        <Skeleton className="skeleton-line" style={{ width: '55%', marginTop: 14 }} />
        <Skeleton className="skeleton-line" style={{ width: '48%', marginTop: 8 }} />
        <Skeleton className="skeleton-line" style={{ width: '40%', marginTop: 8 }} />
        <Skeleton className="skeleton-line" style={{ width: '62%', marginTop: 16 }} />
      </div>
    </article>
  )
}

export function NotesGridSkeleton({ count = 6 }) {
  return (
    <div className="notes-grid" aria-busy="true" aria-label="Loading notes">
      {Array.from({ length: count }).map((_, i) => (
        <NoteCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function PageSkeleton({ rows = 4 }) {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label="Loading">
      <Skeleton className="skeleton-line" style={{ width: '42%', height: 28 }} />
      <Skeleton className="skeleton-line" style={{ width: '68%', marginTop: 12 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="skeleton-block" style={{ marginTop: 16 }} />
      ))}
    </div>
  )
}

export default Skeleton
