import express from "express";
import { db } from "../db/drizzle.js";
import {
    campaigns,
    campaignAudience,
    campaignResponses,
    clients,
} from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq, desc, sql, and } from "drizzle-orm";
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

// Update campaign status (leader can update all, manager can only update campaigns they created)
campaignsRouter.put(
    "/:id/status",
    requireAuth,
    requireAnyRole("leader", "admin", "manager"),
    async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !["active", "closed"].includes(status)) {
            return res.status(400).json({ error: "status must be 'active' or 'closed'" });
        }

        // Get the campaign to check ownership
        const campaign = await db
            .select()
            .from(campaigns)
            .where(eq(campaigns.id, id))
            .limit(1);

        if (!campaign[0]) {
            return res.status(404).json({ error: "Campaign not found" });
        }

        // Check permissions: leader/admin can update all, manager can only update their own
        if (req.user!.role === "manager" && campaign[0].createdBy !== req.user!.id) {
            return res.status(403).json({
                error: "You can only update campaigns you created",
            });
        }

        const updated = await db
            .update(campaigns)
            .set({ status })
            .where(eq(campaigns.id, id))
            .returning();

        res.json({ success: true, campaign: updated[0] });
    }
);

// Delete campaign (leader can delete all, manager can only delete campaigns they created)
campaignsRouter.delete(
    "/:id",
    requireAuth,
    requireAnyRole("leader", "admin", "manager"),
    async (req, res) => {
        const { id } = req.params;

        // Get the campaign to check ownership
        const campaign = await db
            .select()
            .from(campaigns)
            .where(eq(campaigns.id, id))
            .limit(1);

        if (!campaign[0]) {
            return res.status(404).json({ error: "Campaign not found" });
        }

        // Check permissions: leader/admin can delete all, manager can only delete their own
        if (req.user!.role === "manager" && campaign[0].createdBy !== req.user!.id) {
            return res.status(403).json({
                error: "You can only delete campaigns you created",
            });
        }

        // Count responses before deletion (for logging/audit)
        const responsesToDelete = await db
            .select()
            .from(campaignResponses)
            .where(eq(campaignResponses.campaignId, id));
        const responseCount = responsesToDelete.length;

        // Count audience members before deletion
        const audienceToDelete = await db
            .select()
            .from(campaignAudience)
            .where(eq(campaignAudience.campaignId, id));
        const audienceCount = audienceToDelete.length;

        // Delete in correct order to respect FK constraints:
        // 1. Delete campaign audience first (FK constraint)
        await db.delete(campaignAudience).where(eq(campaignAudience.campaignId, id));

        // 2. Delete campaign responses (FK constraint) - CRITICAL for AI process tracking
        await db.delete(campaignResponses).where(eq(campaignResponses.campaignId, id));

        // 3. Delete the campaign itself
        await db.delete(campaigns).where(eq(campaigns.id, id));

        console.log(`[CAMPAIGN DELETE] Campaign ${id} deleted. Removed ${responseCount} responses and ${audienceCount} audience members.`);

        res.json({ 
            success: true, 
            message: "Campaign deleted successfully",
            deletedResponses: responseCount,
            deletedAudience: audienceCount
        });
    }
);

// List responses for a campaign (role-based filtering)
campaignsRouter.get(
    "/:id/responses",
    requireAuth,
    requireAnyRole("leader", "admin", "manager", "consultant"),
    async (req, res) => {
        const { id } = req.params;
        const user = req.user!;
        const userRole = user.role;
        const userId = user.id;

        // First, get the campaign to check createdBy
        const campaign = await db
            .select()
            .from(campaigns)
            .where(eq(campaigns.id, id))
            .limit(1);

        if (!campaign[0]) {
            return res.status(404).json({ error: "Campaign not found" });
        }

        // Build filters based on role
        const filters = [eq(campaignResponses.campaignId, id)];

        if (userRole === "consultant") {
            // Consultants see only their own responses
            filters.push(eq(campaignResponses.userId, userId));
        } else if (userRole === "manager") {
            // Managers see only responses from campaigns they created
            if (campaign[0].createdBy !== userId) {
                return res.json([]); // Return empty array if not the creator
            }
            // No additional filter needed - already filtered by campaignId
        } else if (userRole === "leader" || userRole === "admin") {
            // Leaders and admins see all responses
            // No additional filter needed
        }

        // Build final query
        const whereClause = filters.length === 1 ? filters[0] : and(...filters);
        const data = await db
            .select()
            .from(campaignResponses)
            .where(whereClause)
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