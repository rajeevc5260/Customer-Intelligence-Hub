import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { db } from "../db/drizzle.js";
import {
    appUsers,
    clients,
    campaignResponses,
    opportunities,
    tasks
} from "../db/schema.js";
import { eq, inArray, ilike } from "drizzle-orm";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
});

function cleanJson(str: string) {
    return str
        .replace(/```json/i, "")
        .replace(/```/g, "")
        .trim();
}

// Use fuzzy search to infer client context
async function guessClient(raw: string) {
    const like = `%${raw.slice(0, 30)}%`;
    const matches = await db
        .select()
        .from(clients)
        .where(ilike(clients.name, like));

    return matches[0] || null;
}

async function pickUserForTeam(team: string | undefined, fallbackUserId: string | null) {
    if (team) {
        const rows = await db
            .select()
            .from(appUsers)
            .where(eq(appUsers.team, team))
            .limit(1);
        if (rows[0]) return rows[0].id;
    }
    return fallbackUserId;
}

/**
 * BATCH AI: Generate ONE opportunity + tasks from 5 responses.
 * This version automatically ignores irrelevant responses.
 */
export async function generateOpportunityAndTasksFromCampaignBatch(responseList: any[]) {
    if (!Array.isArray(responseList) || responseList.length === 0) {
        throw new Error("No responses provided to batch generator");
    }

    const newest = responseList[0];

    // Since users now pass clientId explicitly, we take newest.clientId
    const clientId = newest.clientId;

    if (!clientId) {
        console.warn("[BATCH WARNING] No clientId provided in responses.");
        return {
            opportunityId: null,
            taskIds: [],
            clientId: null,
            skipped: true,
        };
    }

    // Load client
    const clientRow = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);

    if (!clientRow[0]) {
        console.warn("[BATCH WARNING] Invalid clientId in responses.");
        return {
            opportunityId: null,
            taskIds: [],
            clientId,
            skipped: true,
        };
    }

    const authors = await db
        .select()
        .from(appUsers)
        .where(inArray(appUsers.id, responseList.map(r => r.userId)));

    const contextPayload = {
        responses: responseList,
        authors,
        client: clientRow[0],
    };

    // ==== AI CALL ====
    const aiResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        temperature: 0.2,
        system: `
Ignore irrelevant responses completely.
Use only meaningful ones.
Output valid JSON only.
`,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `
Generate ONE opportunity and tasks for client: ${clientRow[0].name}

Use only relevant responses.

STRICT JSON RESPONSE ONLY:

{
  "opportunity": {
    "title": "string",
    "description": "string",
    "valueEstimate": "string | null"
  },
  "tasks": [
    {
      "title": "string",
      "description": "string | null",
      "assignedToTeam": "sales | consulting | leader | manager",
      "priority": "low | medium | high",
      "dueDate": "YYYY-MM-DD"
    }
  ]
}
Here manager is sales manager we call it as manager, leader is **Executive Leadership**

BATCH CONTEXT:
${JSON.stringify(contextPayload, null, 2)}
`
                    }
                ]
            }
        ]
    });

    const textContent = aiResponse.content.find(b => b.type === "text");
    if (!textContent || typeof textContent.text !== "string") {
        throw new Error("AI response did not include required text content.");
    }
    const cleaned = cleanJson(textContent.text);
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err) {
        throw new Error("Failed to parse cleaned AI response: " + cleaned);
    }

    // Insert Opportunity
    const oppId = crypto.randomUUID();

    await db.insert(opportunities).values({
        id: oppId,
        clientId,
        insightId: null,
        title: parsed.opportunity?.title || "Untitled Opportunity",
        description: parsed.opportunity?.description || null,
        valueEstimate: parsed.opportunity?.valueEstimate || null,
        stage: "identified",
    });

    // Insert Tasks
    const taskIds = [];

    for (const t of parsed.tasks || []) {
        const taskId = crypto.randomUUID();

        const assignedUser = await pickUserForTeam(
            t.assignedToTeam,
            newest.userId
        );

        await db.insert(tasks).values({
            id: taskId,
            assignedTo: assignedUser,
            opportunityId: oppId,
            insightId: null,
            title: t.title,
            description: t.description ?? null,
            priority: t.priority ?? "medium",
            status: "open",
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
        });

        taskIds.push(taskId);
    }

    return {
        opportunityId: oppId,
        taskIds,
        clientId,
    };
}

