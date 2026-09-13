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

async function downloadFile(path, token, filename) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'Download failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  enrollFace: (payload, token) => request('/auth/enroll-face', { method: 'POST', body: payload, token }),
  updateProfile: (payload, token) => request('/auth/me', { method: 'PUT', body: payload, token }),
  changePassword: (payload, token) => request('/auth/me/password', { method: 'PUT', body: payload, token }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: payload }),

  createRoom: (payload, token) => request('/rooms', { method: 'POST', body: payload, token }),
  listRooms: (token) => request('/rooms', { token }),
  getRoom: (roomId, token) => request(`/rooms/${roomId}`, { token }),
  addQuestion: (roomId, payload, token) => request(`/rooms/${roomId}/questions`, { method: 'POST', body: payload, token }),
  updateQuestion: (roomId, questionId, payload, token) => request(`/rooms/${roomId}/questions/${questionId}`, { method: 'PUT', body: payload, token }),
  deleteQuestion: (roomId, questionId, token) => request(`/rooms/${roomId}/questions/${questionId}`, { method: 'DELETE', token }),
  generateCode: (roomId, token) => request(`/rooms/${roomId}/generate-code`, { method: 'POST', token }),
  deleteRoom: (roomId, token) => request(`/rooms/${roomId}`, { method: 'DELETE', token }),
  addAssistant: (roomId, email, token) => request(`/rooms/${roomId}/assistants`, { method: 'POST', body: { email }, token }),
  removeAssistant: (roomId, userId, token) => request(`/rooms/${roomId}/assistants/${userId}`, { method: 'DELETE', token }),
  gradeAnswer: (answerId, payload, token) => request(`/rooms/answers/${answerId}/grade`, { method: 'POST', body: payload, token }),
  recap: (roomId, token) => request(`/rooms/${roomId}/recap`, { token }),
  exportRecapXlsx: (roomId, token, filename) => downloadFile(`/rooms/${roomId}/recap/export.xlsx`, token, filename),
  exportRecapPdf: (roomId, token, filename) => downloadFile(`/rooms/${roomId}/recap/export.pdf`, token, filename),

  joinRoom: (code, token) => request('/rooms/join', { method: 'POST', body: { code }, token }),
  getExam: (roomId, token) => request(`/rooms/${roomId}/exam`, { token }),
  submitAnswer: (sessionId, payload, token) => request(`/sessions/${sessionId}/answers`, { method: 'POST', body: payload, token }),
  completeSession: (sessionId, payload, token) => request(`/sessions/${sessionId}/complete`, { method: 'POST', body: payload, token }),
  reportViolation: (sessionId, payload, token) => request(`/sessions/${sessionId}/violations`, { method: 'POST', body: payload, token }),

  adminStats: (token) => request('/admin/stats', { token }),
  adminListUsers: (token) => request('/admin/users', { token }),
  adminDeactivateUser: (userId, token) => request(`/admin/users/${userId}`, { method: 'DELETE', token }),
  adminReactivateUser: (userId, token) => request(`/admin/users/${userId}/reactivate`, { method: 'POST', token }),
  adminListRooms: (token) => request('/admin/rooms', { token }),
  adminDeleteRoom: (roomId, token) => request(`/admin/rooms/${roomId}`, { method: 'DELETE', token }),

  listBankQuestions: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/question-bank${qs ? `?${qs}` : ''}`, { token });
  },
  listBankTags: (token) => request('/question-bank/tags', { token }),
  createBankQuestion: (payload, token) => request('/question-bank', { method: 'POST', body: payload, token }),
  updateBankQuestion: (id, payload, token) => request(`/question-bank/${id}`, { method: 'PUT', body: payload, token }),
  deleteBankQuestion: (id, token) => request(`/question-bank/${id}`, { method: 'DELETE', token }),
  importBankQuestions: (questions, token) => request('/question-bank/import', { method: 'POST', body: { questions }, token }),
  addQuestionsFromBank: (roomId, ids, token) => request(`/rooms/${roomId}/questions/from-bank`, { method: 'POST', body: { ids }, token }),

  listCourses: (token) => request('/courses', { token }),
  createCourse: (payload, token) => request('/courses', { method: 'POST', body: payload, token }),
  updateCourse: (id, payload, token) => request(`/courses/${id}`, { method: 'PUT', body: payload, token }),
  deleteCourse: (id, token) => request(`/courses/${id}`, { method: 'DELETE', token }),
  getCourse: (id, token) => request(`/courses/${id}`, { token }),
};