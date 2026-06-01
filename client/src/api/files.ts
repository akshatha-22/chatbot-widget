import apiClient, { uploadClient } from './client';
import type { UploadedFile } from '../types';

export const uploadFile = async (conversationId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await uploadClient.post<UploadedFile>(
    `/chat/conversations/${conversationId}/files`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    },
  );
  return data;
};

export const listFiles = async (conversationId: string) => {
  const { data } = await apiClient.get<UploadedFile[]>(
    `/chat/conversations/${conversationId}/files`,
  );
  return data;
};
