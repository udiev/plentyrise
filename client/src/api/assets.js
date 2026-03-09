import api from './client'

export const getSummary = () => api.get('/assets/summary').then(r => r.data)

export const getInvestments = () => api.get('/investments').then(r => r.data)
export const addInvestment = (data) => api.post('/investments', data).then(r => r.data)
export const updateInvestment = (id, data) => api.put(`/investments/${id}`, data).then(r => r.data)
export const deleteInvestment = (id) => api.delete(`/investments/${id}`).then(r => r.data)

export const getRealEstate = () => api.get('/real-estate').then(r => r.data)
export const addRealEstate = (data) => api.post('/real-estate', data).then(r => r.data)
export const updateRealEstate = (id, data) => api.put(`/real-estate/${id}`, data).then(r => r.data)
export const deleteRealEstate = (id) => api.delete(`/real-estate/${id}`).then(r => r.data)

export const getCrypto = () => api.get('/crypto').then(r => r.data)
export const addCrypto = (data) => api.post('/crypto', data).then(r => r.data)
export const updateCrypto = (id, data) => api.put(`/crypto/${id}`, data).then(r => r.data)
export const deleteCrypto = (id) => api.delete(`/crypto/${id}`).then(r => r.data)

export const getCash = () => api.get('/cash').then(r => r.data)
export const addCash = (data) => api.post('/cash', data).then(r => r.data)
export const updateCash = (id, data) => api.put(`/cash/${id}`, data).then(r => r.data)
export const deleteCash = (id) => api.delete(`/cash/${id}`).then(r => r.data)

export const getPension = () => api.get('/pension').then(r => r.data)
export const addPension = (data) => api.post('/pension', data).then(r => r.data)
export const updatePension = (id, data) => api.put(`/pension/${id}`, data).then(r => r.data)
export const deletePension = (id) => api.delete(`/pension/${id}`).then(r => r.data)

export const getAlternative = () => api.get('/alternative-investments').then(r => r.data)
export const addAlternative = (data) => api.post('/alternative-investments', data).then(r => r.data)
export const updateAlternative = (id, data) => api.put(`/alternative-investments/${id}`, data).then(r => r.data)
export const deleteAlternative = (id) => api.delete(`/alternative-investments/${id}`).then(r => r.data)
