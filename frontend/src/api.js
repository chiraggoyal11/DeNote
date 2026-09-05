import axios from 'axios'

// Use environment variable for production backend URL
// In development: uses Vite proxy (/api/denote -> localhost:5000)
// In production: VITE_API_BASE_URL should be set to https://denote-igao.onrender.com
const API_URL = import.meta.env.VITE_API_BASE_URL 
  ? `${import.meta.env.VITE_API_BASE_URL}/api/denote`
  : '/api/denote'

const api = axios.create({
  baseURL: API_URL,
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authAPI = {
  register: (userData) => api.post('/register', userData),
  login: (credentials) => api.post('/login', credentials),
  getProfile: () => api.get('/'),
  forgotPassword: (payload) => api.post('/forgot-password', payload),
  resetPassword: (payload) => api.post('/reset-password', payload),
  googleAuth: (credential) => api.post('/auth/google', { credential }),
  scheduleDeletion: (payload) => api.post('/account/schedule-deletion', payload),
  cancelDeletion: () => api.post('/account/cancel-deletion'),
}

export const notesAPI = {
  upload: (formData) => api.post('/ifps/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getNote: (cid) => api.get(`/ifps/get/${cid}`),
  queryNotes: (params) => api.get('/ifps/get', { params }),
  updateNote: (id, data) => api.put(`/ifps/update/${id}`, data),
  deleteNote: (ids) => api.delete('/ifps/delete', { data: { id: ids } }),
  previewUrl: (cid) => `${API_URL}/ifps/preview/${cid}`,
}

export { API_URL }
export default api
