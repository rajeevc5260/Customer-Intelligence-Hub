// src/server.ts
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";

import { authRouter } from "./auth/auth.routes.js";
import { profileRouter } from "./routes/profile.routes.js";
import { clientsRouter } from "./routes/clients.routes.js";
import { insightsRouter } from "./routes/insights.routes.js";
import { opportunitiesRouter } from "./routes/opportunities.routes.js";
import { campaignsRouter } from "./routes/campaigns.routes.js";
import { stakeholdersRouter } from "./routes/stakeholders.routes.js";
import { projectsRouter } from "./routes/projects.routes.js";

const app = express();
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
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
