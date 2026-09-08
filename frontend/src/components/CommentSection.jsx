import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminAPI, communityAPI } from '../api'

function CommentItem({ comment, onReply, onDelete, onReport, canModerate, depth = 0 }) {
  return (
    <li className={`comment-item depth-${Math.min(depth, 3)}`}>
      <div className="comment-head">
        <Link to={`/u/${comment.authorUsername}`} className="link">@{comment.authorUsername}</Link>
        <span className="page-sub">{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}</span>
      </div>
      <p className="comment-body">{comment.body}</p>
      {!comment.deleted && (
        <div className="comment-actions">
          {depth < 2 && (
            <button type="button" className="link-btn" onClick={() => onReply(comment)}>Reply</button>
          )}
          {(comment.isOwner || canModerate) && (
            <button type="button" className="link-btn danger" onClick={() => onDelete(comment)}>Delete</button>
          )}
          {!comment.isOwner && (
            <button type="button" className="link-btn" onClick={() => onReport(comment)}>Report</button>
          )}
        </div>
      )}
      {Array.isArray(comment.replies) && comment.replies.length > 0 && (
        <ul className="comment-replies">
          {comment.replies.map((r) => (
            <CommentItem
              key={r._id}
              comment={r}
              onReply={onReply}
              onDelete={onDelete}
              onReport={onReport}
              canModerate={canModerate}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function CommentSection({ noteId }) {
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const role = localStorage.getItem('role') || 'student'
  const canModerate = role === 'moderator' || role === 'admin'

  const load = async () => {
    if (!noteId) return
    setLoading(true)
    try {
      const res = await communityAPI.listComments(noteId)
      setComments(res.data.comments || [])
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  const submit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    setError('')
    try {
      await communityAPI.addComment(noteId, {
        body: body.trim(),
        parentId: replyTo?._id || undefined
      })
      setBody('')
      setReplyTo(null)
      await load()
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not post comment')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (comment) => {
    if (!window.confirm('Delete this comment?')) return
    try {
      await communityAPI.deleteComment(comment._id)
      await load()
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not delete comment')
    }
  }

  const handleReport = async (comment) => {
    const reason = window.prompt('Why are you reporting this comment?')
    if (!reason || reason.trim().length < 3) return
    try {
      const res = await adminAPI.createReport({
        targetType: 'comment',
        targetId: comment._id,
        reason: reason.trim()
      })
      setError('')
      window.alert(res.data.msg || 'Report submitted.')
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not submit report')
    }
  }

  return (
    <section className="panel comments-panel">
      <h2 className="home-section-title" style={{ marginTop: 0 }}>Comments</h2>
      <form onSubmit={submit} className="comment-form">
        {replyTo && (
          <p className="page-sub">
            Replying to @{replyTo.authorUsername}{' '}
            <button type="button" className="link-btn" onClick={() => setReplyTo(null)}>Cancel</button>
          </p>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share feedback or ask a question…"
          rows={3}
          maxLength={2000}
          required
        />
        <button type="submit" className="btn btn-inline" disabled={busy}>
          {busy ? 'Posting…' : 'Post comment'}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <p className="loading">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="page-sub">No comments yet. Start the discussion.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <CommentItem
              key={c._id}
              comment={c}
              onReply={setReplyTo}
              onDelete={handleDelete}
              onReport={handleReport}
              canModerate={canModerate}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

export default CommentSection
