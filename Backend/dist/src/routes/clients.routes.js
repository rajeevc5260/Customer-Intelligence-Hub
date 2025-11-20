import express from "express";
import { db } from "../db/drizzle.js";
import { clients } from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
export const clientsRouter = express.Router();
// List all clients (leaders, execs, consultants can see)
clientsRouter.get("/", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    // Fetch paginated clients
    const data = await db
        .select()
        .from(clients)
        .orderBy(clients.createdAt)
        .limit(limit)
        .offset(offset);
    // Count total clients
    const totalResult = await db
        .select({ count: sql `count(*)` })
        .from(clients);
    const total = Number(totalResult[0].count);
    const totalPages = Math.ceil(total / limit);
    res.json({
        success: true,
        page,
        limit,
        total,
        totalPages,
        data,
    });
});
// Create client (leaders, admin, ops)
clientsRouter.post("/", requireAuth, requireAnyRole("admin", "leader", "ops"), async (req, res) => {
    const { name, industry, description } = req.body;
    if (!name)
        return res.status(400).json({ error: "Name required" });
    const id = crypto.randomUUID();
    await db.insert(clients).values({ id, name, industry, description });
    res.json({ success: true, id });
});
// Simple read by id
clientsRouter.get("/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!rows[0])
        return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
});
