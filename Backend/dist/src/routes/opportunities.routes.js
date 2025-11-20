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
// Create opportunity (leaders / sales / practice leaders)
opportunitiesRouter.post("/", requireAuth, requireAnyRole("leader", "admin", "ops"), async (req, res) => {
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
opportunitiesRouter.post("/:id/stage", requireAuth, requireAnyRole("leader", "admin", "ops"), async (req, res) => {
    const { id } = req.params;
    const { stage } = req.body;
    await db
        .update(opportunities)
        .set({ stage })
        .where(eq(opportunities.id, id));
    res.json({ success: true });
});
