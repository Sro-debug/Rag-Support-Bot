import { Router, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { authenticate } from "../middleware/auth";
import { AuthenticatedRequest, ChatSession, ChatMessage } from "../types";
import { streamChatResponse } from "../services/ragClient";

const router = Router();

// In-memory sessions (swap to Redis or DB in prod)
const sessions: Map<string, ChatSession> = new Map();

router.get("/sessions", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const userSessions = Array.from(sessions.values())
    .filter((s) => s.userId === userId)
    .map(({ messages, ...meta }) => ({
      ...meta,
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1]?.content?.slice(0, 80),
    }));
  res.json(userSessions);
});

router.post("/sessions", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const session: ChatSession = {
    id: uuidv4(),
    userId: req.user!.userId,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  sessions.set(session.id, session);
  res.status(201).json(session);
});

router.get("/sessions/:id", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const session = sessions.get(req.params.id);
  if (!session || session.userId !== req.user!.userId) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.delete("/sessions/:id", authenticate, (req: AuthenticatedRequest, res: Response) => {
  const session = sessions.get(req.params.id);
  if (!session || session.userId !== req.user!.userId) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  sessions.delete(req.params.id);
  res.json({ message: "Session deleted" });
});

// SSE streaming chat
router.post(
  "/sessions/:id/message",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const session = sessions.get(req.params.id);
    if (!session || session.userId !== req.user!.userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const { message } = req.body;
    if (!message?.trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // Append user message
    const userMsg: ChatMessage = {
      role: "user",
      content: message.trim(),
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    try {
      const { fullResponse, sources } = await streamChatResponse(
        req.params.id,
        message.trim(),
        session.messages.slice(0, -1).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        res
      );

      // Append assistant message after streaming
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: fullResponse,
        timestamp: new Date(),
        sources,
      };
      session.messages.push(assistantMsg);
      session.updatedAt = new Date();
    } catch (err: any) {
      console.error("[Chat error]", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  }
);

export default router;
