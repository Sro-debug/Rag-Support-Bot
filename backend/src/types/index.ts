export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: "admin" | "agent";
  createdAt: Date;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface Document {
  id: string;
  filename: string;
  originalName: string;
  uploadedAt: Date;
  chunkCount: number;
  uploadedBy: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: SourceChunk[];
}

export interface SourceChunk {
  documentId: string;
  filename: string;
  chunk: string;
  score: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedRequest extends import("express").Request {
  user?: JWTPayload;
}
