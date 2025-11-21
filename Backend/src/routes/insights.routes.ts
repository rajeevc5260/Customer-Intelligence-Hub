import express from "express";
import { db } from "../db/drizzle.js";
import { appUsers, clients, insights } from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { desc, eq, sql, and } from "drizzle-orm";
import crypto from "crypto";
import { enrichInsightWithAI } from "../ai/insightEnrichment.js";
import { generateOpportunityAndTasksFromInsightBatch } from "../ai/opportunityFromInsight.js";

export const insightsRouter = express.Router();

// LIST INSIGHTS (optionally by client)
insightsRouter.get("/", requireAuth, async (req, res) => {
  const user = req.user!;
  const role = user.role;
  const userId = user.id;

  const clientId = req.query.clientId as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

  // Build dynamic filters
  let filters: any[] = [];

  // Filter by client if provided
  if (clientId) {
    filters.push(eq(insights.clientId, clientId));
  }

  // Role-based filters
  if (role === "consultant") {
    filters.push(eq(insights.authorId, userId));
  } else if (role === "leader" || role === "manager") {
    // leaders & managers see all → no filter added
  } else {
    // fallback → see only their own
    filters.push(eq(insights.authorId, userId));
  }

  // Combine filters into single expression
  const whereClause =
    filters.length === 0 ? undefined : filters.length === 1
      ? filters[0]
      : and(...filters);

  // Now build final query
  const query = db
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
    .leftJoin(appUsers, eq(appUsers.id, insights.authorId))
    .where(whereClause)   // <—— TYPE SAFE NOW
    .orderBy(desc(insights.createdAt))
    .limit(limit);

  const data = await query;

  res.json(
    data.map((row) => ({
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
    }))
  );
});

// CREATE INSIGHT (AI ENRICHED)
insightsRouter.post(
  "/",
  requireAuth,
  requireAnyRole("consultant"),
  async (req, res) => {
    const { clientId, projectId, stakeholderId, rawText } = req.body;

    if (!clientId) return res.status(400).json({ error: "clientId is required" });
    if (!rawText) return res.status(400).json({ error: "rawText is required" });

    const id = crypto.randomUUID();

    // 1) AI ENRICHMENT
    let ai;
    try {
      ai = await enrichInsightWithAI(clientId, rawText);
    } catch (err: any) {
      return res.status(500).json({
        error: "AI enrichment failed",
        message: err.message,
      });
    }

    let automationResult: { opportunityId?: string; taskIds?: string[] } = {};
    let batchTriggered = false;
    let newCount = 0;

    // 2) Insert + Auto Approve + Batch AI
    await db.transaction(async (tx) => {
      // INSERT insight as approved directly
      await tx.insert(insights).values({
        id,
        authorId: req.user!.id,
        clientId,
        projectId: projectId || ai.selectedProjectId || null,
        stakeholderId: stakeholderId || ai.selectedStakeholderId || null,
        rawText,
        summary: ai.summary,
        themes: ai.themes,
        timeHorizon: ai.timeHorizon,
        budgetSignal: ai.budgetSignal,
        competitorMention: ai.competitorMention,
        status: "approved", // <— AUTO APPROVED HERE
      });

      // UPDATE APPROVED COUNT AT CLIENT LEVEL
      const updated = await tx
        .update(clients)
        .set({
          approvedInsightsCount: sql`${clients.approvedInsightsCount} + 1`,
        })
        .where(eq(clients.id, clientId))
        .returning({ count: clients.approvedInsightsCount });

      newCount = updated[0]?.count ?? 0;

      // TRIGGER BATCH AI AFTER EVERY 5 APPROVED INSIGHTS
      if (newCount % 5 === 0) {
        const lastFive = await db
          .select()
          .from(insights)
          .where(eq(insights.clientId, clientId))
          .orderBy(sql`${insights.createdAt} DESC`)
          .limit(5);

        automationResult = await generateOpportunityAndTasksFromInsightBatch(lastFive);
        batchTriggered = true;
      }
    });

    // 3) Final response
    res.json({
      success: true,
      id,
      autoApproved: true,
      batchTriggered,
      batchCount: newCount,
      opportunityId: automationResult.opportunityId ?? null,
      taskIds: automationResult.taskIds ?? [],
      data: ai,
    });
  }
);