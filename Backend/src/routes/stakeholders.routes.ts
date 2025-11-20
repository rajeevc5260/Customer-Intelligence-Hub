import express from "express";
import crypto from "node:crypto";
import { db } from "../db/drizzle.js";
import { stakeholders } from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq } from "drizzle-orm";

export const stakeholdersRouter = express.Router();

// Create stakeholder
// Roles: consultant, leader, admin, ops
stakeholdersRouter.post(
    "/",
    requireAuth,
    requireAnyRole("consultant", "leader", "admin", "ops"),
    async (req, res) => {
        const { clientId, name, role, email, notes } = req.body;

        if (!clientId || !name) {
            return res.status(400).json({ error: "clientId and name are required" });
        }

        const id = crypto.randomUUID();

        await db.insert(stakeholders).values({
            id,
            clientId,
            name,
            role,
            email,
            notes,
        });

        res.json({ success: true, id });
    }
);

// List stakeholders for a client
stakeholdersRouter.get(
    "/by-client/:clientId",
    requireAuth,
    async (req, res) => {
        const { clientId } = req.params;
        const data = await db
            .select()
            .from(stakeholders)
            .where(eq(stakeholders.clientId, clientId));

        res.json(data);
    }
);
