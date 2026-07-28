// server/routes/data-delete-route.ts
// Admin-only endpoint to fulfill UAE PDPL "right to be forgotten" requests
// Called from your dashboard admin panel only
// Protected by: service_role Supabase key + manager role check

import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Use service_role key so the RPC can bypass RLS for deletions
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/admin/delete-lead-data
// Body: { lead_id: string, request_ref?: string }
// Headers: Authorization: Bearer <agent JWT>
router.post("/delete-lead-data", async (req, res) => {
  const { lead_id, request_ref } = req.body;

  if (!lead_id) {
    return res.status(400).json({ error: "lead_id is required" });
  }

  // 1. Verify the requesting user is a manager
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // 2. Check manager role
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!agent || !["manager", "admin", "super_admin"].includes(agent.role)) {
    return res.status(403).json({ error: "Manager role required" });
  }

  // 3. Execute the deletion stored procedure
  const { data, error } = await supabaseAdmin.rpc("delete_lead_data", {
    p_lead_id: lead_id,
  });

  if (error) {
    console.error("[DeleteLead] RPC error:", error);
    return res.status(500).json({ error: "Deletion failed", details: error.message });
  }

  console.log(`[DeleteLead] Lead ${lead_id} deleted by ${user.email}:`, data);

  return res.json({
    success: true,
    lead_id,
    summary: data,
    message: "Lead and all associated data deleted per UAE PDPL request",
  });
});

export default router;
