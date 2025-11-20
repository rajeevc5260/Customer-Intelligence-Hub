// src/server.ts
import express from "express";
import cookieParser from "cookie-parser";
import "dotenv/config";

import { authRouter } from "./auth/auth.routes";
import { profileRouter } from "./routes/profile.routes.js";
import { clientsRouter } from "./routes/clients.routes";
import { insightsRouter } from "./routes/insights.routes";
import { opportunitiesRouter } from "./routes/opportunities.routes";
import { campaignsRouter } from "./routes/campaigns.routes";
import { stakeholdersRouter } from "./routes/stakeholders.routes";
import { projectsRouter } from "./routes/projects.routes";

const app = express();
app.use(express.json());
app.use(cookieParser());

// auth routes (login, invite, callback, etc.)
app.use("/auth", authRouter);

// field intelligence APIs
app.use("/api/profile", profileRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/opportunities", opportunitiesRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/stakeholders", stakeholdersRouter);
app.use("/api/projects", projectsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API running on :${PORT}`);
});
