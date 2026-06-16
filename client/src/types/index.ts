export interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export type { TMessageSource, TExternalLink, TMessage } from './chat';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  has_pdf?: boolean;
  pdf_content?: string | null;
  pdf_filename?: string | null;
  cache_hit?: boolean;
  source?: 'document' | 'both' | 'web' | 'none' | 'catalog' | null;
  links?: import('./chat').TExternalLink[];
}

export interface UploadedFile {
  id: string;
  filename: string;
  status: 'pending' | 'extracting' | 'embedding' | 'processed' | 'failed';
  created_at: string;
  processing_error?: string | null;
  embedding_model_version?: string | null;
  stale?: boolean;
}

export const FILE_IN_PROGRESS_STATUSES: UploadedFile['status'][] = [
  'pending',
  'extracting',
  'embedding',
];

export interface User {
  id: number;
  email: string;
}
