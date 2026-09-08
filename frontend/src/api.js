import axios from 'axios'

// Use environment variable for production backend URL
// In development: uses Vite proxy (/api/denote -> localhost:5000)
// Prefer VITE_API_BASE_URL (origin only). Also accept VITE_API_URL
// (full .../api/denote path) used in some deploys.
function resolveApiUrl() {
  const base = import.meta.env.VITE_API_BASE_URL
  if (base) {
    return `${String(base).replace(/\/$/, '')}/api/denote`
  }
  const full = import.meta.env.VITE_API_URL
  if (full) {
    return String(full).replace(/\/$/, '')
  }
  return '/api/denote'
}

const API_URL = resolveApiUrl()

const api = axios.create({
  baseURL: API_URL,
})

function clearAuthStorage() {
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  localStorage.removeItem('displayName')
  localStorage.removeItem('userPicture')
}

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Expired / invalid sessions should bounce to login instead of a bare "Error" banner.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const code = error.response?.data?.code
    const msg = error.response?.data?.msg
    const isAuthFailure =
      status === 401 &&
      (code === 'TOKEN_EXPIRED' ||
        code === 'INVALID_TOKEN' ||
        code === 'NO_TOKEN' ||
        msg === 'Error' ||
        /sign in|session|auth/i.test(String(msg || '')))

    if (isAuthFailure && typeof window !== 'undefined') {
      const path = window.location.pathname || ''
      const onAuthPage = path === '/login' || path === '/register' || path === '/forgot-password'
      clearAuthStorage()
      if (!onAuthPage) {
        const reason = code === 'TOKEN_EXPIRED' ? 'expired' : 'auth'
        window.location.assign(`/login?reason=${reason}`)
      }
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  register: (userData) => api.post('/register', userData),
  login: (credentials) => api.post('/login', credentials),
  getProfile: () => api.get('/'),
  forgotPassword: (payload) => api.post('/forgot-password', payload),
  resetPassword: (payload) => api.post('/reset-password', payload),
  googleAuth: (credential) => api.post('/auth/google', { credential }),
  updateProfile: (payload) => api.put('/account/profile', payload),
  scheduleDeletion: (payload) => api.post('/account/schedule-deletion', payload),
  cancelDeletion: () => api.post('/account/cancel-deletion'),
}

export const notesAPI = {
  upload: (formData) => api.post('/ifps/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getNote: (cid) => api.get(`/ifps/get/${cid}`),
  queryNotes: (params) => api.get('/ifps/get', { params }),
  myNotes: (params) => api.get('/ifps/mine', { params }),
  favorites: (params) => api.get('/ifps/favorites', { params }),
  toggleFavorite: (noteId) => api.post(`/ifps/${noteId}/favorite`),
  toggleLike: (noteId) => api.post(`/ifps/${noteId}/like`),
  updateNote: (id, data) => api.put(`/ifps/update/${id}`, data),
  deleteNote: (ids) => api.delete('/ifps/delete', { data: { id: ids } }),
  previewUrl: (cid) => `${API_URL}/ifps/preview/${cid}`,
  resourceTypes: () => api.get('/meta/resource-types'),
  versions: (id) => api.get(`/ifps/${id}/versions`),
}

export const collectionsAPI = {
  list: (params) => api.get('/collections', { params }),
  create: (payload) => api.post('/collections', payload),
  get: (id) => api.get(`/collections/${id}`),
  getShared: (shareId) => api.get(`/collections/share/${shareId}`),
  update: (id, payload) => api.put(`/collections/${id}`, payload),
  remove: (id) => api.delete(`/collections/${id}`),
  addNote: (id, noteId) => api.post(`/collections/${id}/notes`, { noteId }),
  removeNote: (id, noteId) => api.delete(`/collections/${id}/notes/${noteId}`),
  reorder: (id, noteIds) => api.put(`/collections/${id}/reorder`, { noteIds }),
}

export const communityAPI = {
  getProfile: (username) => api.get(`/users/${encodeURIComponent(username)}`),
  followers: (username) => api.get(`/users/${encodeURIComponent(username)}/followers`),
  following: (username) => api.get(`/users/${encodeURIComponent(username)}/following`),
  follow: (username) => api.post(`/users/${encodeURIComponent(username)}/follow`),
  unfollow: (username) => api.delete(`/users/${encodeURIComponent(username)}/follow`),
  listComments: (noteId, params) => api.get(`/notes/${noteId}/comments`, { params }),
  addComment: (noteId, payload) => api.post(`/notes/${noteId}/comments`, payload),
  editComment: (id, body) => api.put(`/comments/${id}`, { body }),
  deleteComment: (id) => api.delete(`/comments/${id}`),
  notifications: (params) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (ids) => api.post('/notifications/read', { ids }),
  markAllRead: () => api.post('/notifications/read-all'),
  activity: (params) => api.get('/activity', { params }),
}

export { API_URL }
export default api
