import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { communityAPI } from '../api'
import AppNav from './AppNav'
import { NoteCard } from './NoteCard'

function PublicProfile({ onLogout }) {
  const { username } = useParams()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shareMsg, setShareMsg] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await communityAPI.getProfile(username)
      setProfile(res.data.profile)
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  const toggleFollow = async () => {
    if (!profile || profile.isSelf) return
    setBusy(true)
    try {
      if (profile.isFollowing) {
        const res = await communityAPI.unfollow(username)
        setProfile((p) => ({
          ...p,
          isFollowing: false,
          stats: { ...p.stats, followerCount: res.data.followerCount }
        }))
      } else {
        const res = await communityAPI.follow(username)
        setProfile((p) => ({
          ...p,
          isFollowing: true,
          stats: { ...p.stats, followerCount: res.data.followerCount }
        }))
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Follow action failed')
    } finally {
      setBusy(false)
    }
  }

  const copyShare = async () => {
    const url = `${window.location.origin}/u/${username}`
    try {
      await navigator.clipboard.writeText(url)
      setShareMsg('Profile link copied')
    } catch {
      setShareMsg(url)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading profile…</div>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="container page-enter">
        <AppNav onLogout={onLogout} />
        <div className="error">{error}</div>
      </div>
    )
  }

  const stats = profile?.stats || {}

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="panel profile-hero">
        <div className="profile-hero-main">
          {profile.picture ? (
            <img className="profile-hero-avatar" src={profile.picture} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="profile-hero-avatar placeholder">{(profile.displayName || '?').slice(0, 2).toUpperCase()}</div>
          )}
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{profile.displayName}</h1>
            <p className="page-sub">@{profile.username}</p>
            {profile.bio && <p>{profile.bio}</p>}
            <p className="page-sub">
              {[profile.college, profile.branch, profile.semester ? `Sem ${profile.semester}` : '']
                .filter(Boolean)
                .join(' · ') || 'No academic details yet'}
            </p>
          </div>
        </div>

        <div className="profile-stat-row">
          <span><strong>{stats.uploadCount || 0}</strong> uploads</span>
          <span><strong>{stats.followerCount || 0}</strong> followers</span>
          <span><strong>{stats.followingCount || 0}</strong> following</span>
          <span><strong>{stats.likeReceived || 0}</strong> upvotes</span>
        </div>

        <div className="action-row" style={{ marginTop: '1rem', flexWrap: 'wrap', gap: '0.55rem' }}>
          {!profile.isSelf && (
            <button type="button" className="btn btn-inline" disabled={busy} onClick={toggleFollow}>
              {profile.isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
          {profile.isSelf && (
            <Link to="/profile" className="btn btn-secondary btn-inline">Edit profile</Link>
          )}
          <button type="button" className="btn btn-secondary btn-inline" onClick={copyShare}>Copy profile link</button>
        </div>
        {shareMsg && <p className="page-sub">{shareMsg}</p>}
        {error && <div className="error">{error}</div>}
      </section>

      {Array.isArray(profile.badges) && profile.badges.length > 0 && (
        <section className="panel" style={{ marginTop: '1rem' }}>
          <h2 className="home-section-title" style={{ marginTop: 0 }}>Badges</h2>
          <div className="badge-row">
            {profile.badges.map((b) => (
              <span key={b.id} className="badge-chip" title={b.description}>{b.label}</span>
            ))}
          </div>
        </section>
      )}

      {Array.isArray(profile.collections) && profile.collections.length > 0 && (
        <section style={{ marginTop: '1.25rem' }}>
          <h2 className="home-section-title">Public collections</h2>
          <div className="collections-grid">
            {profile.collections.map((c) => (
              <Link key={c._id} to={`/collections/${c._id}`} className="collection-card">
                <h3>{c.name}</h3>
                <p className="page-sub">{c.noteCount} notes</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: '1.25rem' }}>
        <h2 className="home-section-title">Uploads</h2>
        {(profile.notes || []).length === 0 ? (
          <p className="page-sub">No public uploads yet.</p>
        ) : (
          <div className="notes-grid">
            {profile.notes.map((note) => (
              <NoteCard key={note._id} note={note} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default PublicProfile
