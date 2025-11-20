import express from "express";
import { db } from "../db/drizzle.js";
import { insights } from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { enrichInsightWithAI } from "../ai/insightEnrichment.js";
import { generateOpportunityAndTasksFromInsight } from "../ai/opportunityFromInsight.js";

export const insightsRouter = express.Router();

// CREATE INSIGHT (AI ENRICHED)
insightsRouter.post(
  "/",
  requireAuth,
  requireAnyRole("consultant", "leader"),
  async (req, res) => {
    const { clientId, projectId, stakeholderId, rawText } = req.body;

    if (!clientId) return res.status(400).json({ error: "clientId is required" });
    if (!rawText) return res.status(400).json({ error: "rawText is required" });

    const id = crypto.randomUUID();

    // 🔥 AI ENRICHMENT
    let ai;
    try {
      ai = await enrichInsightWithAI(clientId, rawText);
    } catch (err: any) {
      return res.status(500).json({
        error: "AI enrichment failed",
        message: err.message,
      });
    }

    // Insert enriched insight
    await db.insert(insights).values({
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
      status: "pending",
    });

    res.json({
      success: true,
      id,
      aiFilled: ai,
    });
  }
);

// APPROVE INSIGHT + AUTO GENERATE OPPORTUNITY & TASKS
insightsRouter.post("/:id/approve", requireAuth, async (req, res) => {
  const { id } = req.params;

  const rows = await db
    .select()
    .from(insights)
    .where(eq(insights.id, id))
    .limit(1);

  const insight = rows[0];
  if (!insight) return res.status(404).json({ error: "Not found" });

  if (req.user!.role !== "leader" && insight.authorId !== req.user!.id) {
    return res
      .status(403)
      .json({ error: "Only leader or author can approve" });
  }

  // Approve the insight
  await db
    .update(insights)
    .set({ status: "approved" })
    .where(eq(insights.id, id));

  // Trigger AI opportunity + task generation
  let automationResult: { opportunityId?: string; taskIds?: string[] } = {};
  try {
    automationResult = await generateOpportunityAndTasksFromInsight(id);
  } catch (err: any) {
    console.error("[OPP/TASK AI ERROR] =>", err.message);
    // We don't fail the approval if AI fails
  }

  res.json({
    success: true,
    opportunityId: automationResult.opportunityId ?? null,
    taskIds: automationResult.taskIds ?? [],
  });
});

// LIST INSIGHTS BY CLIENT
insightsRouter.get("/by-client/:clientId", requireAuth, async (req, res) => {
  const { clientId } = req.params;

  const data = await db
    .select()
    .from(insights)
    .where(eq(insights.clientId, clientId))
    .orderBy(insights.createdAt);

  res.json(data);
});
