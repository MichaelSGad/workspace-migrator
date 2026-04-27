const BASE = import.meta.env.VITE_API_URL || ''

export function getToken() {
  return localStorage.getItem('token')
}

export function setToken(token) {
  localStorage.setItem('token', token)
}

export function clearToken() {
  localStorage.removeItem('token')
}

async function request(method, path, body = null, isFormData = false) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!isFormData && body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  needsSetup: () => request('GET', '/api/auth/needs-setup'),
  login: (email, password) => request('POST', '/api/auth/login', { email, password }),
  setup: (email, password) => request('POST', '/api/auth/setup', { email, password }),
  me: () => request('GET', '/api/auth/me'),

  getProjects: () => request('GET', '/api/projects'),
  createProject: (formData) => request('POST', '/api/projects', formData, true),
  getProject: (id) => request('GET', `/api/projects/${id}`),
  deleteProject: (id) => request('DELETE', `/api/projects/${id}`),
  addProjectUser: (projectId, pair) => request('POST', `/api/projects/${projectId}/users`, pair),
  removeProjectUser: (projectId, userId) => request('DELETE', `/api/projects/${projectId}/users/${userId}`),

  createJob: (projectId, services) => request('POST', `/api/projects/${projectId}/jobs`, { services }),
  getJobs: (projectId) => request('GET', `/api/projects/${projectId}/jobs`),
  getJob: (id) => request('GET', `/api/jobs/${id}`),
  stopJob: (id) => request('POST', `/api/jobs/${id}/stop`),
  verifyJob: (id) => request('POST', `/api/jobs/${id}/verify`),

  streamJob: (id) => {
    const token = getToken()
    return new EventSource(`${BASE}/api/jobs/${id}/stream?token=${token}`)
  },
}
