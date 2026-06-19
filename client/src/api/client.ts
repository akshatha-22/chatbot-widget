import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { getAuthToken } from './authToken';
import { getApiBaseUrl } from './config';

function apiOrigin(): string {
  return getApiBaseUrl().replace(/\/$/, '');
}

function attachAuthInterceptor(client: AxiosInstance) {
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    config.baseURL = `${apiOrigin()}/api/v1`;
    const token = getAuthToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });
}

const apiClient = axios.create({
  baseURL: `${apiOrigin()}/api/v1`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** Longer timeout for uploads; embedding runs in the background on the server. */
export const uploadClient = axios.create({
  baseURL: `${apiOrigin()}/api/v1`,
  timeout: 180000,
});

attachAuthInterceptor(apiClient);
attachAuthInterceptor(uploadClient);

export default apiClient;
