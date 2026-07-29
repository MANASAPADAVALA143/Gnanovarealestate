/**
 * Manual broker-rank recalculation (Step A).
 * Usage:
 *   npx tsx scripts/calculate-broker-rank.ts              # all agents
 *   npx tsx scripts/calculate-broker-rank.ts <agent_uuid> # one agent
 *
 * Future: cron/n8n can invoke the same calculateBrokerRank* helpers.
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import {
  calculateBrokerRank,
  calculateBrokerRankForAll,
} from '../server/lib/broker-rank'

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const sb = createClient(url, key)
  const agentId = process.argv[2]

  if (agentId) {
    const result = await calculateBrokerRank(sb, agentId)
    console.log(JSON.stringify(result, null, 2))
  } else {
    const results = await calculateBrokerRankForAll(sb)
    console.log(
      JSON.stringify(
        results.map((r) => ({
          agent_id: r.agent_id,
          broker_rank_score: r.broker_rank_score,
          factors: r.rank_factors,
        })),
        null,
        2
      )
    )
    console.log(`Updated ${results.length} agent(s)`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
