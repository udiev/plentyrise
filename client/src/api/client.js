import axios from 'axios'

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || '/api/v1'
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || ''
    if (err.response?.status === 401 && (msg === 'No token provided' || msg === 'Invalid or expired token')) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
