import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notesAPI } from '../api'
import AppNav from './AppNav'

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
      setError('Please select a PDF file to upload')
      return
    }

    setLoading(true)
    try {
      const data = new FormData()
      data.append('File_Note', file)
      data.append('branch', formData.branch)
      data.append('sem', formData.semester)
      data.append('subject', formData.subject)
      data.append('title', formData.title)

      const response = await notesAPI.upload(data)
      setSuccess(`Uploaded successfully. Opening your note…`)
      setFormData({ branch: '', semester: '', subject: '', title: '', description: '' })
      setFile(null)
      e.target.reset()

      const cid = response.data.cid
      setTimeout(() => {
        if (cid) navigate(`/note/${cid}`)
        else navigate('/notes')
      }, 900)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.response?.data?.msg || err.response?.data?.message || 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="page-head">
        <div>
          <h1 className="page-title">Upload a note</h1>
          <p className="page-sub">Add metadata and a PDF. The file is pinned to IPFS after upload.</p>
        </div>
      </section>

      <div className="panel upload-form">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="branch">Branch</label>
            <input id="branch" type="text" name="branch" value={formData.branch} onChange={handleChange} placeholder="e.g. Computer Science" required />
          </div>
          <div className="form-group">
            <label htmlFor="semester">Semester</label>
            <input id="semester" type="text" name="semester" value={formData.semester} onChange={handleChange} placeholder="e.g. 5" required />
          </div>
          <div className="form-group">
            <label htmlFor="subject">Subject</label>
            <input id="subject" type="text" name="subject" value={formData.subject} onChange={handleChange} placeholder="e.g. Data Structures" required />
          </div>
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input id="title" type="text" name="title" value={formData.title} onChange={handleChange} placeholder="e.g. Binary Trees notes" required />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Short description" rows="3" required />
          </div>
          <div className="form-group">
            <label htmlFor="file">PDF file</label>
            <input id="file" type="file" accept=".pdf,application/pdf" onChange={handleFileChange} required />
          </div>
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}
          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Uploading…' : 'Upload to IPFS'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default UploadNote
