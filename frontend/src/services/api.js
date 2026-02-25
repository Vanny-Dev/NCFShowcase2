import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("qampus_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("qampus_token");
      localStorage.removeItem("qampus_user");
      window.location.href = "/cashier/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth
export const authAPI = {
  login: (data) => api.post("/auth/login", data),
  register: (data) => api.post("/auth/register", data),
  getMe: () => api.get("/auth/me"),
  seed: () => api.post("/auth/seed"),
};

// ── Queue
export const queueAPI = {
  join: (data) => api.post("/queue/join", data),
  getAll: () => api.get("/queue"),
  getTicket: (id) => api.get(`/queue/${id}`),
  getCounterQueue: (counter) => api.get(`/queue/counter/${counter}`),
  callNext: (counter) => api.post("/queue/call-next", { counter }),
  serve: (id) => api.patch(`/queue/${id}/serve`),
  skip: (id) => api.patch(`/queue/${id}/skip`),
  feedback: (id, data) => api.post(`/queue/${id}/feedback`, data),
};

// ── Windows
export const windowsAPI = {
  getActive: () => api.get("/windows/active"),
};

// ── Analytics
export const analyticsAPI = {
  today: () => api.get("/analytics/today"),
  history: (days = 7) => api.get(`/analytics/history?days=${days}`),
};

export default api;