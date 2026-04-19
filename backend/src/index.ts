import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth";
import documentRoutes from "./routes/documents";
import chatRoutes from "./routes/chat";

const app = express();
const PORT = process.env.PORT || 3001;

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

// Logging
app.use(morgan("dev"));

// Body parsing
app.use(express.json({ limit: "10mb" }));

// Rate limiting
app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, try again in 15 minutes" },
}));

app.use("/api/chat", rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});
