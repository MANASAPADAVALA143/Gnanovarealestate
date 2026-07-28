/**
 * Demo-safe feature flags. Stub UIs stay hidden unless explicitly enabled.
 * Override with VITE_FEATURE_*=true in .env when backend support is ready.
 */

function envFlag(name: string, defaultValue = false): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  const raw = env?.[name]
  if (raw === undefined || raw === '') return defaultValue
  return String(raw).toLowerCase() === 'true' || raw === '1'
}

export const featureFlags = {
  // TODO(stub): backend not implemented — no global search API across leads/calls/properties
  globalSearch: envFlag('VITE_FEATURE_GLOBAL_SEARCH', false),

  // TODO(stub): backend not implemented — no notifications feed / realtime alert channel
  notificationsBell: envFlag('VITE_FEATURE_NOTIFICATIONS_BELL', false),

  // TODO(stub): backend not implemented — VoiceCallCenter uses mock data only (no live VAPI stream)
  liveCallCenter: envFlag('VITE_FEATURE_LIVE_CALL_CENTER', false),
} as const
