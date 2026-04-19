import { Router, Request, Response } from "express";
import { loginUser, registerUser, listUsers } from "../services/authService";
import { authenticate, requireAdmin } from "../middleware/auth";
import { AuthenticatedRequest } from "../types";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  try {
    const token = await loginUser(email, password);
    res.json({ token });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post(
  "/register",
  authenticate,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const { email, password, role } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    try {
      const user = await registerUser(email, password, role || "agent");
      res.status(201).json({ id: user.id, email: user.email, role: user.role });
    } catch (err: any) {
      res.status(409).json({ error: err.message });
    }
  }
);

router.get("/me", authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json(req.user);
});

router.get(
  "/users",
  authenticate,
  requireAdmin,
  (_req, res: Response) => {
    res.json(listUsers());
  }
);

export default router;
