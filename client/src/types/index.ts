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
}

export interface UploadedFile {
  id: string;
  filename: string;
  status: 'pending' | 'processed';
  created_at: string;
}

export interface User {
  id: number;
  email: string;
}
