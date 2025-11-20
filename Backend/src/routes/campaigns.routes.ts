import express from "express";
import { db } from "../db/drizzle.js";
import {
    campaigns,
    campaignAudience,
    campaignResponses,
} from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { enrichCampaignResponse } from "../ai/campaignEnrichment.js";
import { generateOpportunityAndTasksFromCampaignResponse } from "../ai/opportunityFromCampaign.js";

export const campaignsRouter = express.Router();

// Create campaign (leaders / admin / ops)
campaignsRouter.post(
    "/",
    requireAuth,
    requireAnyRole("leader", "admin", "ops"),
    async (req, res) => {
        const { topic, description, questions, audienceUserIds } = req.body;

        if (!topic) return res.status(400).json({ error: "topic required" });

        const id = crypto.randomUUID();

        await db.insert(campaigns).values({
            id,
            createdBy: req.user!.id,
            topic,
            description,
            questions: questions ? JSON.stringify(questions) : null,
        });

        if (Array.isArray(audienceUserIds) && audienceUserIds.length > 0) {
            const rows = audienceUserIds.map((userId: string) => ({
                id: crypto.randomUUID(),
                campaignId: id,
                userId,
            }));
            await db.insert(campaignAudience).values(rows);
        }

        res.json({ success: true, id });
    }
);

// List campaigns (everyone can see active)
campaignsRouter.get("/", requireAuth, async (req, res) => {
    const data = await db.select().from(campaigns).orderBy(campaigns.createdAt);
    res.json(data);
});

// Submit response (consultants)
// Submit response (consultants)
campaignsRouter.post(
    "/:id/respond",
    requireAuth,
    requireAnyRole("consultant", "leader"),
    async (req, res) => {
        const { id } = req.params;
        const { rawResponse } = req.body;

        if (!rawResponse)
            return res.status(400).json({ error: "rawResponse required" });

        const responseId = crypto.randomUUID();

        // 🔥 AI enrichment
        let ai;
        try {
            ai = await enrichCampaignResponse(rawResponse);
        } catch (err: any) {
            return res.status(500).json({
                error: "AI enrichment failed",
                message: err.message,
            });
        }

        await db.insert(campaignResponses).values({
            id: responseId,
            campaignId: id,
            userId: req.user!.id,
            rawResponse,
            summary: ai.summary,
            extractedThemes: JSON.stringify(ai.themes),
        });

        res.json({
            success: true,
            id: responseId,
            aiFilled: ai,
        });
    }
);

// List responses for a campaign (leaders/exec/admin)
campaignsRouter.get(
    "/:id/responses",
    requireAuth,
    requireAnyRole("leader", "admin", "executive"),
    async (req, res) => {
        const { id } = req.params;

        const data = await db
            .select()
            .from(campaignResponses)
            .where(eq(campaignResponses.campaignId, id))
            .orderBy(campaignResponses.createdAt);

        res.json(data);
    }
);


// PROMOTE CAMPAIGN RESPONSE → Opportunity + Tasks
campaignsRouter.post(
    "/:campaignId/responses/:responseId/promote",
    requireAuth,
    requireAnyRole("leader", "admin", "ops"),
    async (req, res) => {
        const { responseId } = req.params;

        try {
            const result = await generateOpportunityAndTasksFromCampaignResponse(
                responseId
            );

            res.json({
                success: true,
                opportunityId: result.opportunityId,
                taskIds: result.taskIds,
                clientId: result.clientId,
            });
        } catch (err: any) {
            console.error("[PROMOTE ERROR]", err.message);
            res.status(500).json({
                error: "AI promotion failed",
                message: err.message,
            });
        }
    }
);