import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { authenticate, requireAdmin } from "../middleware/auth";
import { AuthenticatedRequest, Document } from "../types";
import { ingestDocument, deleteDocument } from "../services/ragClient";

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const unique = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

// In-memory document registry (swap to DB in prod)
const documents: Map<string, Document> = new Map();

router.get("/", authenticate, (_req, res: Response) => {
  res.json(Array.from(documents.values()));
});

router.post(
  "/upload",
  authenticate,
  requireAdmin,
  upload.single("file"),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const docId = uuidv4();
    try {
      // Delegate PDF parsing + chunking + embedding to Python RAG service
      const chunkCount = await ingestDocument(
        req.file.path,
        docId,
        req.file.originalname
      );

      const doc: Document = {
        id: docId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        uploadedAt: new Date(),
        chunkCount,
        uploadedBy: req.user!.email,
      };
      documents.set(docId, doc);

      res.status(201).json(doc);
    } catch (err: any) {
      console.error("[Upload error]", err);
      await fs.unlink(req.file!.path).catch(() => {});
      res.status(500).json({ error: err.message || "Ingestion failed" });
    }
  }
);

router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  async (req, res: Response) => {
    const doc = documents.get(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    try {
      await deleteDocument(req.params.id);
      const filePath = path.join(UPLOAD_DIR, doc.filename);
      await fs.unlink(filePath).catch(() => {});
      documents.delete(req.params.id);
      res.json({ message: "Document deleted" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
