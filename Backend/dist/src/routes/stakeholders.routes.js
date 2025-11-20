import express from "express";
import crypto from "node:crypto";
import { db } from "../db/drizzle.js";
import { stakeholders } from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq, sql, ilike } from "drizzle-orm";
export const stakeholdersRouter = express.Router();
// Create stakeholder
// Roles: consultant, leader, admin, ops
stakeholdersRouter.post("/", requireAuth, requireAnyRole("consultant", "leader", "admin", "ops"), async (req, res) => {
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
});
// List ALL stakeholders (paginated + optional search)
stakeholdersRouter.get("/", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;
    // Fetch paginated stakeholders
    const dataQuery = search
        ? db
            .select()
            .from(stakeholders)
            .where(ilike(stakeholders.name, `%${search}%`))
            .orderBy(stakeholders.createdAt)
            .limit(limit)
            .offset(offset)
        : db
            .select()
            .from(stakeholders)
            .orderBy(stakeholders.createdAt)
            .limit(limit)
            .offset(offset);
    const data = await dataQuery;
    // Count total
    const totalQuery = search
        ? db
            .select({ count: sql `count(*)` })
            .from(stakeholders)
            .where(ilike(stakeholders.name, `%${search}%`))
        : db.select({ count: sql `count(*)` }).from(stakeholders);
    const totalResult = await totalQuery;
    const total = Number(totalResult[0].count);
    res.json({
        success: true,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        data
    });
});
// List stakeholders for a specific client
stakeholdersRouter.get("/by-client/:clientId", requireAuth, async (req, res) => {
    const { clientId } = req.params;
    const data = await db
        .select()
        .from(stakeholders)
        .where(eq(stakeholders.clientId, clientId));
    res.json(data);
});
// Update stakeholder
stakeholdersRouter.put("/:id", requireAuth, requireAnyRole("consultant", "leader", "admin", "ops"), async (req, res) => {
    const { id } = req.params;
    const { clientId, name, role, email, notes } = req.body;
    // Build dynamic update object
    const updateData = {};
    if (clientId !== undefined)
        updateData.clientId = clientId;
    if (name !== undefined)
        updateData.name = name;
    if (role !== undefined)
        updateData.role = role;
    if (email !== undefined)
        updateData.email = email;
    if (notes !== undefined)
        updateData.notes = notes;
    // No fields provided → reject
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
            error: "No valid fields provided for update",
        });
    }
    // Update database
    const updated = await db
        .update(stakeholders)
        .set(updateData)
        .where(eq(stakeholders.id, id))
        .returning();
    if (!updated.length) {
        return res.status(404).json({ error: "Stakeholder not found" });
    }
    res.json({
        success: true,
        message: "Stakeholder updated",
        data: updated[0],
    });
});
