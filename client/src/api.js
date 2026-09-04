const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Request failed');
    err.code = data.error;
    throw err;
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  enrollFace: (payload, token) => request('/auth/enroll-face', { method: 'POST', body: payload, token }),

  createRoom: (payload, token) => request('/rooms', { method: 'POST', body: payload, token }),
  listRooms: (token) => request('/rooms', { token }),
  getRoom: (roomId, token) => request(`/rooms/${roomId}`, { token }),
  addQuestion: (roomId, payload, token) => request(`/rooms/${roomId}/questions`, { method: 'POST', body: payload, token }),
  updateQuestion: (roomId, questionId, payload, token) => request(`/rooms/${roomId}/questions/${questionId}`, { method: 'PUT', body: payload, token }),
  deleteQuestion: (roomId, questionId, token) => request(`/rooms/${roomId}/questions/${questionId}`, { method: 'DELETE', token }),
  generateCode: (roomId, token) => request(`/rooms/${roomId}/generate-code`, { method: 'POST', token }),
  deleteRoom: (roomId, token) => request(`/rooms/${roomId}`, { method: 'DELETE', token }),
  gradeAnswer: (answerId, payload, token) => request(`/rooms/answers/${answerId}/grade`, { method: 'POST', body: payload, token }),
  recap: (roomId, token) => request(`/rooms/${roomId}/recap`, { token }),

  joinRoom: (code, token) => request('/rooms/join', { method: 'POST', body: { code }, token }),
  getExam: (roomId, token) => request(`/rooms/${roomId}/exam`, { token }),
  submitAnswer: (sessionId, payload, token) => request(`/sessions/${sessionId}/answers`, { method: 'POST', body: payload, token }),
  completeSession: (sessionId, payload, token) => request(`/sessions/${sessionId}/complete`, { method: 'POST', body: payload, token }),
  reportViolation: (sessionId, payload, token) => request(`/sessions/${sessionId}/violations`, { method: 'POST', body: payload, token }),
};