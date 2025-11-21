import express from "express";
import { db } from "../db/drizzle.js";
import {
    campaigns,
    campaignAudience,
    campaignResponses,
    clients,
} from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq, desc, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { enrichCampaignResponse } from "../ai/campaignEnrichment.js";
import { generateOpportunityAndTasksFromCampaignBatch, } from "../ai/opportunityFromCampaign.js";

export const campaignsRouter = express.Router();

// Create campaign (leaders / admin / manager)
campaignsRouter.post(
    "/",
    requireAuth,
    requireAnyRole("leader", "admin", "manager"),
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
campaignsRouter.post(
    "/:id/respond",
    requireAuth,
    requireAnyRole("consultant", "leader"),
    async (req, res) => {
        const { id } = req.params; // campaignId
        const { rawResponse, clientId } = req.body;

        if (!rawResponse)
            return res.status(400).json({ error: "rawResponse required" });

        if (!clientId)
            return res.status(400).json({ error: "clientId is required" });

        // Ensure client exists and avoid FK issues
        const clientRow = await db
            .select()
            .from(clients)
            .where(eq(clients.id, clientId))
            .limit(1);

        if (!clientRow[0]) {
            return res.status(400).json({ error: "Invalid clientId" });
        }

        const responseId = crypto.randomUUID();

        // 🔥 Step 1: AI enrichment
        let ai;
        try {
            ai = await enrichCampaignResponse(rawResponse);
        } catch (err: any) {
            return res.status(500).json({
                error: "AI enrichment failed",
                message: err.message,
            });
        }

        // Step 2: Save response (with clientId)
        await db.insert(campaignResponses).values({
            id: responseId,
            campaignId: id,
            userId: req.user!.id,
            rawResponse,
            summary: ai.summary,
            extractedThemes: JSON.stringify(ai.themes),
            clientId,
        });

        // Step 3: Increment responseCount
        const updated = await db
            .update(campaigns)
            .set({
                responseCount: sql`${campaigns.responseCount} + 1`,
            })
            .where(eq(campaigns.id, id))
            .returning({ count: campaigns.responseCount });

        const newCount = updated[0]?.count ?? 0;

        let batchTriggered = false;
        let batchResult = null;

        // Step 4: If multiple of 5 → trigger batch AI automatically
        if (newCount % 5 === 0) {
            console.log("Triggering batch AI for campaign", id);
            batchTriggered = true;

            const lastFive = await db
                .select()
                .from(campaignResponses)
                .where(eq(campaignResponses.campaignId, id))
                .orderBy(desc(campaignResponses.createdAt))
                .limit(5);

            batchResult = await generateOpportunityAndTasksFromCampaignBatch(lastFive);
        }

        return res.json({
            success: true,
            responseId,
            data: ai,
            batchTriggered,
            opportunityId: batchResult?.opportunityId ?? null,
            taskIds: batchResult?.taskIds ?? [],
            clientId,
            batchNumber: Math.floor(newCount / 5),
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


// // PROMOTE CAMPAIGN RESPONSE → Opportunity + Tasks
// campaignsRouter.post(
//     "/:campaignId/promote",
//     requireAuth,
//     requireAnyRole("leader", "admin", "manager"),
//     async (req, res) => {
//         const { campaignId } = req.params;

//         try {
//             // 1) Increment response_count atomically
//             const updated = await db
//                 .update(campaigns)
//                 .set({
//                     responseCount: sql`${campaigns.responseCount} + 1`,
//                 })
//                 .where(eq(campaigns.id, campaignId))
//                 .returning({ count: campaigns.responseCount });

//             const newCount = updated[0]?.count ?? 0;

//             // 2) Only trigger at 5,10,15,20...
//             let result = null;
//             let triggered = false;

//             if (newCount % 5 === 0) {
//                 triggered = true;

//                 // Fetch last 5 responses for batch processing
//                 const lastFive = await db
//                     .select()
//                     .from(campaignResponses)
//                     .where(eq(campaignResponses.campaignId, campaignId))
//                     .orderBy(desc(campaignResponses.createdAt))
//                     .limit(5);

//                 result = await generateOpportunityAndTasksFromCampaignBatch(lastFive);
//             }

//             res.json({
//                 success: true,
//                 triggered,
//                 batchCount: newCount,
//                 opportunityId: result?.opportunityId || null,
//                 taskIds: result?.taskIds || [],
//                 clientId: result?.clientId || null,
//             });
//         } catch (err: any) {
//             console.error("[PROMOTE ERROR]", err.message);
//             res.status(500).json({
//                 error: "AI batch promotion failed",
//                 message: err.message,
//             });
//         }
//     }
// );