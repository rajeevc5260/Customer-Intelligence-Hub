import express from "express";
import { requireAnyRole, requireAuth } from "../auth/auth.middleware.js";
import { db } from "../db/drizzle.js";
import { appUsers } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const profileRouter = express.Router();

profileRouter.get("/", requireAuth, async (req, res) => {
  const user = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.id, (req as any).user.id))
    .limit(1);

  res.json({ user: user[0] });
});

// Update profile
profileRouter.put("/", requireAuth, async (req, res) => {
  const { userId, fullName, team, role } = req.body;

  // Determine which user to update
  let targetUserId: string;
  
  if (userId) {
    // If userId is provided, only admins and leaders can update other users
    if (req.user!.role !== "admin" && req.user!.role !== "leader") {
      return res.status(403).json({
        error: "Only admins and leaders can update other users' profiles",
      });
    }
    targetUserId = userId;
  } else {
    // If no userId provided, update current user's profile
    targetUserId = req.user!.id;
  }

  const updateData: any = {};

  if (fullName !== undefined) updateData.fullName = fullName;
  if (team !== undefined) updateData.team = team;

  // If trying to update role → require admin/leader
  if (role !== undefined) {
    if (req.user!.role !== "admin" && req.user!.role !== "leader") {
      return res.status(403).json({
        error: "Only admin or leader can update roles",
      });
    }
    updateData.role = role;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      error: "Nothing to update",
    });
  }

  const updated = await db
    .update(appUsers)
    .set(updateData)
    .where(eq(appUsers.id, targetUserId))
    .returning();

  if (!updated[0]) {
    return res.status(404).json({
      error: "User not found",
    });
  }

  res.json({
    success: true,
    message: "Profile updated successfully",
    user: updated[0],
  });
});