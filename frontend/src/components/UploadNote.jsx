import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { notesAPI } from '../api'

function UploadNote({ onLogout }) {
  const [formData, setFormData] = useState({
    branch: '',
    semester: '',
    subject: '',
    title: '',
    description: ''
  })
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFileChange = (e) => {
    setFile(e.target.files[0])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!file) {
      setError('Please select a file to upload')
      return
    }

    setLoading(true)

    try {
      const data = new FormData()
      data.append('File_Note', file)  // Changed from 'file' to 'File_Note'
      data.append('branch', formData.branch)
      data.append('sem', formData.semester)  // Changed from 'semester' to 'sem'
      data.append('subject', formData.subject)
      data.append('title', formData.title)
      data.append('uploader', 'Anonymous')  // Add uploader field
      data.append('rating', '0')  // Add rating field

      const response = await notesAPI.upload(data)
      setSuccess(`Note uploaded successfully! CID: ${response.data.cid}`)
      
      // Reset form
      setFormData({
        branch: '',
        semester: '',
        subject: '',
        title: '',
        description: ''
      })
      setFile(null)
      
      // Reset file input
      e.target.reset()
      
      // Redirect after 2 seconds
      setTimeout(() => navigate('/notes'), 2000)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.response?.data?.msg || err.response?.data?.message || 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <nav className="navbar">
        <h1>📚 DeNote</h1>
        <div>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/upload">Upload Note</Link>
          <Link to="/notes">Browse Notes</Link>
          <button onClick={onLogout} className="btn btn-secondary" style={{ marginLeft: '1rem' }}>
            Logout
          </button>
        </div>
      </nav>

      <div className="auth-container" style={{ marginTop: '2rem', maxWidth: '600px' }}>
        <h2>📤 Upload New Note</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Branch</label>
            <input
              type="text"
              name="branch"
              value={formData.branch}
              onChange={handleChange}
              placeholder="e.g., Computer Science"
              required
            />
          </div>
          <div className="form-group">
            <label>Semester</label>
            <input
              type="text"
              name="semester"
              value={formData.semester}
              onChange={handleChange}
              placeholder="e.g., 5"
              required
            />
          </div>
          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="e.g., Data Structures"
              required
            />
          </div>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Binary Trees Notes"
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of the notes"
              rows="3"
              required
            />
          </div>
          <div className="form-group">
            <label>File (PDF)</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              required
            />
          </div>
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Uploading...' : 'Upload Note'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default UploadNote
