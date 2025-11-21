import express from "express";
import { db } from "../db/drizzle.js";
import { opportunities } from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq, ilike, sql } from "drizzle-orm";
import crypto from "node:crypto";
export const opportunitiesRouter = express.Router();
// List opportunities with pagination + search
opportunitiesRouter.get("/", requireAuth, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const offset = (page - 1) * limit;
    // DATA QUERY
    const baseDataQuery = db.select().from(opportunities);
    const filteredDataQuery = search
        ? db
            .select()
            .from(opportunities)
            .where(ilike(opportunities.title, `%${search}%`))
        : baseDataQuery;
    const data = await filteredDataQuery
        .orderBy(opportunities.createdAt)
        .limit(limit)
        .offset(offset);
    // 2️⃣ COUNT QUERY (separate!)
    const baseCountQuery = db
        .select({ count: sql `count(*)` })
        .from(opportunities);
    const filteredCountQuery = search
        ? db
            .select({ count: sql `count(*)` })
            .from(opportunities)
            .where(ilike(opportunities.title, `%${search}%`))
        : baseCountQuery;
    const countResult = await filteredCountQuery;
    const total = Number(countResult[0].count);
    res.json({
        success: true,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        data,
    });
});
// Create opportunity (leaders / sales / leader leaders)
opportunitiesRouter.post("/", requireAuth, requireAnyRole("leader", "admin", "manager"), async (req, res) => {
    const { clientId, insightId, title, description, valueEstimate } = req.body;
    if (!clientId || !title) {
        return res.status(400).json({ error: "clientId and title required" });
    }
    const id = crypto.randomUUID();
    await db.insert(opportunities).values({
        id,
        clientId,
        insightId,
        title,
        description,
        valueEstimate,
        stage: "identified",
    });
    res.json({ success: true, id });
});
// Update stage
opportunitiesRouter.post("/:id/stage", requireAuth, requireAnyRole("leader", "admin", "manager"), async (req, res) => {
    const { id } = req.params;
    const { stage } = req.body;
    await db
        .update(opportunities)
        .set({ stage })
        .where(eq(opportunities.id, id));
    res.json({ success: true });
});
// Update opportunity
opportunitiesRouter.put("/:id", requireAuth, requireAnyRole("leader", "admin", "manager"), async (req, res) => {
    const { id } = req.params;
    const { clientId, insightId, title, description, valueEstimate, stage } = req.body;
    // Build update object dynamically
    const updateData = {};
    if (clientId !== undefined)
        updateData.clientId = clientId;
    if (insightId !== undefined)
        updateData.insightId = insightId;
    if (title !== undefined)
        updateData.title = title;
    if (description !== undefined)
        updateData.description = description;
    if (valueEstimate !== undefined)
        updateData.valueEstimate = valueEstimate;
    if (stage !== undefined)
        updateData.stage = stage;
    // Protect against empty updates
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
            error: "No valid fields provided to update",
        });
    }
    // Update DB
    const updated = await db
        .update(opportunities)
        .set(updateData)
        .where(eq(opportunities.id, id))
        .returning();
    if (!updated.length) {
        return res.status(404).json({ error: "Opportunity not found" });
    }
    res.json({
        success: true,
        message: "Opportunity updated",
        data: updated[0],
    });
});
