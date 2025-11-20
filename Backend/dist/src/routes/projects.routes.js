import express from "express";
import crypto from "node:crypto";
import { db } from "../db/drizzle.js";
import { projects } from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq } from "drizzle-orm";
export const projectsRouter = express.Router();
// Create project
// Roles: consultant, leader, admin, ops
projectsRouter.post("/", requireAuth, requireAnyRole("consultant", "leader", "admin", "ops"), async (req, res) => {
    const { clientId, name, description, status } = req.body;
    if (!clientId || !name) {
        return res.status(400).json({ error: "clientId and name are required" });
    }
    const id = crypto.randomUUID();
    await db.insert(projects).values({
        id,
        clientId,
        name,
        description,
        status: status ?? "active",
    });
    res.json({ success: true, id });
});
// List projects for a client
projectsRouter.get("/by-client/:clientId", requireAuth, async (req, res) => {
    const { clientId } = req.params;
    const data = await db
        .select()
        .from(projects)
        .where(eq(projects.clientId, clientId));
    res.json(data);
});
