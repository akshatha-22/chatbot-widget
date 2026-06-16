import axios from 'axios';
import apiClient, { uploadClient } from './client';
import { authHeaders, getAuthToken } from './authToken';
import type { UploadedFile } from '../types';

function uploadErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') {
      if (detail === 'Not authenticated' || detail === 'Could not validate credentials') {
        return 'Your session expired. Please sign out and sign in again, then retry the upload.';
      }
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail.map((d) => d?.msg ?? String(d)).join('; ');
    }
    if (detail && typeof detail === 'object' && 'message' in detail) {
      return String((detail as { message: string }).message);
    }
    if (err.response?.status === 401) {
      return 'Your session expired. Please sign out and sign in again, then retry the upload.';
    }
    if (err.response?.status === 413) {
      return 'File too large. Maximum size is 100MB.';
    }
    if (err.response?.status === 415) {
      return 'Unsupported file type for document upload.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Upload failed. Try again.';
}

export const uploadFile = async (conversationId: string, file: File) => {
  if (!getAuthToken()) {
    throw new Error('Please sign in to upload files.');
  }

  const form = new FormData();
  form.append('file', file);
  try {
    const { data } = await uploadClient.post<UploadedFile>(
      `/chat/conversations/${conversationId}/files`,
      form,
      {
        // Do not set Content-Type — axios must add multipart boundary automatically.
        headers: authHeaders(),
        timeout: 180000,
      },
    );
    return data;
  } catch (err) {
    throw new Error(uploadErrorMessage(err));
  }
};

export const listFiles = async (conversationId: string) => {
  const { data } = await apiClient.get<UploadedFile[]>(
    `/chat/conversations/${conversationId}/files`,
  );
  return data;
};

export const deleteFile = async (conversationId: string, fileId: string) => {
  await apiClient.delete(`/chat/conversations/${conversationId}/files/${fileId}`);
};
