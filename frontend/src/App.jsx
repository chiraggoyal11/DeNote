import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import UploadNote from './components/UploadNote'
import NotesList from './components/NotesList'
import NoteView from './components/NoteView'
import './App.css'

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
            path="/note/:cid" 
            element={isAuthenticated ? <NoteView onLogout={handleLogout} /> : <Navigate to="/login" replace />} 
          />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
