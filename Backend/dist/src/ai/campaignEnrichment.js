import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/drizzle.js";
import { clients, projects, stakeholders } from "../db/schema.js";
import { ilike } from "drizzle-orm";
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});
// Clean fenced JSON
function cleanJson(str) {
    return str
        .replace(/```json/i, "")
        .replace(/```/g, "")
        .trim();
}
// Fuzzy DB lookup helper (small data slices)
async function fuzzyReferenceSearch(rawResponse) {
    const like = `%${rawResponse.slice(0, 20)}%`; // 20-char fuzzy lookup
    const matchedClients = await db
        .select()
        .from(clients)
        .where(ilike(clients.name, like));
    const matchedStakeholders = await db
        .select()
        .from(stakeholders)
        .where(ilike(stakeholders.name, like));
    const matchedProjects = await db
        .select()
        .from(projects)
        .where(ilike(projects.name, like));
    return { matchedClients, matchedStakeholders, matchedProjects };
}
// Main AI Enrichment
export async function enrichCampaignResponse(rawResponse) {
    const refs = await fuzzyReferenceSearch(rawResponse);
    const aiResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        temperature: 0.2,
        system: `
Return ONLY valid JSON.
Do NOT include markdown, comments, explanations, or backticks.
    `,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `
Extract structured meaning from a consultant's raw response.

RAW RESPONSE:
${rawResponse}

FUZZY MATCHES:
Clients: ${JSON.stringify(refs.matchedClients)}
Projects: ${JSON.stringify(refs.matchedProjects)}
Stakeholders: ${JSON.stringify(refs.matchedStakeholders)}

OUTPUT STRICT JSON:
{
  "summary": "1–2 sentence executive summary",
  "themes": ["short", "list", "of", "themes"]
}
            `,
                    },
                ],
            },
        ],
    });
    const textBlock = aiResponse.content.find((b) => b.type === "text");
    if (!textBlock)
        throw new Error("AI returned no text");
    const cleaned = cleanJson(textBlock.text);
    // Debug 1-liner
    console.log("[CAMPAIGN AI OUTPUT] =>", cleaned);
    try {
        return JSON.parse(cleaned);
    }
    catch (err) {
        console.error("[AI JSON PARSE ERROR] =>", cleaned);
        throw new Error("AI JSON is invalid");
    }
}
