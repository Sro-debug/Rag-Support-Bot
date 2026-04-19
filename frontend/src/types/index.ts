export interface User {
  userId: string;
  email: string;
  role: "admin" | "agent";
}

export interface Document {
  id: string;
  filename: string;
  originalName: string;
  uploadedAt: string;
  chunkCount: number;
  uploadedBy: string;
}

export interface SourceChunk {
  documentId: string;
  filename: string;
  chunk: string;
  score: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: SourceChunk[];
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessage?: string;
}
