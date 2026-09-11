import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import ForgotPassword from './components/ForgotPassword'
import OfflineBanner from './components/OfflineBanner'
import { PageSkeleton } from './components/Skeleton'

const Dashboard = lazy(() => import('./components/Dashboard'))
const UploadNote = lazy(() => import('./components/UploadNote'))
const NotesList = lazy(() => import('./components/NotesList'))
const NoteView = lazy(() => import('./components/NoteView'))
const Profile = lazy(() => import('./components/Profile'))
const MyUploads = lazy(() => import('./components/MyUploads'))
const Favorites = lazy(() => import('./components/Favorites'))
const Collections = lazy(() => import('./components/Collections'))
const CollectionView = lazy(() => import('./components/CollectionView'))
const PublicProfile = lazy(() => import('./components/PublicProfile'))
const Activity = lazy(() => import('./components/Activity'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))
const Analytics = lazy(() => import('./components/Analytics'))

function RouteFallback() {
  return (
    <div className="container page-enter" style={{ paddingTop: '1.5rem' }}>
      <PageSkeleton rows={4} />
    </div>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'))

  useEffect(() => {
    const token = localStorage.getItem('token')
    setIsAuthenticated(!!token)
  }, [])

  const handleLogin = (token) => {
    localStorage.setItem('token', token)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('displayName')
    localStorage.removeItem('userPicture')
    localStorage.removeItem('role')
    setIsAuthenticated(false)
  }

  return (
    <Router>
      <div className="App">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <OfflineBanner scope="offline" />
        <main id="main-content" tabIndex={-1}>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/login"
            element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard" replace />}
          />
          <Route
            path="/register"
            element={!isAuthenticated ? <Register onLogin={handleLogin} /> : <Navigate to="/dashboard" replace />}
          />
          <Route
            path="/forgot-password"
            element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/dashboard" replace />}
          />
          <Route
            path="/dashboard"
            element={isAuthenticated ? <Dashboard onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/upload"
            element={isAuthenticated ? <UploadNote onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/notes"
            element={isAuthenticated ? <NotesList onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/activity"
            element={isAuthenticated ? <Activity onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/my-uploads"
            element={isAuthenticated ? <MyUploads onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/favorites"
            element={isAuthenticated ? <Favorites onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/collections"
            element={isAuthenticated ? <Collections onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/collections/share/:shareId"
            element={isAuthenticated ? <CollectionView onLogout={handleLogout} shared /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/collections/:id"
            element={isAuthenticated ? <CollectionView onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/note/:cid"
            element={isAuthenticated ? <NoteView onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/u/:username"
            element={isAuthenticated ? <PublicProfile onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/admin"
            element={isAuthenticated ? <AdminDashboard onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/analytics"
            element={isAuthenticated ? <Analytics onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/profile"
            element={isAuthenticated ? <Profile onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
        </Routes>
        </Suspense>
        </main>
      </div>
    </Router>
  )
}

export default App
