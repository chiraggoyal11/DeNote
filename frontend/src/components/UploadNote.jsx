import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { notesAPI } from '../api'
import AppNav from './AppNav'
import { RESOURCE_TYPES } from '../utils/resourceTypes'

const emptyForm = {
  branch: '',
  semester: '',
  subject: '',
  title: '',
  description: '',
  resourceType: 'note',
  tags: '',
  college: '',
  university: '',
  examYear: '',
  examType: '',
  changelog: ''
}

function UploadNote({ onLogout }) {
  const [searchParams] = useSearchParams()
  const versionOf = searchParams.get('versionOf') || ''
  const [formData, setFormData] = useState({ ...emptyForm })
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [duplicate, setDuplicate] = useState(null)
  const [parentNote, setParentNote] = useState(null)
  const navigate = useNavigate()

  const isVersionUpload = Boolean(versionOf)

  useEffect(() => {
    if (!versionOf) return
    let cancelled = false
    ;(async () => {
      try {
        // Prefer versions endpoint which accepts id or cid
        const res = await notesAPI.versions(versionOf)
        const latest = (res.data.versions || []).find((v) => v.isLatest) || res.data.versions?.slice(-1)[0]
        if (!cancelled && latest) {
          setParentNote(latest)
          setFormData((prev) => ({
            ...prev,
            title: latest.title || prev.title,
            subject: latest.subject || prev.subject,
            branch: latest.branch || prev.branch,
            semester: latest.sem || prev.semester,
            description: latest.description || prev.description,
            resourceType: latest.resourceType || prev.resourceType,
            tags: Array.isArray(latest.tags) ? latest.tags.join(', ') : prev.tags,
            college: latest.college || prev.college,
            university: latest.university || prev.university,
            examYear: latest.examYear || prev.examYear,
            examType: latest.examType || prev.examType,
            changelog: ''
          }))
        }
      } catch (err) {
        console.error(err)
      }
    })()
    return () => { cancelled = true }
  }, [versionOf])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFileChange = (e) => {
    setFile(e.target.files[0])
    setDuplicate(null)
  }

  const buildFormData = (forceDuplicate = false) => {
    const data = new FormData()
    data.append('File_Note', file)
    data.append('branch', formData.branch)
    data.append('sem', formData.semester)
    data.append('subject', formData.subject)
    data.append('title', formData.title)
    data.append('description', formData.description)
    data.append('resourceType', formData.resourceType)
    data.append('tags', formData.tags)
    data.append('college', formData.college)
    data.append('university', formData.university)
    data.append('examYear', formData.examYear)
    data.append('examType', formData.examType)
    if (isVersionUpload) {
      data.append('versionOf', versionOf)
      data.append('changelog', formData.changelog)
    }
    if (forceDuplicate) data.append('forceDuplicate', 'true')
    return data
  }

  const finishUpload = (response) => {
    setSuccess(response.data?.msg || 'Uploaded successfully. Opening your note…')
    setFormData({ ...emptyForm })
    setFile(null)
    setDuplicate(null)
    const cid = response.data.cid
    setTimeout(() => {
      if (cid) navigate(`/note/${cid}`)
      else navigate('/notes')
    }, 900)
  }

  const handleSubmit = async (e, { forceDuplicate = false } = {}) => {
    e?.preventDefault?.()
    setError('')
    setSuccess('')
    if (!forceDuplicate) setDuplicate(null)

    if (!file) {
      setError('Please select a PDF file to upload')
      return
    }

    setLoading(true)
    try {
      const response = await notesAPI.upload(buildFormData(forceDuplicate))
      finishUpload(response)
    } catch (err) {
      console.error('Upload error:', err)
      if (err.response?.status === 409 && err.response?.data?.duplicate) {
        setDuplicate(err.response.data)
        setError(err.response.data.msg || 'This file was already uploaded.')
      } else {
        setError(err.response?.data?.msg || err.response?.data?.message || 'Upload failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const isPyq = formData.resourceType === 'pyq'
  const heading = useMemo(
    () => (isVersionUpload ? `Upload version ${(parentNote?.version || 1) + 1}` : 'Upload a resource'),
    [isVersionUpload, parentNote]
  )

  return (
    <div className="container page-enter">
      <AppNav onLogout={onLogout} />

      <section className="page-head">
        <div>
          <h1 className="page-title">{heading}</h1>
          <p className="page-sub">
            {isVersionUpload
              ? 'Publish a newer version of this note. Previous versions stay available.'
              : 'Add metadata and a PDF. Identical files are detected so we do not re-pin to IPFS.'}
          </p>
        </div>
      </section>

      <div className="panel upload-form">
        <form onSubmit={(e) => handleSubmit(e)}>
          <div className="form-group">
            <label htmlFor="resourceType">Resource type</label>
            <select id="resourceType" name="resourceType" value={formData.resourceType} onChange={handleChange}>
              {RESOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
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
            <label htmlFor="college">College</label>
            <input id="college" type="text" name="college" value={formData.college} onChange={handleChange} placeholder="e.g. BMSCE" />
          </div>
          <div className="form-group">
            <label htmlFor="tags">Tags</label>
            <input id="tags" type="text" name="tags" value={formData.tags} onChange={handleChange} placeholder="comma-separated, e.g. midterm, unit-2" />
          </div>
          {isPyq && (
            <>
              <div className="form-group">
                <label htmlFor="university">University</label>
                <input id="university" type="text" name="university" value={formData.university} onChange={handleChange} placeholder="e.g. VTU" />
              </div>
              <div className="form-group">
                <label htmlFor="examYear">Exam year</label>
                <input id="examYear" type="text" name="examYear" value={formData.examYear} onChange={handleChange} placeholder="e.g. 2025" />
              </div>
              <div className="form-group">
                <label htmlFor="examType">Exam type</label>
                <input id="examType" type="text" name="examType" value={formData.examType} onChange={handleChange} placeholder="e.g. End Semester" />
              </div>
            </>
          )}
          {isVersionUpload && (
            <div className="form-group">
              <label htmlFor="changelog">What changed</label>
              <input id="changelog" type="text" name="changelog" value={formData.changelog} onChange={handleChange} placeholder="e.g. Added unit 4 solutions" />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} placeholder="Short description" rows="3" required />
          </div>
          <div className="form-group">
            <label htmlFor="file">PDF file</label>
            <input id="file" type="file" accept=".pdf,application/pdf" onChange={handleFileChange} required />
          </div>
          {error && <div className="error">{error}</div>}
          {duplicate?.existing && (
            <div className="duplicate-banner">
              <p>
                Existing upload: <strong>{duplicate.existing.title}</strong>
                {' · '}
                <Link to={`/note/${duplicate.existing.cid}`}>Open existing</Link>
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={loading}
                onClick={(e) => handleSubmit(e, { forceDuplicate: true })}
              >
                {loading ? 'Uploading…' : 'Publish anyway (reuse IPFS pin)'}
              </button>
            </div>
          )}
          {success && <div className="success">{success}</div>}
          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Uploading…' : (isVersionUpload ? 'Upload new version' : 'Upload to IPFS')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default UploadNote
