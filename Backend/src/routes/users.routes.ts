import express from "express";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { db } from "../db/drizzle.js";
import { appUsers } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

export const usersRouter = express.Router();

// GET ALL USERS (admin and leader only)
usersRouter.get("/", requireAuth, requireAnyRole("admin", "leader"), async (req, res) => {
  const users = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      fullName: appUsers.fullName,
      role: appUsers.role,
      team: appUsers.team,
      createdAt: appUsers.createdAt,
    })
    .from(appUsers)
    .orderBy(desc(appUsers.createdAt));

  res.json(users);
});

// GET USER BY ID
usersRouter.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  const user = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      fullName: appUsers.fullName,
      role: appUsers.role,
      team: appUsers.team,
    })
    .from(appUsers)
    .where(eq(appUsers.id, id))
    .limit(1);

  if (!user[0]) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user[0]);
});
