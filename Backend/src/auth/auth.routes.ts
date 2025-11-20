import express from "express";
import { supabasePublic, supabaseAdmin } from "./supabase.js";
import { db } from "../db/drizzle.js";
import { appUsers } from "../db/schema.js";
import { requireCompanyApiKey } from "./apiKey.middleware.js";

export const authRouter = express.Router();

// LOGIN (Magic Link - Invite Only)
authRouter.post("/login", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const user = await db.query.appUsers.findFirst({
    where: (u, { eq }) => eq(u.email, email)
  });

  if (!user) {
    return res.status(403).json({
      error: "This email is not invited to the organisation."
    });
  }

  const { data, error } = await supabasePublic.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: "http://localhost:5173/auth/callback"
    }
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.json({
    success: true,
    message: "Magic login link sent to email"
  });
});


// INVITE USER
authRouter.post("/invite", requireCompanyApiKey, async (req, res) => {
  const { email, role, fullName } = req.body;

  if(!email || !fullName) {
    return res.status(400).json({ error: "Email, and fullName are required" });
  }

  const uiCallbackUrl = "http://localhost:5173/auth/callback";

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: uiCallbackUrl
  });

  if (error) return res.status(400).json({ error: error.message });

  await db.insert(appUsers).values({
    id: data.user.id,
    fullName,
    email,
    role
  });

  return res.json({
    success: true,
    message: "Invite sent successfully"
  });
});


// LOGOUT
authRouter.post("/logout", async (req, res) => {
  res.clearCookie("access_token");
  return res.json({ success: true });
});
