import api from './client'

// Income Sources
export const getIncome     = ()         => api.get('/cashflow/income').then(r => r.data)
export const addIncome     = (data)     => api.post('/cashflow/income', data).then(r => r.data)
export const updateIncome  = (id, data) => api.put(`/cashflow/income/${id}`, data).then(r => r.data)
export const deleteIncome  = (id)       => api.delete(`/cashflow/income/${id}`).then(r => r.data)

// Expense Goals
export const getExpenses    = ()         => api.get('/cashflow/expenses').then(r => r.data)
export const addExpense     = (data)     => api.post('/cashflow/expenses', data).then(r => r.data)
export const updateExpense  = (id, data) => api.put(`/cashflow/expenses/${id}`, data).then(r => r.data)
export const deleteExpense  = (id)       => api.delete(`/cashflow/expenses/${id}`).then(r => r.data)

// Assumptions
export const getAssumptions    = ()     => api.get('/cashflow/assumptions').then(r => r.data)
export const updateAssumptions = (data) => api.put('/cashflow/assumptions', data).then(r => r.data)

// Forecast
export const getForecast = () => api.get('/cashflow/forecast').then(r => r.data)
