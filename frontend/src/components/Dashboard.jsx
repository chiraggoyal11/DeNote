import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { authAPI } from '../api'
import AppNav from './AppNav'

function Dashboard({ onLogout }) {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('username')
    return { username: cached || 'User' }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      const response = await authAPI.getProfile()
      if (response.data?.user) {
        setUser(response.data.user)
        if (response.data.user.username) {
          localStorage.setItem('username', response.data.user.username)
        }
        if (response.data.user.displayName) {
          localStorage.setItem('displayName', response.data.user.displayName)
        }
        if (response.data.user.picture) {
          localStorage.setItem('userPicture', response.data.user.picture)
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !user?.username) {
    return (
      <div className="container">
        <div className="loading">Loading…</div>
      </div>
    )
  }

  const greetName = user?.displayName || user?.username || 'there'

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-brand">DeNote</p>
          <h1 className="home-headline">Academic notes that stay online</h1>
          <p className="home-lead">
            Welcome, {greetName}. Share coursework on IPFS, browse what classmates upload,
            and keep useful PDFs easy to find.
          </p>
          <div className="home-cta-row">
            <Link to="/notes" className="btn btn-inline">Browse notes</Link>
            <Link to="/upload" className="btn btn-secondary btn-inline">Upload a note</Link>
          </div>
        </div>
        <div className="home-hero-visual" aria-hidden="true">
          <div className="home-orb home-orb-a" />
          <div className="home-orb home-orb-b" />
          <div className="home-stack">
            <div className="home-sheet home-sheet-1">
              <span className="home-sheet-label">IPFS</span>
              <span className="home-sheet-title">Lecture notes</span>
              <span className="home-sheet-meta">Pinned · Shared · Searchable</span>
            </div>
            <div className="home-sheet home-sheet-2">
              <span className="home-sheet-label">PDF</span>
              <span className="home-sheet-title">Course pack</span>
            </div>
            <div className="home-sheet home-sheet-3">
              <span className="home-sheet-label">CID</span>
              <span className="home-sheet-title">Qm…preview</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-section-delay-1">
        <h2 className="home-section-title">How DeNote works</h2>
        <p className="home-section-lead">Three simple steps from your desk to the network.</p>
        <ol className="home-steps">
          <li>
            <span className="home-step-num">1</span>
            <div>
              <h3>Upload</h3>
              <p>Add a PDF with branch, semester, and subject so others can find it.</p>
            </div>
          </li>
          <li>
            <span className="home-step-num">2</span>
            <div>
              <h3>Pin to IPFS</h3>
              <p>DeNote stores the file on IPFS through Pinata, so it is not tied to one server.</p>
            </div>
          </li>
          <li>
            <span className="home-step-num">3</span>
            <div>
              <h3>Browse & open</h3>
              <p>Filter notes, preview in the app, or open the file on a public IPFS gateway.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="home-section home-section-delay-2">
        <h2 className="home-section-title">What you can do here</h2>
        <p className="home-section-lead">Everything you need for sharing and discovering notes.</p>
        <ul className="home-feature-list">
          <li>
            <strong>Upload PDFs</strong>
            <span>Pin coursework with clear metadata for your class.</span>
          </li>
          <li>
            <strong>Browse & filter</strong>
            <span>Search by branch, semester, or subject in seconds.</span>
          </li>
          <li>
            <strong>Preview notes</strong>
            <span>Open a note page with details, upvotes, and an in-app preview.</span>
          </li>
          <li>
            <strong>Upvote quality</strong>
            <span>Help classmates spot the most useful material.</span>
          </li>
          <li>
            <strong>Secure sign-in</strong>
            <span>Use username & password or Google, with profile controls.</span>
          </li>
          <li>
            <strong>Own your account</strong>
            <span>Manage profile details or schedule account deletion anytime.</span>
          </li>
        </ul>
      </section>

      <section className="home-section home-section-delay-3">
        <h2 className="home-section-title">Why IPFS</h2>
        <p className="home-why-copy">
          Traditional file links break when a host goes down. IPFS addresses content by hash,
          so notes stay reachable through the network even when a single machine fails.
          DeNote keeps the metadata in MongoDB and the files on IPFS—durable storage with a
          simple browsing experience.
        </p>
        <div className="home-cta-row home-cta-row-end">
          <Link to="/notes" className="btn btn-inline">Start browsing</Link>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
