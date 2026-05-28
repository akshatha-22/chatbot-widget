import apiClient from './client';

export const signup = async (email: string, password: string) => {
  const { data } = await apiClient.post('/auth/signup', { email, password });
  return data;
};

export const login = async (email: string, password: string) => {
  const { data } = await apiClient.post<{ access_token: string }>('/auth/login', {
    email: email.trim(),
    password,
  });
  // Save under 'token' — must match what the interceptor reads
  localStorage.setItem('token', data.access_token);
  return data;
};

export const logout = () => {
  localStorage.removeItem('token');
};

export const getMe = async () => {
  const { data } = await apiClient.get('/auth/me');
  return data;
};
