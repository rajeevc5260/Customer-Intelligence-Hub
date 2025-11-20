import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { db } from "../db/drizzle.js";
import {
    appUsers,
    clients,
    stakeholders,
    projects,
    insights,
    opportunities,
    tasks,
} from "../db/schema.js";
import { eq } from "drizzle-orm";

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
});

function cleanJson(str: string) {
    return str
        .replace(/```json/i, "")
        .replace(/```/g, "")
        .trim();
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

export async function generateOpportunityAndTasksFromInsight(insightId: string) {
    // 1) Load the insight
    const insightRows = await db
        .select()
        .from(insights)
        .where(eq(insights.id, insightId))
        .limit(1);

    const insight = insightRows[0];
    if (!insight) throw new Error("Insight not found");

    if (!insight.clientId) {
        throw new Error("Insight has no clientId; cannot generate opportunity");
    }

    // 2) Load related context
    const [clientRow] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, insight.clientId))
        .limit(1);

    const stakeholderRow =
        insight.stakeholderId
            ? (
                await db
                    .select()
                    .from(stakeholders)
                    .where(eq(stakeholders.id, insight.stakeholderId))
                    .limit(1)
            )[0]
            : null;

    const projectRow =
        insight.projectId
            ? (
                await db
                    .select()
                    .from(projects)
                    .where(eq(projects.id, insight.projectId))
                    .limit(1)
            )[0]
            : null;

    const [authorRow] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.id, insight.authorId))
        .limit(1);

    // 3) Ask AI to propose opportunity + tasks (with due dates)
    const aiResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 900,
        temperature: 0.2,
        system: `
You are a sales and consulting assistant.
You MUST return ONLY valid JSON. No markdown, no backticks, no comments.

Use this logic for due dates:
- If the insight sounds urgent (renewal, risk, "this quarter", "Q1", "Q2") → tasks due within 7–14 days.
- If medium urgency (PoC this year, initiative this half-year) → 14–30 days.
- If exploratory / early conversations → 30–45 days.
Always return due dates as ISO strings: YYYY-MM-DD, never in the past.
    `,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `
From the following INSIGHT, generate ONE primary opportunity and 1–5 follow-up tasks.

INSIGHT:
${JSON.stringify(insight, null, 2)}

CLIENT:
${JSON.stringify(clientRow, null, 2)}

STAKEHOLDER (if any):
${JSON.stringify(stakeholderRow, null, 2)}

PROJECT (if any):
${JSON.stringify(projectRow, null, 2)}

AUTHOR USER:
${JSON.stringify(authorRow, null, 2)}

ROLES / TEAMS:
- Use assignedToTeam as one of: "sales", "consulting", "practice", "ops".
- If unclear, use "sales" for opportunity-driving tasks, "consulting" for delivery tasks.

OUTPUT STRICT JSON:
{
  "opportunity": {
    "title": "short and specific",
    "description": "2–4 sentence description of the opportunity",
    "valueEstimate": "optional rough numeric or range as string, or null"
  },
  "tasks": [
    {
      "title": "short action title",
      "description": "optional details, can be null",
      "assignedToTeam": "sales | consulting | practice | ops",
      "priority": "low | medium | high",
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
    if (!textBlock) throw new Error("AI returned no text block");

    const cleaned = cleanJson(textBlock.text);

    // 1-line debug log for you
    console.log("[OPP AI OUTPUT] =>", cleaned);

    let parsed: any;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err) {
        console.error("[OPP AI JSON PARSE ERROR] =>", cleaned);
        throw new Error("AI returned invalid JSON for opportunity");
    }

    const opportunityData = parsed.opportunity || {};
    const tasksData: any[] = Array.isArray(parsed.tasks) ? parsed.tasks : [];

    // 4) Insert opportunity
    const oppId = crypto.randomUUID();

    await db.insert(opportunities).values({
        id: oppId,
        clientId: insight.clientId,
        insightId: insight.id,
        title: opportunityData.title || "Untitled Opportunity",
        description: opportunityData.description || null,
        valueEstimate: opportunityData.valueEstimate || null,
        stage: "identified",
    });

    // 5) Insert tasks
    const taskIds: string[] = [];

    for (const t of tasksData) {
        const taskId = crypto.randomUUID();

        const assignedToTeam = (t.assignedToTeam || "").toLowerCase().trim() || undefined;
        const assignedToUserId = await pickUserForTeam(
            assignedToTeam,
            authorRow ? authorRow.id : null
        );

        let dueDate: Date | null = null;
        if (t.dueDate && typeof t.dueDate === "string") {
            const d = new Date(t.dueDate);
            if (!isNaN(d.getTime())) {
                dueDate = d;
            }
        }

        await db.insert(tasks).values({
            id: taskId,
            assignedTo: assignedToUserId ?? null,
            insightId: insight.id,
            opportunityId: oppId,
            title: t.title || "Follow-up",
            description: t.description || null,
            priority: (t.priority || "medium").toLowerCase(),
            status: "open",
            dueDate,
        });

        taskIds.push(taskId);
    }

    return {
        opportunityId: oppId,
        taskIds,
    };
}
