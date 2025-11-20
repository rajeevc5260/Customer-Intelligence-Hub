import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/drizzle.js";
import { clients, stakeholders, projects } from "../db/schema.js";
import { eq } from "drizzle-orm";
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
// Clean JSON if model returns fenced output
function cleanJson(str) {
    return str
        .replace(/```json/i, "")
        .replace(/```/g, "")
        .trim();
}
export async function enrichInsightWithAI(clientId, rawText) {
    // Fetch client info
    const clientRow = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    const clientInfo = clientRow[0] || null;
    // Fetch stakeholders and projects
    const stakeholderList = await db
        .select()
        .from(stakeholders)
        .where(eq(stakeholders.clientId, clientId));
    const projectList = await db
        .select()
        .from(projects)
        .where(eq(projects.clientId, clientId));
    // LLM call
    const aiResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        temperature: 0.2,
        system: `
You MUST return ONLY valid JSON.
No markdown, no code fences, no commentary.
If you output anything else, the system will break.
    `,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `
You are extracting structured insight data.

RAW TEXT:
${rawText}

CLIENT INFO:
${JSON.stringify(clientInfo, null, 2)}

PROJECT LIST:
${JSON.stringify(projectList, null, 2)}

STAKEHOLDER LIST:
${JSON.stringify(stakeholderList, null, 2)}

Fill these fields:
- summary (1–2 sentences)
- themes (comma-separated)
- timeHorizon ("0-3 months", "3-6 months", "6-12 months", "12+ months")
- budgetSignal ("low", "medium", "high")
- competitorMention (null if none)
- selectedProjectId (id from project list or null)
- selectedStakeholderId (id from stakeholder list or null)

OUTPUT STRICT JSON ONLY.
            `
                    }
                ]
            }
        ]
    });
    // Extract text block
    const textBlock = aiResponse.content.find((b) => b.type === "text");
    if (!textBlock)
        throw new Error("AI returned no text block");
    const cleaned = cleanJson(textBlock.text);
    // DEBUG LOG (1 line)
    console.log("[AI OUTPUT RAW JSON] =>", cleaned);
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    }
    catch (err) {
        console.error("[AI JSON PARSE ERROR] =>", cleaned);
        throw new Error("AI returned invalid JSON");
    }
    return parsed; // structured AI output
}
