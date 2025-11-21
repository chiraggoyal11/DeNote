import axios from 'axios'

const API_URL = '/api/denote'

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
}

export const notesAPI = {
  upload: (formData) => api.post('/ifps/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getNote: (cid) => api.get(`/ifps/get/${cid}`),
  queryNotes: (params) => api.get('/ifps/get', { params }),
  updateNote: (id, data) => api.put(`/ifps/update/${id}`, data),
  deleteNote: (ids) => api.delete('/ifps/delete', { data: { id: ids } }),
}

export default api
