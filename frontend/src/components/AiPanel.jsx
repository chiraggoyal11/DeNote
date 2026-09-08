import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { aiAPI } from '../api'

function AiPanel({ noteId, noteTitle }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [cards, setCards] = useState(null)
  const [savedDeck, setSavedDeck] = useState(null)

  useEffect(() => {
    let cancelled = false
    aiAPI.status()
      .then((res) => { if (!cancelled) setStatus(res.data.ai) })
      .catch(() => { if (!cancelled) setStatus({ enabled: false, mode: 'unknown' }) })
    return () => { cancelled = true }
  }, [])

  if (!noteId) return null

  const disabled = status && !status.enabled

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err.response?.data?.msg || 'AI request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel ai-panel" style={{ marginTop: '1rem' }}>
      <h2 className="home-section-title" style={{ marginTop: 0 }}>Study AI</h2>
      <p className="page-sub">
        Optional assistant for “{noteTitle || 'this note'}”.{' '}
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
              onClick={() => run(async () => {
                const res = await aiAPI.summarize(noteId)
                setSummary(res.data)
              })}
            >
              Summarize
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-inline"
              disabled={busy}
              onClick={() => run(async () => {
                const res = await aiAPI.generateQuiz(noteId, 5)
                setQuiz(res.data)
              })}
            >
              Generate quiz
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-inline"
              disabled={busy}
              onClick={() => run(async () => {
                const res = await aiAPI.generateFlashcards(noteId, { count: 6, saveToDeck: true })
                setCards(res.data)
                setSavedDeck(res.data.savedDeck || null)
              })}
            >
              Flashcards → Study deck
            </button>
          </div>

          <form
            className="study-form"
            style={{ marginTop: '0.85rem' }}
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                const res = await aiAPI.assist(noteId, question.trim())
                setAnswer(res.data)
              })
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about this note…"
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
          <p className="page-sub">method: {summary.method}</p>
        </div>
      )}

      {answer && (
        <div className="ai-result">
          <h3>Assistant</h3>
          <p>{answer.answer}</p>
          <p className="page-sub">method: {answer.method}</p>
        </div>
      )}

      {quiz?.questions && (
        <div className="ai-result">
          <h3>Generated quiz</h3>
          <ul className="admin-simple-list">
            {quiz.questions.map((q) => (
              <li key={q.id || q.prompt}>
                <strong>{q.prompt}</strong>
                <div className="page-sub">{q.answer}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cards?.cards && (
        <div className="ai-result">
          <h3>Generated flashcards</h3>
          {savedDeck && (
            <p className="page-sub">
              Saved as deck “{savedDeck.title}” ({savedDeck.cardCount} cards).{' '}
              <Link to="/study" className="link">Open Study</Link>
            </p>
          )}
          <ul className="admin-simple-list">
            {cards.cards.map((c) => (
              <li key={c.front}>
                <strong>{c.front}</strong>
                <div className="page-sub">{c.back}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default AiPanel
