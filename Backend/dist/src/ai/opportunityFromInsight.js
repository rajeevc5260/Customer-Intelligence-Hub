import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { db } from "../db/drizzle.js";
import { appUsers, clients, stakeholders, projects, insights, opportunities, tasks } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
function cleanJson(str) {
    return str
        .replace(/```json/i, "")
        .replace(/```/g, "")
        .trim();
}
async function pickUserForTeam(team, fallbackUserId) {
    if (team) {
        const rows = await db
            .select()
            .from(appUsers)
            .where(eq(appUsers.team, team))
            .limit(1);
        if (rows[0])
            return rows[0].id;
    }
    return fallbackUserId;
}
/**
 * Generate ONE opportunity + tasks from a batch of 5 insights.
 * @param insightsList Array of 5 full insight rows
 */
export async function generateOpportunityAndTasksFromInsightBatch(insightsList) {
    if (!Array.isArray(insightsList) || insightsList.length === 0) {
        throw new Error("No insights provided to batch generator");
    }
    if (insightsList.length !== 5) {
        console.warn("[WARNING] Batch size is not 5. Proceeding anyway.");
    }
    const lastInsight = insightsList[0]; // newest item
    const clientId = lastInsight.clientId;
    if (!clientId) {
        throw new Error("Batched insights missing clientId");
    }
    // === Load Client Context ===
    const [clientRow] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
    // === Load Stakeholders & Projects Context for all 5 insights ===
    const stakeholderIds = insightsList
        .map(i => i.stakeholderId)
        .filter(Boolean);
    const projectIds = insightsList
        .map(i => i.projectId)
        .filter(Boolean);
    const stakeholderRows = stakeholderIds.length
        ? await db.select().from(stakeholders).where(inArray(stakeholders.id, stakeholderIds))
        : [];
    const projectRows = projectIds.length
        ? await db.select().from(projects).where(inArray(projects.id, projectIds))
        : [];
    // === Load Authors involved ===
    const authorIds = insightsList
        .map(i => i.authorId)
        .filter(Boolean);
    const authorRows = authorIds.length
        ? await db.select().from(appUsers).where(inArray(appUsers.id, authorIds))
        : [];
    // Build combined context object
    const contextPayload = {
        insights: insightsList,
        client: clientRow || null,
        stakeholders: stakeholderRows,
        projects: projectRows,
        authors: authorRows,
    };
    // === Ask Claude to analyze BATCH of insights ===
    const aiResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        temperature: 0.2,
        system: `
You are a senior consulting & sales AI.
You must analyze *five insights together* and propose:

- ONE unified opportunity
- 1–5 tasks that logically follow from the *combined* insights

Rules:
- Output ONLY valid JSON — no markdown.
- Be specific, concise, and actionable.
- Tasks must include:
  - assignedToTeam
  - priority
  - dueDate (ISO YYYY-MM-DD, never past)
- If urgency appears in ANY of the insights, treat the entire batch as urgent.
- If conflicting information appears, pick the dominant theme from the majority of insights.
-Ignore irrelevant responses completely.
-Use only meaningful ones.
    `,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `
From the following 5 INSIGHTS + CONTEXT, generate:
1) ONE actionable opportunity
2) 1–5 tasks to pursue it

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
      "assignedToTeam": "sales | consulting | practice | ops",
      "priority": "low | medium | high",
      "dueDate": "YYYY-MM-DD"
    }
  ]
}

FULL BATCH CONTEXT:
${JSON.stringify(contextPayload, null, 2)}
                    `
                    }
                ]
            }
        ]
    });
    const textBlock = aiResponse.content.find(b => b.type === "text");
    if (!textBlock)
        throw new Error("AI returned no text");
    const cleaned = cleanJson(textBlock.text);
    console.log("[BATCH OPP AI OUTPUT] =>", cleaned);
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    }
    catch {
        console.error("[AI JSON PARSE ERROR]", cleaned);
        throw new Error("AI returned invalid JSON");
    }
    const opp = parsed.opportunity || {};
    const tasksArr = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    // === Insert Opportunity ===
    const oppId = crypto.randomUUID();
    await db.insert(opportunities).values({
        id: oppId,
        clientId,
        insightId: lastInsight.id, // link to the newest insight
        title: opp.title || "Untitled Opportunity",
        description: opp.description || null,
        valueEstimate: opp.valueEstimate || null,
        stage: "identified",
    });
    // === Insert Tasks ===
    const taskIds = [];
    for (const t of tasksArr) {
        const taskId = crypto.randomUUID();
        const assignedToTeam = (t.assignedToTeam || "").toLowerCase();
        const assignedUser = await pickUserForTeam(assignedToTeam, lastInsight.authorId);
        let dueDate = null;
        if (t.dueDate) {
            const d = new Date(t.dueDate);
            if (!isNaN(d.getTime()))
                dueDate = d;
        }
        await db.insert(tasks).values({
            id: taskId,
            assignedTo: assignedUser,
            insightId: lastInsight.id,
            opportunityId: oppId,
            title: t.title,
            description: t.description || null,
            priority: t.priority || "medium",
            status: "open",
            dueDate,
        });
        taskIds.push(taskId);
    }
    return {
        opportunityId: oppId,
        taskIds
    };
}
