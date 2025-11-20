import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const appUsers = pgTable("app_users", {
  id: text("id").primaryKey(),       // same as supabase auth user id
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").default("member"), // admin, leader, consultant, etc.
  team: text("team"), // "consulting", "sales", "practice", "ops", etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Clients
export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Stakeholders
export const stakeholders = pgTable("stakeholders", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .references(() => clients.id)
    .notNull(),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Projects / Engagements
export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .references(() => clients.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insights
export const insights = pgTable("insights", {
  id: text("id").primaryKey(),
  authorId: text("author_id")
    .references(() => appUsers.id)
    .notNull(),
  clientId: text("client_id").references(() => clients.id),
  projectId: text("project_id").references(() => projects.id),
  stakeholderId: text("stakeholder_id").references(() => stakeholders.id),
  rawText: text("raw_text").notNull(),
  summary: text("summary"),
  themes: text("themes"), // simple CSV or JSON string for now
  timeHorizon: text("time_horizon"),
  budgetSignal: text("budget_signal"),
  competitorMention: text("competitor_mention"),
  status: text("status").default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// Tags
export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insight ↔ Tags
export const insightTags = pgTable("insight_tags", {
  insightId: text("insight_id")
    .references(() => insights.id)
    .notNull(),
  tagId: text("tag_id")
    .references(() => tags.id)
    .notNull(),
});

// Opportunities
export const opportunities = pgTable("opportunities", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .references(() => clients.id)
    .notNull(),
  insightId: text("insight_id").references(() => insights.id),
  title: text("title").notNull(),
  description: text("description"),
  valueEstimate: text("value_estimate"),
  stage: text("stage").default("identified"), // identified, qualified, in-progress, closed
  createdAt: timestamp("created_at").defaultNow(),
});

// Tasks
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  assignedTo: text("assigned_to").references(() => appUsers.id),
  insightId: text("insight_id").references(() => insights.id),
  opportunityId: text("opportunity_id").references(() => opportunities.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("open"),
  priority: text("priority").default("medium"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Campaigns (pull scenario)
export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  createdBy: text("created_by")
    .references(() => appUsers.id)
    .notNull(),
  topic: text("topic").notNull(),
  description: text("description"),
  questions: text("questions"), // JSON string array
  status: text("status").default("active"), // active, closed
  createdAt: timestamp("created_at").defaultNow(),
});

// Campaign audience
export const campaignAudience = pgTable("campaign_audience", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .references(() => campaigns.id)
    .notNull(),
  userId: text("user_id")
    .references(() => appUsers.id)
    .notNull(),
});

// Campaign responses
export const campaignResponses = pgTable("campaign_responses", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .references(() => campaigns.id)
    .notNull(),
  userId: text("user_id")
    .references(() => appUsers.id)
    .notNull(),
  rawResponse: text("raw_response").notNull(),
  summary: text("summary"),
  extractedThemes: text("extracted_themes"),
  createdAt: timestamp("created_at").defaultNow(),
});
