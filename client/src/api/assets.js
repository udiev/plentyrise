import api from './client'

export const getSummary = () => api.get('/assets/summary').then(r => r.data)
