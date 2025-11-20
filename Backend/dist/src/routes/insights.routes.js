import express from "express";
import { db } from "../db/drizzle.js";
import { appUsers, clients, insights } from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { desc, eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { enrichInsightWithAI } from "../ai/insightEnrichment.js";
import { generateOpportunityAndTasksFromInsightBatch } from "../ai/opportunityFromInsight.js";
export const insightsRouter = express.Router();
// LIST INSIGHTS (optionally by client)
insightsRouter.get("/", requireAuth, async (req, res) => {
    const clientId = req.query.clientId;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const baseQuery = db
        .select({
        id: insights.id,
        clientId: insights.clientId,
        projectId: insights.projectId,
        stakeholderId: insights.stakeholderId,
        authorId: insights.authorId,
        rawText: insights.rawText,
        summary: insights.summary,
        themes: insights.themes,
        timeHorizon: insights.timeHorizon,
        budgetSignal: insights.budgetSignal,
        competitorMention: insights.competitorMention,
        status: insights.status,
        createdAt: insights.createdAt,
        authorEmail: appUsers.email,
        authorFullName: appUsers.fullName,
    })
        .from(insights)
        .leftJoin(appUsers, eq(appUsers.id, insights.authorId));
    const data = clientId
        ? await baseQuery.where(eq(insights.clientId, clientId)).orderBy(desc(insights.createdAt)).limit(limit)
        : await baseQuery.orderBy(desc(insights.createdAt)).limit(limit);
    res.json(data.map((row) => ({
        id: row.id,
        clientId: row.clientId,
        projectId: row.projectId,
        stakeholderId: row.stakeholderId,
        authorId: row.authorId,
        rawText: row.rawText,
        summary: row.summary,
        themes: row.themes,
        timeHorizon: row.timeHorizon,
        budgetSignal: row.budgetSignal,
        competitorMention: row.competitorMention,
        status: row.status,
        createdAt: row.createdAt,
        author: row.authorId
            ? {
                id: row.authorId,
                email: row.authorEmail,
                fullName: row.authorFullName,
            }
            : null,
    })));
});
// CREATE INSIGHT (AI ENRICHED)
insightsRouter.post("/", requireAuth, requireAnyRole("consultant", "leader"), async (req, res) => {
    const { clientId, projectId, stakeholderId, rawText } = req.body;
    if (!clientId)
        return res.status(400).json({ error: "clientId is required" });
    if (!rawText)
        return res.status(400).json({ error: "rawText is required" });
    const id = crypto.randomUUID();
    // 🔥 AI ENRICHMENT
    let ai;
    try {
        ai = await enrichInsightWithAI(clientId, rawText);
    }
    catch (err) {
        return res.status(500).json({
            error: "AI enrichment failed",
            message: err.message,
        });
    }
    // Insert enriched insight
    await db.insert(insights).values({
        id,
        authorId: req.user.id,
        clientId,
        projectId: projectId || ai.selectedProjectId || null,
        stakeholderId: stakeholderId || ai.selectedStakeholderId || null,
        rawText,
        summary: ai.summary,
        themes: ai.themes,
        timeHorizon: ai.timeHorizon,
        budgetSignal: ai.budgetSignal,
        competitorMention: ai.competitorMention,
        status: "pending",
    });
    res.json({
        success: true,
        id,
        data: ai,
    });
});
// APPROVE INSIGHT + AUTO GENERATE OPPORTUNITY & TASKS
insightsRouter.post("/:id/approve", requireAuth, async (req, res) => {
    const { id } = req.params;
    const rows = await db
        .select()
        .from(insights)
        .where(eq(insights.id, id))
        .limit(1);
    const insight = rows[0];
    if (!insight)
        return res.status(404).json({ error: "Not found" });
    if (req.user.role !== "leader" && insight.authorId !== req.user.id) {
        return res
            .status(403)
            .json({ error: "Only leader or author can approve" });
    }
    let automationResult = {};
    let batchTriggered = false;
    let newCount = 0;
    await db.transaction(async (tx) => {
        // 1) Approve insight
        await tx
            .update(insights)
            .set({ status: "approved" })
            .where(eq(insights.id, id));
        // 2) Atomically increment client's approvedInsightsCount
        const updated = await tx
            .update(clients)
            .set({
            approvedInsightsCount: sql `${clients.approvedInsightsCount} + 1`,
        })
            .where(eq(clients.id, insight.clientId))
            .returning({ count: clients.approvedInsightsCount });
        newCount = updated[0]?.count ?? 0;
        // 3) Only trigger for multiples of 5
        if (newCount % 5 === 0) {
            console.log("Triggering AI batch for approved insights");
            const lastFive = await db
                .select()
                .from(insights)
                .where(eq(insights.clientId, insight.clientId) &&
                eq(insights.status, "approved"))
                .orderBy(sql `${insights.createdAt} DESC`)
                .limit(5);
            automationResult = await generateOpportunityAndTasksFromInsightBatch(lastFive);
            batchTriggered = true;
        }
    });
    res.json({
        success: true,
        batchTriggered,
        batchCount: newCount,
        opportunityId: automationResult.opportunityId ?? null,
        taskIds: automationResult.taskIds ?? [],
    });
});
