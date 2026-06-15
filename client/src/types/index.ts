export interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  has_pdf?: boolean;
  pdf_content?: string | null;
  pdf_filename?: string | null;
  cache_hit?: boolean;
  source?: 'catalog' | 'web' | 'none';
  links?: TExternalLink[];
}

export interface TExternalLink {
  url: string;
  title: string;
}

export interface UploadedFile {
  id: string;
  filename: string;
  status: 'pending' | 'processed' | 'failed';
  created_at: string;
}

export interface User {
  id: number;
  email: string;
}
