import express from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { db } from "../db/drizzle.js";
import { appUsers } from "../db/schema.js";
import { eq } from "drizzle-orm";
export const profileRouter = express.Router();
profileRouter.get("/", requireAuth, async (req, res) => {
    const user = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.id, req.user.id))
        .limit(1);
    res.json({ user: user[0] });
});
