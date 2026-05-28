import apiClient from './client';
import type { UploadedFile } from '../types';

// baseURL is already http://localhost:8000/api/v1

export const uploadFile = async (conversationId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<UploadedFile>(
    `/chat/conversations/${conversationId}/files`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data;
};

export const listFiles = async (conversationId: string) => {
  const { data } = await apiClient.get<UploadedFile[]>(
    `/chat/conversations/${conversationId}/files`
  );
  return data;
};
