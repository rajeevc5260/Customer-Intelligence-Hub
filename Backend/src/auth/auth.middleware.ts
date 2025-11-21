import type { Request, Response, NextFunction } from "express";
import { supabasePublic } from "./supabase.js";
import { db } from "../db/drizzle.js";
import { appUsers } from "../db/schema.js";
import { eq } from "drizzle-orm";

export interface AuthedUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Must be: Authorization: Bearer <token>
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  // Extract token
  const token = authHeader.substring(7).trim();

  if (!token) {
    return res.status(401).json({ error: "Bearer token missing" });
  }

  // Validate token with Supabase
  const { data, error } = await supabasePublic.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Fetch internal user record
  const rows = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.id, data.user.id))
    .limit(1);

  const appUser = rows[0];

  if (!appUser) {
    return res.status(403).json({ error: "User exists in Supabase but not in app_users" });
  }

  // Attach app user to request
  req.user = {
    id: appUser.id,
    email: appUser.email,
    fullName: appUser.fullName,
    role: appUser.role ?? "member",
  };

  next();
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    if (req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}

export function requireAnyRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden, You are not authorized to do this action" });
    }

    next();
  };
}
