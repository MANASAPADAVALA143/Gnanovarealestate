// Test if .env.local is being loaded correctly
import dotenv from 'dotenv'

console.log('Testing environment variable loading...\n')

// Try loading .env.local
const result = dotenv.config({ path: '.env.local' })

if (result.error) {
  console.log('❌ Error loading .env.local:', result.error.message)
} else {
  console.log('✅ .env.local loaded successfully')
}

console.log('\nEnvironment variables:')
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set')
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Not set')
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set')

if (process.env.OPENAI_API_KEY) {
  console.log('\nOPENAI_API_KEY value (first 20 chars):', process.env.OPENAI_API_KEY.substring(0, 20) + '...')
}
