import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import ForgotPassword from './components/ForgotPassword'
import Dashboard from './components/Dashboard'
import UploadNote from './components/UploadNote'
import NotesList from './components/NotesList'
import NoteView from './components/NoteView'
import Profile from './components/Profile'
import MyUploads from './components/MyUploads'
import Favorites from './components/Favorites'
import Collections from './components/Collections'
import CollectionView from './components/CollectionView'
import PublicProfile from './components/PublicProfile'
import Activity from './components/Activity'
import AdminDashboard from './components/AdminDashboard'

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
            path="/profile"
            element={isAuthenticated ? <Profile onLogout={handleLogout} /> : <Navigate to="/login" replace />}
          />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
