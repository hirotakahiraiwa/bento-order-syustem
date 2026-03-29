const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('bento_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('bento_token');
    localStorage.removeItem('bento_user');
    window.location.href = '/login';
    throw new Error('セッションが切れました');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'エラーが発生しました');
  }

  // CSV download
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return res.blob();
  }

  return res.json();
}

export const api = {
  // 認証
  login: (employee_number, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ employee_number, password }),
    }),
  getMe: () => request('/auth/me'),
  changePassword: (current_password, new_password) =>
    request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password }),
    }),

  // 注文
  getMyOrders: (year, month) => request(`/orders/my/${year}/${month}`),
  toggleOrder: (date, is_ordered) =>
    request('/orders/toggle', {
      method: 'POST',
      body: JSON.stringify({ date, is_ordered }),
    }),
  setDefaultOrder: (default_order) =>
    request('/orders/default', {
      method: 'PUT',
      body: JSON.stringify({ default_order }),
    }),
  getMySummary: (year, month) => request(`/orders/my-summary/${year}/${month}`),

  // 発注・集計（管理者）
  getTomorrowSummary: () => request('/summary/tomorrow'),
  getDateSummary: (date) => request(`/summary/date/${date}`),
  confirmOrder: (date) =>
    request('/summary/confirm', {
      method: 'POST',
      body: JSON.stringify({ date }),
    }),
  getMonthlySummary: (year, month) => request(`/summary/monthly/${year}/${month}`),
  downloadCsv: (year, month) => request(`/summary/monthly/${year}/${month}/csv`),
  getOrderHistory: (year, month) => request(`/summary/history/${year}/${month}`),

  // 従業員管理（管理者）
  getEmployees: () => request('/employees'),
  addEmployee: (data) =>
    request('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEmployee: (id, data) =>
    request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  toggleEmployeeActive: (id) =>
    request(`/employees/${id}/toggle-active`, { method: 'PUT' }),

  // 休業日
  getHolidays: (year) => request(`/employees/holidays/${year}`),
  addHoliday: (date, name) =>
    request('/employees/holidays', {
      method: 'POST',
      body: JSON.stringify({ date, name }),
    }),
  deleteHoliday: (id) =>
    request(`/employees/holidays/${id}`, { method: 'DELETE' }),
};
