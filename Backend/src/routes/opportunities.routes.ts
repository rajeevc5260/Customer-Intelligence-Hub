import express from "express";
import { db } from "../db/drizzle.js";
import { opportunities } from "../db/schema.js";
import { requireAuth, requireAnyRole } from "../auth/auth.middleware.js";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

export const opportunitiesRouter = express.Router();

// List all opportunities (leaders, execs, consultants can see)
opportunitiesRouter.get("/", requireAuth, async (req, res) => {
  const data = await db.select().from(opportunities).orderBy(opportunities.createdAt);
  res.json(data);
});

// Create opportunity (leaders / sales / practice leaders)
opportunitiesRouter.post(
  "/",
  requireAuth,
  requireAnyRole("leader", "admin", "ops"),
  async (req, res) => {
    const { clientId, insightId, title, description, valueEstimate } = req.body;

    if (!clientId || !title) {
      return res.status(400).json({ error: "clientId and title required" });
    }

    const id = crypto.randomUUID();
    await db.insert(opportunities).values({
      id,
      clientId,
      insightId,
      title,
      description,
      valueEstimate,
      stage: "identified",
    });

    res.json({ success: true, id });
  }
);

// Update stage
opportunitiesRouter.post(
  "/:id/stage",
  requireAuth,
  requireAnyRole("leader", "admin", "ops"),
  async (req, res) => {
    const { id } = req.params;
    const { stage } = req.body;

    await db
      .update(opportunities)
      .set({ stage })
      .where(eq(opportunities.id, id));

    res.json({ success: true });
  }
);
