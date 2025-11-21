import express from "express";
import crypto from "node:crypto";
import { db } from "../db/drizzle.js";
import { projects } from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq } from "drizzle-orm";

export const projectsRouter = express.Router();

// Create project
// Roles: consultant, leader, admin, manager
projectsRouter.post(
    "/",
    requireAuth,
    requireAnyRole("consultant", "leader", "admin", "manager"),
    async (req, res) => {
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
    }
);

// List projects for a client
projectsRouter.get(
    "/by-client/:clientId",
    requireAuth,
    async (req, res) => {
        const { clientId } = req.params;

        const data = await db
            .select()
            .from(projects)
            .where(eq(projects.clientId, clientId));

        res.json(data);
    }
);

// update projects
projectsRouter.put(
    "/:id",
    requireAuth,
    requireAnyRole("consultant", "leader", "admin", "manager"),
    async (req, res) => {
        const { id } = req.params;
        const { name, description, status } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined) updateData.status = status;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                error: "No fields provided for update",
            });
        }

        const updated = await db
            .update(projects)
            .set(updateData)
            .where(eq(projects.id, id))
            .returning();

        if (!updated.length) {
            return res.status(404).json({ error: "Project not found" });
        }

        res.json({
            success: true,
            message: "Project updated successfully",
            data: updated[0],
        });
    }
);
