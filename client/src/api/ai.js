import api from './client'

export const sendMessage   = (data)      => api.post('/ai/chat', data).then(r => r.data)
export const getSessions   = ()          => api.get('/ai/sessions').then(r => r.data)
export const getHistory    = (sessionId) => api.get(`/ai/history/${sessionId}`).then(r => r.data)
export const updateConsent = (value)     => api.put('/auth/me', { ai_data_access: value }).then(r => r.data)
