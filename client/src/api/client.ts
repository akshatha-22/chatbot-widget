import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

function attachAuthInterceptor(client: AxiosInstance) {
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** Longer timeout for uploads; embedding runs in the background on the server. */
export const uploadClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 120000,
});

attachAuthInterceptor(apiClient);
attachAuthInterceptor(uploadClient);

export default apiClient;
