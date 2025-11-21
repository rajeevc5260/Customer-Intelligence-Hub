import express from "express";
import crypto from "node:crypto";
import { db } from "../db/drizzle.js";
import { tasks } from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq, ilike, sql } from "drizzle-orm";

export const tasksRouter = express.Router();

/* ---------------------------
   CREATE TASK
   Roles: consultant, leader, admin, manager
----------------------------- */
tasksRouter.post(
    "/",
    requireAuth,
    requireAnyRole("consultant", "leader", "admin", "manager"),
    async (req, res) => {
        const { assignedTo, insightId, opportunityId, title, description, priority, dueDate } = req.body;

        if (!title) {
            return res.status(400).json({ error: "title is required" });
        }

        const id = crypto.randomUUID();

        await db.insert(tasks).values({
            id,
            assignedTo: assignedTo || null,
            insightId: insightId || null,
            opportunityId: opportunityId || null,
            title,
            description: description || null,
            priority: priority || "medium",
            status: "open",
            dueDate: dueDate ? new Date(dueDate) : null,
        });

        res.json({ success: true, id });
    }
);

/* ---------------------------
   LIST ALL TASKS (Paginated + Search)
----------------------------- */
tasksRouter.get(
    "/",
    requireAuth,
    async (req, res) => {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string) || "";

        const offset = (page - 1) * limit;

        // DATA QUERY
        const baseDataQuery = db.select().from(tasks);
        const filteredDataQuery = search
            ? db
                  .select()
                  .from(tasks)
                  .where(ilike(tasks.title, `%${search}%`))
            : baseDataQuery;

        const data = await filteredDataQuery
            .orderBy(tasks.createdAt)
            .limit(limit)
            .offset(offset);

        // COUNT QUERY
        const baseCountQuery = db.select({ count: sql<number>`count(*)` }).from(tasks);
        const filteredCountQuery = search
            ? db
                  .select({ count: sql<number>`count(*)` })
                  .from(tasks)
                  .where(ilike(tasks.title, `%${search}%`))
            : baseCountQuery;

        const total = Number((await filteredCountQuery)[0].count);

        res.json({
            success: true,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data,
        });
    }
);

/* ---------------------------
   LIST TASKS BY OPPORTUNITY
----------------------------- */
tasksRouter.get(
    "/by-opportunity/:opportunityId",
    requireAuth,
    async (req, res) => {
        const { opportunityId } = req.params;

        const data = await db
            .select()
            .from(tasks)
            .where(eq(tasks.opportunityId, opportunityId))
            .orderBy(tasks.createdAt);

        res.json({ success: true, data });
    }
);

/* ---------------------------
   LIST TASKS BY INSIGHT
----------------------------- */
tasksRouter.get(
    "/by-insight/:insightId",
    requireAuth,
    async (req, res) => {
        const { insightId } = req.params;

        const data = await db
            .select()
            .from(tasks)
            .where(eq(tasks.insightId, insightId))
            .orderBy(tasks.createdAt);

        res.json({ success: true, data });
    }
);

/* ---------------------------
   UPDATE TASK (title, description, dueDate, priority, assignedTo)
----------------------------- */
tasksRouter.put(
    "/:id",
    requireAuth,
    requireAnyRole("consultant", "leader", "admin", "manager"),
    async (req, res) => {
        const { id } = req.params;
        const { title, description, priority, dueDate, assignedTo } = req.body;

        await db
            .update(tasks)
            .set({
                ...(title && { title }),
                ...(description && { description }),
                ...(priority && { priority }),
                ...(assignedTo && { assignedTo }),
                ...(dueDate && { dueDate: new Date(dueDate) }),
            })
            .where(eq(tasks.id, id));

        res.json({ success: true });
    }
);

/* ---------------------------
   UPDATE TASK STATUS (open → in-progress → done)
----------------------------- */
tasksRouter.post(
    "/:id/status",
    requireAuth,
    async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) return res.status(400).json({ error: "status required" });

        await db
            .update(tasks)
            .set({ status })
            .where(eq(tasks.id, id));

        res.json({ success: true });
    }
);

/* ---------------------------
   DELETE TASK
----------------------------- */
tasksRouter.delete(
    "/:id",
    requireAuth,
    requireAnyRole("leader", "admin", "manager"),
    async (req, res) => {
        const { id } = req.params;

        await db.delete(tasks).where(eq(tasks.id, id));

        res.json({ success: true });
    }
);
