import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { db } from "../db/drizzle.js";
import {
    appUsers,
    clients,
    stakeholders,
    projects,
    campaignResponses,
    opportunities,
    tasks,
} from "../db/schema.js";
import { eq, ilike } from "drizzle-orm";

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

export async function generateOpportunityAndTasksFromCampaignResponse(
    responseId: string
) {
    // 1) Load the campaign response
    const rows = await db
        .select()
        .from(campaignResponses)
        .where(eq(campaignResponses.id, responseId))
        .limit(1);

    const response = rows[0];
    if (!response) throw new Error("Response not found");

    // 2) Guess client (campaigns are cross-client, so we infer)
    const client = await guessClient(response.rawResponse);

    // 3) Load response author
    const [author] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.id, response.userId))
        .limit(1);

    // 4) AI call
    const aiResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 900,
        temperature: 0.2,
        system: `
You must return ONLY valid JSON.
Generate an opportunity and tasks based on campaign response.
Include dueDate as ISO YYYY-MM-DD.
Follow urgency rules:
- Urgent themes → 7–14 days
- Medium → 14–30 days
- Low → 30–45 days
Never past dates.
    `,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `
Generate ONE opportunity + several follow-up tasks from this CAMPAIGN RESPONSE.

RESPONSE:
${JSON.stringify(response, null, 2)}

GUESSED CLIENT:
${JSON.stringify(client, null, 2)}

AUTHOR:
${JSON.stringify(author, null, 2)}

OUTPUT STRICT JSON:
{
  "opportunity": {
    "title": "short title",
    "description": "2–4 sentence description",
    "valueEstimate": "string numeric estimate or null"
  },
  "tasks": [
    {
      "title": "task title",
      "description": "optional",
      "assignedToTeam": "sales | consulting | practice | ops",
      "priority": "high | medium | low",
      "dueDate": "YYYY-MM-DD"
    }
  ]
}
            `,
                    },
                ],
            },
        ],
    });

    const textBlock = aiResponse.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("AI returned no text");

    const cleaned = cleanJson(textBlock.text);
    console.log("[PROMOTE AI OUTPUT] =>", cleaned);

    let parsed: any;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err) {
        console.error("[PROMOTE AI JSON ERROR] =>", cleaned);
        throw new Error("Invalid AI JSON");
    }

    const oppData = parsed.opportunity || {};
    const tasksData: any[] = parsed.tasks || [];

    const clientId = client ? client.id : null;

    // 5) Create Opportunity
    const oppId = crypto.randomUUID();

    await db.insert(opportunities).values({
        id: oppId,
        clientId: clientId ?? '', // ensure no nulls for DB insert
        insightId: null, // from campaign, not insight
        title: oppData.title ?? '',
        description: oppData.description,
        valueEstimate: oppData.valueEstimate,
        stage: "identified",
    });

    // 6) Insert Tasks
    const taskIds: string[] = [];

    for (const t of tasksData) {
        const taskId = crypto.randomUUID();

        const assignedUserId = await pickUserForTeam(
            t.assignedToTeam,
            author?.id ?? null
        );

        const due = t.dueDate ? new Date(t.dueDate) : null;

        await db.insert(tasks).values({
            id: taskId,
            assignedTo: assignedUserId,
            opportunityId: oppId,
            insightId: null,
            title: t.title,
            description: t.description || null,
            priority: t.priority || "medium",
            dueDate: due,
            status: "open",
        });

        taskIds.push(taskId);
    }

    return {
        opportunityId: oppId,
        taskIds,
        clientId,
    };
}
