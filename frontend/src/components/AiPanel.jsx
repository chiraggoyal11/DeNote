import { useEffect, useState } from 'react'
import { aiAPI } from '../api'

function documentHint(doc) {
  if (!doc) return null
  if (doc.source === 'pdf' || doc.source === 'sparse_pdf') {
    const pages = doc.pageCount ? `${doc.pageCount} page${doc.pageCount === 1 ? '' : 's'}` : 'PDF'
    const chars = doc.chars || doc.usedChars
    return `Source: ${pages}${chars ? ` · ${chars.toLocaleString()} characters extracted` : ''}`
  }
  if (doc.error) return `PDF text unavailable (${doc.error}) — used note metadata instead`
  return null
}

function AiPanel({ noteId, noteTitle }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)

  useEffect(() => {
    let cancelled = false
    aiAPI.status()
      .then((res) => { if (!cancelled) setStatus(res.data.ai) })
      .catch(() => { if (!cancelled) setStatus({ enabled: false, mode: 'unknown' }) })
    return () => { cancelled = true }
  }, [])

  if (!noteId) return null

  const disabled = status && !status.enabled

  const run = async (label, fn) => {
    setBusy(true)
    setBusyLabel(label)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err.response?.data?.msg || 'AI request failed')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  return (
    <section className="panel ai-panel" style={{ marginTop: '1rem' }}>
      <h2 className="home-section-title" style={{ marginTop: 0 }}>Note AI</h2>
      <p className="page-sub">
        Optional assistant for “{noteTitle || 'this note'}”. Reads the PDF text from IPFS when possible.{' '}
        {status
          ? (status.enabled
            ? `On · provider ${status.provider || status.mode}`
            : 'Off — set AI_ENABLED=true on the server to enable.')
          : 'Checking…'}
      </p>

      {disabled ? (
        <p className="page-sub">AI stays disabled by default on the free tier so deploys cost $0.</p>
      ) : (
        <>
          <div className="action-row" style={{ flexWrap: 'wrap', gap: '0.45rem' }}>
            <button
              type="button"
              className="btn btn-inline"
              disabled={busy}
              onClick={() => run('Reading PDF & summarizing…', async () => {
                const res = await aiAPI.summarize(noteId)
                setSummary(res.data)
              })}
            >
              Summarize
            </button>
          </div>

          {busy && busyLabel && (
            <p className="page-sub" style={{ marginTop: '0.65rem' }}>{busyLabel}</p>
          )}

          <form
            className="ai-form"
            style={{ marginTop: '0.85rem' }}
            onSubmit={(e) => {
              e.preventDefault()
              run('Reading PDF & answering…', async () => {
                const res = await aiAPI.assist(noteId, question.trim())
                setAnswer(res.data)
              })
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about this document…"
              maxLength={500}
            />
            <button type="submit" className="btn btn-inline" disabled={busy || !question.trim()}>
              Ask assistant
            </button>
          </form>
        </>
      )}

      {error && <div className="error" style={{ marginTop: '0.75rem' }}>{error}</div>}

      {summary && (
        <div className="ai-result">
          <h3>Summary</h3>
          <p>{summary.summary}</p>
          {Array.isArray(summary.bullets) && summary.bullets.length > 0 && (
            <ul>{summary.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
          )}
          <p className="page-sub">
            {documentHint(summary.document) || `method: ${summary.method}`}
            {summary.method ? ` · ${summary.method}` : ''}
          </p>
        </div>
      )}

      {answer && (
        <div className="ai-result">
          <h3>Assistant</h3>
          <p>{answer.answer}</p>
          <p className="page-sub">
            {documentHint(answer.document)}
            {answer.method ? `${documentHint(answer.document) ? ' · ' : ''}${answer.method}` : ''}
          </p>
        </div>
      )}
    </section>
  )
}

export default AiPanel
