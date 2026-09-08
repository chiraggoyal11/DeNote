import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { studyAPI } from '../api'
import AppNav from './AppNav'
import OfflineBanner from './OfflineBanner'
import {
  cacheKeyStudyDecks,
  cacheKeyStudyProgress,
  withOfflineCache
} from '../utils/offlineCache'

const TABS = ['progress', 'planner', 'decks', 'review', 'quiz']

function Study({ onLogout }) {
  const [tab, setTab] = useState('progress')
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [plan, setPlan] = useState([])
  const [decks, setDecks] = useState([])
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [deckDetail, setDeckDetail] = useState(null)
  const [reviewCards, setReviewCards] = useState([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [quiz, setQuiz] = useState(null)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState([])
  const [quizReveal, setQuizReveal] = useState(false)
  const [quizResult, setQuizResult] = useState(null)

  const [planForm, setPlanForm] = useState({ title: '', subject: '', dueAt: '', notes: '' })
  const [deckForm, setDeckForm] = useState({ title: '', subject: '', description: '' })
  const [cardForm, setCardForm] = useState({ front: '', back: '', subject: '' })

  const loadProgress = async () => {
    const { data, fromCache: cached } = await withOfflineCache(
      cacheKeyStudyProgress(),
      () => studyAPI.progress()
    )
    setProgress(data.progress)
    return cached
  }
  const loadPlan = async () => {
    const res = await studyAPI.plan()
    setPlan(res.data.items || [])
  }
  const loadDecks = async () => {
    const { data, fromCache: cached } = await withOfflineCache(
      cacheKeyStudyDecks(),
      () => studyAPI.decks()
    )
    setDecks(data.decks || [])
    return cached
  }
  const loadDeckDetail = async (id) => {
    if (!id) {
      setDeckDetail(null)
      return
    }
    const res = await studyAPI.getDeck(id)
    setDeckDetail(res.data)
  }
  const loadReview = async (deckId) => {
    const res = await studyAPI.review({ limit: 20, deckId: deckId || undefined })
    setReviewCards(res.data.cards || [])
    setReviewIndex(0)
    setFlipped(false)
  }

  const refresh = async () => {
    setError('')
    setFromCache(false)
    try {
      const [progressCached, , decksCached] = await Promise.all([
        loadProgress(),
        loadPlan().catch(() => {
          setPlan([])
        }),
        loadDecks()
      ])
      setFromCache(Boolean(progressCached || decksCached))
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load study data')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (tab === 'review') loadReview(selectedDeckId).catch((err) => setError(err.response?.data?.msg || 'Review load failed'))
    if (tab === 'decks' && selectedDeckId) loadDeckDetail(selectedDeckId).catch((err) => setError(err.response?.data?.msg || 'Deck load failed'))
  }, [tab, selectedDeckId])

  const currentReview = reviewCards[reviewIndex] || null
  const currentQuizQ = quiz?.questions?.[quizIndex] || null

  const dueDecks = useMemo(() => decks.filter((d) => (d.dueCount || 0) > 0), [decks])

  const createPlan = async (e) => {
    e.preventDefault()
    if (!planForm.title.trim()) return
    setBusy(true)
    try {
      await studyAPI.createPlan({
        title: planForm.title.trim(),
        subject: planForm.subject.trim(),
        notes: planForm.notes.trim(),
        dueAt: planForm.dueAt || undefined
      })
      setPlanForm({ title: '', subject: '', dueAt: '', notes: '' })
      await loadPlan()
      await loadProgress()
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not create plan item')
    } finally {
      setBusy(false)
    }
  }

  const setPlanStatus = async (id, status) => {
    setBusy(true)
    try {
      await studyAPI.updatePlan(id, { status })
      await loadPlan()
      await loadProgress()
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not update plan')
    } finally {
      setBusy(false)
    }
  }

  const createDeck = async (e) => {
    e.preventDefault()
    if (!deckForm.title.trim()) return
    setBusy(true)
    try {
      const res = await studyAPI.createDeck({
        title: deckForm.title.trim(),
        subject: deckForm.subject.trim(),
        description: deckForm.description.trim()
      })
      setDeckForm({ title: '', subject: '', description: '' })
      await loadDecks()
      setSelectedDeckId(res.data.deck._id)
      setTab('decks')
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not create deck')
    } finally {
      setBusy(false)
    }
  }

  const addCard = async (e) => {
    e.preventDefault()
    if (!selectedDeckId || !cardForm.front.trim() || !cardForm.back.trim()) return
    setBusy(true)
    try {
      await studyAPI.addCard(selectedDeckId, {
        front: cardForm.front.trim(),
        back: cardForm.back.trim(),
        subject: cardForm.subject.trim() || undefined
      })
      setCardForm({ front: '', back: '', subject: '' })
      await loadDeckDetail(selectedDeckId)
      await loadDecks()
      await loadProgress()
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not add card')
    } finally {
      setBusy(false)
    }
  }

  const gradeReview = async (quality) => {
    if (!currentReview) return
    setBusy(true)
    try {
      await studyAPI.reviewCard(currentReview._id, quality)
      const next = reviewCards.slice()
      next.splice(reviewIndex, 1)
      setReviewCards(next)
      setFlipped(false)
      if (reviewIndex >= next.length) setReviewIndex(Math.max(0, next.length - 1))
      await loadProgress()
      await loadDecks()
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not save review')
    } finally {
      setBusy(false)
    }
  }

  const startQuiz = async (deckIdArg) => {
    const deckId = deckIdArg || selectedDeckId
    if (!deckId) {
      setError('Pick a deck first.')
      return
    }
    setSelectedDeckId(deckId)
    setBusy(true)
    setQuizResult(null)
    try {
      const res = await studyAPI.startQuiz(deckId, { limit: 8 })
      setQuiz(res.data)
      setQuizIndex(0)
      setQuizAnswers([])
      setQuizReveal(false)
      setTab('quiz')
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not start quiz')
    } finally {
      setBusy(false)
    }
  }

  const markQuizAnswer = (correct) => {
    if (!currentQuizQ) return
    const nextAnswers = [
      ...quizAnswers.filter((a) => a.cardId !== currentQuizQ.cardId),
      { cardId: currentQuizQ.cardId, correct }
    ]
    setQuizAnswers(nextAnswers)
    setQuizReveal(false)
    if (quizIndex + 1 < (quiz.questions?.length || 0)) {
      setQuizIndex(quizIndex + 1)
    } else {
      submitQuiz(nextAnswers)
    }
  }

  const submitQuiz = async (answers) => {
    setBusy(true)
    try {
      const res = await studyAPI.submitQuiz(selectedDeckId, answers)
      setQuizResult(res.data.attempt)
      setQuiz(null)
      await loadProgress()
      await loadDecks()
    } catch (err) {
      setError(err.response?.data?.msg || 'Could not submit quiz')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />
      <OfflineBanner fromCache={fromCache} scope="stale" />

      <section className="page-head">
        <div>
          <h1 className="page-title">Study</h1>
          <p className="page-sub">
            Planner, flashcards, spaced repetition, quizzes, and weak-topic tracking — all local to your account.
          </p>
        </div>
      </section>

      <div className="admin-tabs study-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`btn btn-inline ${tab === t ? '' : 'btn-secondary'}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      {tab === 'progress' && progress && (
        <>
          <div className="admin-stat-grid">
            <div className="admin-stat"><strong>{progress.deckCount}</strong><span>Decks</span></div>
            <div className="admin-stat"><strong>{progress.cardCount}</strong><span>Cards</span></div>
            <div className="admin-stat"><strong>{progress.dueCount}</strong><span>Due now</span></div>
            <div className="admin-stat"><strong>{progress.accuracy}%</strong><span>Review accuracy</span></div>
            <div className="admin-stat"><strong>{progress.planTodo}</strong><span>Plan open</span></div>
            <div className="admin-stat"><strong>{progress.planDone}</strong><span>Plan done</span></div>
          </div>

          <section className="panel" style={{ marginTop: '1rem' }}>
            <h2 className="home-section-title" style={{ marginTop: 0 }}>Weak topics</h2>
            {(progress.weakTopics || []).length === 0 ? (
              <p className="page-sub">Review or quiz a few cards to surface topics that need more practice.</p>
            ) : (
              <ul className="admin-simple-list">
                {progress.weakTopics.map((w) => (
                  <li key={`${w.subject}-${w.source}`}>
                    <strong>{w.subject || 'General'}</strong>
                    <div className="page-sub">{w.accuracy}% accuracy · {w.samples} samples · via {w.source}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" style={{ marginTop: '1rem' }}>
            <h2 className="home-section-title" style={{ marginTop: 0 }}>Recent quizzes</h2>
            {(progress.recentQuizzes || []).length === 0 ? (
              <p className="page-sub">No quizzes yet. Create a deck and start one from the quiz tab.</p>
            ) : (
              <ul className="admin-simple-list">
                {progress.recentQuizzes.map((q) => (
                  <li key={q._id}>
                    {q.scorePercent}% · {q.correct}/{q.total}
                    {q.subject ? ` · ${q.subject}` : ''}
                    <div className="page-sub">{q.createdAt ? new Date(q.createdAt).toLocaleString() : ''}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {dueDecks.length > 0 && (
            <p className="page-sub" style={{ marginTop: '1rem' }}>
              {dueDecks.reduce((s, d) => s + (d.dueCount || 0), 0)} cards due across {dueDecks.length} deck(s).{' '}
              <button type="button" className="link-btn" onClick={() => setTab('review')}>Start review</button>
            </p>
          )}
        </>
      )}

      {tab === 'planner' && (
        <>
          <section className="panel">
            <h2 className="home-section-title" style={{ marginTop: 0 }}>Add study block</h2>
            <form onSubmit={createPlan} className="study-form">
              <input
                value={planForm.title}
                onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                placeholder="What will you study?"
                required
              />
              <input
                value={planForm.subject}
                onChange={(e) => setPlanForm({ ...planForm, subject: e.target.value })}
                placeholder="Subject (optional)"
              />
              <input
                type="date"
                value={planForm.dueAt}
                onChange={(e) => setPlanForm({ ...planForm, dueAt: e.target.value })}
              />
              <textarea
                value={planForm.notes}
                onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
                placeholder="Notes (optional)"
                rows={2}
              />
              <button type="submit" className="btn btn-inline" disabled={busy}>Add to plan</button>
            </form>
          </section>

          <section className="panel" style={{ marginTop: '1rem' }}>
            <h2 className="home-section-title" style={{ marginTop: 0 }}>Your plan</h2>
            {plan.length === 0 ? (
              <p className="page-sub">No plan items yet.</p>
            ) : (
              <ul className="admin-simple-list">
                {plan.map((item) => (
                  <li key={item._id}>
                    <strong>{item.title}</strong>
                    <div className="page-sub">
                      {item.subject || 'General'}
                      {item.dueAt ? ` · due ${new Date(item.dueAt).toLocaleDateString()}` : ''}
                      {' · '}{item.status}
                    </div>
                    <div className="action-row" style={{ marginTop: '0.4rem', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {['todo', 'doing', 'done'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`btn btn-inline ${item.status === s ? '' : 'btn-secondary'}`}
                          disabled={busy || item.status === s}
                          onClick={() => setPlanStatus(item._id, s)}
                        >
                          {s}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn btn-danger btn-inline"
                        disabled={busy}
                        onClick={async () => {
                          await studyAPI.deletePlan(item._id)
                          await loadPlan()
                          await loadProgress()
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === 'decks' && (
        <>
          <section className="panel">
            <h2 className="home-section-title" style={{ marginTop: 0 }}>Create deck</h2>
            <form onSubmit={createDeck} className="study-form">
              <input
                value={deckForm.title}
                onChange={(e) => setDeckForm({ ...deckForm, title: e.target.value })}
                placeholder="Deck title"
                required
              />
              <input
                value={deckForm.subject}
                onChange={(e) => setDeckForm({ ...deckForm, subject: e.target.value })}
                placeholder="Subject"
              />
              <textarea
                value={deckForm.description}
                onChange={(e) => setDeckForm({ ...deckForm, description: e.target.value })}
                placeholder="Description (optional)"
                rows={2}
              />
              <button type="submit" className="btn btn-inline" disabled={busy}>Create deck</button>
            </form>
          </section>

          <section className="panel" style={{ marginTop: '1rem' }}>
            <h2 className="home-section-title" style={{ marginTop: 0 }}>Your decks</h2>
            {decks.length === 0 ? (
              <p className="page-sub">No decks yet.</p>
            ) : (
              <ul className="admin-simple-list">
                {decks.map((d) => (
                  <li key={d._id}>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setSelectedDeckId(d._id)
                        setTab('decks')
                      }}
                    >
                      {d.title}
                    </button>
                    <div className="page-sub">
                      {d.subject || 'General'} · {d.cardCount || 0} cards · {d.dueCount || 0} due
                    </div>
                    <div className="action-row" style={{ marginTop: '0.35rem', gap: '0.4rem' }}>
                      <button type="button" className="btn btn-inline btn-secondary" onClick={() => { setSelectedDeckId(d._id); setTab('review') }}>
                        Review
                      </button>
                      <button type="button" className="btn btn-inline btn-secondary" onClick={() => { setSelectedDeckId(d._id); startQuiz(d._id) }}>
                        Quiz
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-inline"
                        disabled={busy}
                        onClick={async () => {
                          if (!window.confirm('Delete this deck and its cards?')) return
                          await studyAPI.deleteDeck(d._id)
                          if (selectedDeckId === d._id) {
                            setSelectedDeckId('')
                            setDeckDetail(null)
                          }
                          await loadDecks()
                          await loadProgress()
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selectedDeckId && deckDetail && (
            <section className="panel" style={{ marginTop: '1rem' }}>
              <h2 className="home-section-title" style={{ marginTop: 0 }}>{deckDetail.deck.title}</h2>
              <p className="page-sub">{deckDetail.deck.subject || 'General'} · {(deckDetail.cards || []).length} cards</p>

              <form onSubmit={addCard} className="study-form" style={{ marginTop: '0.85rem' }}>
                <textarea
                  value={cardForm.front}
                  onChange={(e) => setCardForm({ ...cardForm, front: e.target.value })}
                  placeholder="Front (prompt)"
                  rows={2}
                  required
                />
                <textarea
                  value={cardForm.back}
                  onChange={(e) => setCardForm({ ...cardForm, back: e.target.value })}
                  placeholder="Back (answer)"
                  rows={2}
                  required
                />
                <input
                  value={cardForm.subject}
                  onChange={(e) => setCardForm({ ...cardForm, subject: e.target.value })}
                  placeholder="Card subject override (optional)"
                />
                <button type="submit" className="btn btn-inline" disabled={busy}>Add card</button>
              </form>

              <ul className="admin-simple-list" style={{ marginTop: '1rem' }}>
                {(deckDetail.cards || []).map((c) => (
                  <li key={c._id}>
                    <strong>{c.front}</strong>
                    <div className="page-sub">{c.back}</div>
                    <div className="page-sub">
                      due {c.dueAt ? new Date(c.dueAt).toLocaleDateString() : '—'} · ease {c.easeFactor} · interval {c.intervalDays}d
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === 'review' && (
        <section className="panel">
          <h2 className="home-section-title" style={{ marginTop: 0 }}>Spaced repetition</h2>
          <div className="study-form" style={{ marginBottom: '0.85rem' }}>
            <select
              aria-label="Filter review by deck"
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
            >
              <option value="">All decks</option>
              {decks.map((d) => (
                <option key={d._id} value={d._id}>{d.title} ({d.dueCount || 0} due)</option>
              ))}
            </select>
          </div>

          {!currentReview ? (
            <p className="page-sub">No cards due. Add flashcards or check back later.</p>
          ) : (
            <div className="study-card">
              <p className="page-sub">{reviewIndex + 1} of {reviewCards.length} · {currentReview.subject || 'General'}</p>
              <button type="button" className="study-flash" onClick={() => setFlipped((v) => !v)}>
                {flipped ? currentReview.back : currentReview.front}
                <span className="page-sub">{flipped ? 'Answer' : 'Prompt — tap to flip'}</span>
              </button>
              {flipped && (
                <div className="action-row" style={{ marginTop: '0.85rem', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-danger btn-inline" disabled={busy} onClick={() => gradeReview(1)}>Again</button>
                  <button type="button" className="btn btn-secondary btn-inline" disabled={busy} onClick={() => gradeReview(3)}>Hard</button>
                  <button type="button" className="btn btn-inline" disabled={busy} onClick={() => gradeReview(4)}>Good</button>
                  <button type="button" className="btn btn-inline" disabled={busy} onClick={() => gradeReview(5)}>Easy</button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {tab === 'quiz' && (
        <section className="panel">
          <h2 className="home-section-title" style={{ marginTop: 0 }}>Quiz</h2>
          <div className="study-form" style={{ marginBottom: '0.85rem' }}>
            <select
              aria-label="Quiz deck"
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
            >
              <option value="">Select a deck</option>
              {decks.map((d) => (
                <option key={d._id} value={d._id}>{d.title} ({d.cardCount || 0} cards)</option>
              ))}
            </select>
            <button type="button" className="btn btn-inline" disabled={busy || !selectedDeckId} onClick={startQuiz}>
              Start quiz
            </button>
          </div>

          {quizResult && (
            <div className="study-result">
              <p><strong>Score: {quizResult.scorePercent}%</strong> ({quizResult.correct}/{quizResult.total})</p>
              <p className="page-sub">Results feed weak-topic detection on Progress.</p>
            </div>
          )}

          {currentQuizQ && (
            <div className="study-card">
              <p className="page-sub">
                Question {quizIndex + 1} of {quiz.questions.length}
                {currentQuizQ.subject ? ` · ${currentQuizQ.subject}` : ''}
              </p>
              <div className="study-flash static">
                {currentQuizQ.front}
              </div>
              {!quizReveal ? (
                <button type="button" className="btn btn-secondary btn-inline" style={{ marginTop: '0.75rem' }} onClick={() => setQuizReveal(true)}>
                  Reveal answer
                </button>
              ) : (
                <>
                  <p className="study-answer">{quiz.answerKey?.[currentQuizQ.cardId]}</p>
                  <div className="action-row" style={{ marginTop: '0.75rem', gap: '0.45rem' }}>
                    <button type="button" className="btn btn-danger btn-inline" disabled={busy} onClick={() => markQuizAnswer(false)}>I missed it</button>
                    <button type="button" className="btn btn-inline" disabled={busy} onClick={() => markQuizAnswer(true)}>I knew it</button>
                  </div>
                </>
              )}
            </div>
          )}

          {!currentQuizQ && !quizResult && (
            <p className="page-sub">Pick a deck with cards and start a self-graded quiz.</p>
          )}
        </section>
      )}

      <p className="page-sub" style={{ marginTop: '1.25rem' }}>
        Tip: link study work to notes from <Link to="/notes" className="link">Browse</Link> after uploading coursework.
      </p>
    </div>
  )
}

export default Study
