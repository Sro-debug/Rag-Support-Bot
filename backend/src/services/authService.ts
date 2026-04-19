import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { User, JWTPayload } from "../types";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "24h";

// In-memory store (swap for a real DB in production)
const users: Map<string, User> = new Map();

// Seed a default admin
(async () => {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@support.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin1234";
  const hash = await bcrypt.hash(adminPassword, 12);
  const id = uuidv4();
  users.set(id, {
    id,
    email: adminEmail,
    passwordHash: hash,
    role: "admin",
    createdAt: new Date(),
  });
  console.log(`[Auth] Default admin seeded: ${adminEmail}`);
})();

export async function registerUser(
  email: string,
  password: string,
  role: "admin" | "agent" = "agent"
): Promise<User> {
  for (const u of users.values()) {
    if (u.email === email) throw new Error("Email already registered");
  }
  const hash = await bcrypt.hash(password, 12);
  const user: User = {
    id: uuidv4(),
    email,
    passwordHash: hash,
    role,
    createdAt: new Date(),
  };
  users.set(user.id, user);
  return user;
}

export async function loginUser(
  email: string,
  password: string
): Promise<string> {
  let found: User | undefined;
  for (const u of users.values()) {
    if (u.email === email) { found = u; break; }
  }
  if (!found) throw new Error("Invalid credentials");

  const ok = await bcrypt.compare(password, found.passwordHash);
  if (!ok) throw new Error("Invalid credentials");

  const payload: JWTPayload = { userId: found.id, email: found.email, role: found.role };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as any);
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export function listUsers(): Omit<User, "passwordHash">[] {
  return Array.from(users.values()).map(({ passwordHash, ...u }) => u);
}
