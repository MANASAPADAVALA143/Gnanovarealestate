/*
  # Add Integrations and Campaign Features
  
  1. Modify leads table
    - Add `source` column (website/facebook/inbound/outbound)
    - Add `ghl_contact_id` column to track GoHighLevel sync
    - Add `timeline` column
    - Add `agent_id` column for multi-agent support
  
  2. Modify calls table
    - Add `campaign_id` column to track campaign calls
    - Add `call_type` column (outbound/inbound)
    - Add `vapi_call_id` column
  
  3. New table: outbound_campaigns
    - Campaign management for calling old leads
  
  4. New table: campaign_leads
    - Track which leads are in which campaigns
  
  5. New table: integration_settings
    - Store GHL, Facebook, and other integration credentials
*/

-- Add columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source text DEFAULT 'website';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ghl_contact_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS timeline text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS agent_id uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_id uuid;

-- Add columns to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS campaign_id uuid;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_type text DEFAULT 'outbound';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS vapi_call_id text;

-- Create outbound_campaigns table
CREATE TABLE IF NOT EXISTS outbound_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft', -- draft, active, paused, completed
  lead_filter_status text[], -- ['cold', 'warm'] - which lead statuses to include
  leads_count integer DEFAULT 0,
  calls_made integer DEFAULT 0,
  calls_completed integer DEFAULT 0,
  calls_failed integer DEFAULT 0,
  agent_id uuid, -- for multi-agent support
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Create campaign_leads table (tracks which leads are in which campaigns)
CREATE TABLE IF NOT EXISTS campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES outbound_campaigns(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending', -- pending, calling, completed, failed, skipped
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
  called_at timestamptz,
  result text, -- answered, no_answer, busy, failed
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, lead_id)
);

-- Create integration_settings table
CREATE TABLE IF NOT EXISTS integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid, -- for multi-agent support
  integration_type text NOT NULL, -- 'gohighlevel', 'facebook', 'zapier'
  is_enabled boolean DEFAULT false,
  api_key text,
  api_secret text,
  webhook_url text,
  config jsonb DEFAULT '{}'::jsonb, -- additional config like location_id for GHL
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, integration_type)
);

-- Enable RLS on new tables
ALTER TABLE outbound_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for outbound_campaigns
CREATE POLICY "Anyone can view campaigns"
  ON outbound_campaigns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert campaigns"
  ON outbound_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update campaigns"
  ON outbound_campaigns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete campaigns"
  ON outbound_campaigns FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for campaign_leads
CREATE POLICY "Anyone can view campaign_leads"
  ON campaign_leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert campaign_leads"
  ON campaign_leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update campaign_leads"
  ON campaign_leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for integration_settings
CREATE POLICY "Users can view own integration settings"
  ON integration_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id OR agent_id IS NULL);

CREATE POLICY "Users can insert own integration settings"
  ON integration_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = agent_id OR agent_id IS NULL);

CREATE POLICY "Users can update own integration settings"
  ON integration_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = agent_id OR agent_id IS NULL)
  WITH CHECK (auth.uid() = agent_id OR agent_id IS NULL);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_ghl_contact_id ON leads(ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_campaign_id ON calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_calls_call_type ON calls(call_type);
CREATE INDEX IF NOT EXISTS idx_calls_vapi_call_id ON calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead_id ON campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON campaign_leads(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON outbound_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_agent_id ON outbound_campaigns(agent_id);
CREATE INDEX IF NOT EXISTS idx_integration_settings_agent_id ON integration_settings(agent_id);
CREATE INDEX IF NOT EXISTS idx_integration_settings_type ON integration_settings(integration_type);

-- Create function to update campaign statistics
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE outbound_campaigns
  SET 
    calls_made = (
      SELECT COUNT(*) 
      FROM campaign_leads 
      WHERE campaign_id = NEW.campaign_id 
        AND status IN ('calling', 'completed')
    ),
    calls_completed = (
      SELECT COUNT(*) 
      FROM campaign_leads 
      WHERE campaign_id = NEW.campaign_id 
        AND status = 'completed'
    ),
    calls_failed = (
      SELECT COUNT(*) 
      FROM campaign_leads 
      WHERE campaign_id = NEW.campaign_id 
        AND status = 'failed'
    ),
    updated_at = now()
  WHERE id = NEW.campaign_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update campaign stats
CREATE TRIGGER trigger_update_campaign_stats
  AFTER INSERT OR UPDATE ON campaign_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_stats();

-- Create function to get campaign progress
CREATE OR REPLACE FUNCTION get_campaign_progress(campaign_uuid uuid)
RETURNS TABLE (
  total_leads integer,
  pending integer,
  calling integer,
  completed integer,
  failed integer,
  progress_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_leads,
    COUNT(*) FILTER (WHERE status = 'pending')::integer as pending,
    COUNT(*) FILTER (WHERE status = 'calling')::integer as calling,
    COUNT(*) FILTER (WHERE status = 'completed')::integer as completed,
    COUNT(*) FILTER (WHERE status = 'failed')::integer as failed,
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE status IN ('completed', 'failed'))::numeric / COUNT(*)::numeric) * 100, 2)
    END as progress_percentage
  FROM campaign_leads
  WHERE campaign_id = campaign_uuid;
END;
$$ LANGUAGE plpgsql;
