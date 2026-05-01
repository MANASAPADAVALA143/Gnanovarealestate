# 🚀 Production Deployment Checklist

**Project:** Gnanova Real Estate AI Assistant  
**Last Updated:** 2026-01-15  
**Estimated Total Time:** 4-6 hours

---

## 📋 Pre-Deployment Requirements

Before starting deployment, ensure:
- [ ] All code is committed to main branch
- [ ] All tests pass (`npm run e2e-test`)
- [ ] No critical bugs in staging environment
- [ ] Documentation is up to date

---

## 1. Environment Variables (Production)

**Estimated Time:** 15-20 minutes

### Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Production Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)
- [ ] `SUPABASE_ANON_KEY` - Anon/public key (if needed)

### OpenAI
- [ ] `OPENAI_API_KEY` - Production OpenAI API key
- [ ] Verify API key has sufficient credits/quota

### VAPI (Voice AI)
- [ ] `VAPI_API_KEY` - Production VAPI API key
- [ ] `VAPI_PHONE_NUMBER_ID` - Production phone number ID
- [ ] `VAPI_ASSISTANT_ID` - Production assistant ID (if using pre-created)

### Twilio (WhatsApp)
- [ ] `TWILIO_ACCOUNT_SID` - Production Twilio account SID
- [ ] `TWILIO_AUTH_TOKEN` - Production Twilio auth token
- [ ] `TWILIO_WHATSAPP_FROM` - WhatsApp sender number (format: `whatsapp:+1234567890`)

### Application URLs
- [ ] `APP_URL` - Production domain (e.g., `https://gnanova.com`)
- [ ] `N8N_WEBHOOK_URL` - Production n8n webhook URL (if using)
- [ ] `EXPRESS_BASE_URL` - Express server URL (if separate)

### Optional
- [ ] `SENTRY_DSN` - Sentry error tracking DSN
- [ ] `ANALYTICS_ID` - Analytics service ID (Plausible/PostHog)
- [ ] `EMAIL_SERVICE_KEY` - Email service API key (SendGrid/Resend)

**⚠️ Security Notes:**
- Never commit `.env` files to Git
- Use Vercel Environment Variables UI for production
- Rotate keys if accidentally exposed
- Use different keys for staging vs production

---

## 2. Database Setup

**Estimated Time:** 30-45 minutes

### Migrations
- [ ] Run migration: `001_enable_pgvector.sql`
  ```sql
  -- Enable pgvector extension
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- [ ] Run migration: `002_create_bookings.sql`
  ```sql
  -- Create bookings table
  ```
- [ ] Verify all tables exist:
  - [ ] `leads`
  - [ ] `calls`
  - [ ] `properties`
  - [ ] `bookings`
  - [ ] `property_recommendations`

### pgvector Setup
- [ ] Verify `vector` extension is enabled:
  ```sql
  SELECT * FROM pg_extension WHERE extname = 'vector';
  ```
- [ ] Verify `properties.embedding` column exists and is type `vector(1536)`
- [ ] Verify index `properties_embedding_idx` exists

### Initial Data
- [ ] Load sample properties: `npm run load-properties`
- [ ] Verify at least 50 properties loaded:
  ```sql
  SELECT COUNT(*) FROM properties WHERE embedding IS NOT NULL;
  ```
- [ ] Test property search function:
  ```sql
  SELECT * FROM search_properties(
    (SELECT embedding FROM properties LIMIT 1),
    5,
    0.7
  );
  ```

### Backups
- [ ] Enable Supabase automatic backups (Settings → Database → Backups)
- [ ] Set backup frequency: Every 6 hours (or daily minimum)
- [ ] Configure backup retention: 7 days minimum
- [ ] Test backup restoration process (document steps)

### Row Level Security (RLS)
- [ ] Enable RLS on all tables:
  ```sql
  ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
  ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
  ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
  ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
  ```
- [ ] Create policies for service role (bypass RLS):
  ```sql
  -- Service role can access all data
  CREATE POLICY "Service role full access" ON leads
    FOR ALL USING (auth.role() = 'service_role');
  ```
- [ ] Create policies for authenticated users (if applicable)
- [ ] Test RLS policies with service role and anon key

---

## 3. VAPI Configuration

**Estimated Time:** 20-30 minutes

### Production Assistant Setup
- [ ] Create new assistant in VAPI dashboard (or duplicate staging)
- [ ] Configure assistant name: "Gnanova Production Assistant"
- [ ] Set system prompt with production-specific instructions
- [ ] Enable function calling:
  - [ ] `search_properties` → `https://yourdomain.com/api/vapi/functions`
  - [ ] `get_property_details` → `https://yourdomain.com/api/vapi/functions`
  - [ ] `send_property_brochure` → `https://yourdomain.com/api/vapi/functions`

### Webhook Configuration
- [ ] Set webhook URL: `https://yourdomain.com/api/vapi/webhook`
- [ ] Configure webhook events:
  - [ ] `function-call`
  - [ ] `status-update`
  - [ ] `end-of-call-report`
- [ ] Test webhook with VAPI webhook tester
- [ ] Verify webhook signature validation (if implemented)

### Phone Number
- [ ] Assign production phone number to assistant
- [ ] Test inbound call handling
- [ ] Test outbound call initiation
- [ ] Verify caller ID displays correctly

### Testing
- [ ] Make test call to real phone number
- [ ] Verify AI responds correctly
- [ ] Test property search function call
- [ ] Verify function results are spoken naturally
- [ ] Check call recording is saved
- [ ] Verify transcript is generated

---

## 4. Vercel Deployment

**Estimated Time:** 30-45 minutes

### Repository Connection
- [ ] Connect GitHub repository to Vercel
- [ ] Select correct branch (usually `main` or `production`)
- [ ] Configure root directory (if not repo root)
- [ ] Set framework preset: Next.js

### Build Configuration
- [ ] Verify `package.json` has correct build script: `"build": "vite build"` or Next.js build
- [ ] Set Node.js version: 18.x or 20.x
- [ ] Configure build command (if custom)
- [ ] Set output directory (if custom)

### Environment Variables
- [ ] Add all production environment variables (see Section 1)
- [ ] Mark sensitive variables as "Encrypted"
- [ ] Set variables for Production, Preview, and Development environments
- [ ] Verify no staging/test values in production

### Domain Configuration
- [ ] Add custom domain: `gnanova.com` (or your domain)
- [ ] Add `www.gnanova.com` (if using www)
- [ ] Configure DNS records:
  - [ ] A record: `@` → Vercel IPs
  - [ ] CNAME record: `www` → `cname.vercel-dns.com`
- [ ] Wait for DNS propagation (can take up to 48 hours)
- [ ] Verify SSL certificate is issued (automatic)

### Deployment Settings
- [ ] Enable automatic deployments on push to main
- [ ] Configure preview deployments for PRs
- [ ] Set up deployment protection (require approval if needed)
- [ ] Configure build timeout (default 45s, increase if needed)

### Performance Settings
- [ ] Enable Edge Network (Vercel Edge Functions)
- [ ] Configure caching headers for static assets
- [ ] Set up ISR (Incremental Static Regeneration) if applicable
- [ ] Enable compression (automatic)

---

## 5. Monitoring & Observability

**Estimated Time:** 20-30 minutes

### Error Tracking (Sentry)
- [ ] Create Sentry project
- [ ] Install Sentry SDK: `@sentry/nextjs` or `@sentry/react`
- [ ] Configure `SENTRY_DSN` environment variable
- [ ] Set up error alerts (email/Slack)
- [ ] Test error reporting (trigger test error)
- [ ] Configure release tracking

### Uptime Monitoring
- [ ] Set up UptimeRobot account (or similar)
- [ ] Add monitor for main domain: `https://gnanova.com`
- [ ] Add monitor for API health: `https://gnanova.com/api/health`
- [ ] Configure check interval: 5 minutes
- [ ] Set up alert contacts (email/SMS)
- [ ] Test alert delivery

### Analytics
- [ ] Set up Plausible Analytics (or PostHog/Google Analytics)
- [ ] Add tracking script to `_app.tsx` or `layout.tsx`
- [ ] Configure custom events:
  - [ ] Lead form submission
  - [ ] Demo booking
  - [ ] Property search
  - [ ] AI call initiated
- [ ] Set up conversion goals
- [ ] Verify tracking works (test events)

### Logging
- [ ] Configure Vercel logs (automatic)
- [ ] Set up log aggregation (if needed): Datadog/LogRocket
- [ ] Configure log retention: 7-30 days
- [ ] Set up log alerts for errors

---

## 6. Performance Optimization

**Estimated Time:** 30-45 minutes

### Caching
- [ ] Enable Vercel Edge caching for static assets
- [ ] Configure API route caching (if applicable):
  ```typescript
  export const revalidate = 300; // 5 minutes
  ```
- [ ] Set cache headers for property images
- [ ] Configure CDN caching for `/api/analytics/stats` (5 min TTL)

### Image Optimization
- [ ] Use Next.js `<Image>` component (if Next.js)
- [ ] Or use Vite image optimization plugin
- [ ] Configure image domains in config
- [ ] Compress images before upload (TinyPNG/Squoosh)
- [ ] Use WebP format where possible

### Code Optimization
- [ ] Verify production build minifies JS/CSS
- [ ] Enable tree-shaking (automatic with Vite/Next.js)
- [ ] Check bundle size: `npm run build` and review output
- [ ] Remove unused dependencies
- [ ] Lazy load heavy components

### Performance Testing
- [ ] Test homepage load time: Target < 2 seconds
- [ ] Test property search API: Target < 1 second
- [ ] Run Lighthouse audit:
  - [ ] Performance: > 90
  - [ ] Accessibility: > 90
  - [ ] Best Practices: > 90
  - [ ] SEO: > 90
- [ ] Test on slow 3G connection
- [ ] Test on mobile device

### Database Performance
- [ ] Verify property search index is used:
  ```sql
  EXPLAIN ANALYZE SELECT * FROM search_properties(...);
  ```
- [ ] Monitor query performance in Supabase dashboard
- [ ] Set up query alerts for slow queries (> 1s)

---

## 7. Final Testing

**Estimated Time:** 45-60 minutes

### Lead Form
- [ ] Submit lead form on production site
- [ ] Verify lead saved in Supabase database
- [ ] Check lead appears in dashboard
- [ ] Verify response time < 1 second

### AI Call Flow
- [ ] Receive AI call on real phone number
- [ ] Verify AI introduces itself correctly
- [ ] Test qualification questions
- [ ] Test property search via voice: "Show me 3 bedroom homes under 500K"
- [ ] Verify function calling works
- [ ] Check call recording is saved
- [ ] Verify transcript is generated
- [ ] Confirm lead status updated in dashboard

### Property Search
- [ ] Test semantic search: "luxury condo with pool in Miami"
- [ ] Verify returns relevant results
- [ ] Check similarity scores are reasonable (> 0.7)
- [ ] Test filters (price, bedrooms, location)
- [ ] Verify response time < 2 seconds

### Property Recommendation
- [ ] Create test lead with preferences
- [ ] Trigger recommendation API
- [ ] Verify 5 properties returned
- [ ] Check all match criteria
- [ ] Verify recommendations saved to database

### Booking System
- [ ] Book demo appointment via form
- [ ] Verify booking created in database
- [ ] Check confirmation email sent (if implemented)
- [ ] Verify booking appears in dashboard
- [ ] Test booking cancellation (if applicable)

### WhatsApp Integration
- [ ] Send property via WhatsApp API
- [ ] Verify message received on WhatsApp
- [ ] Check message formatting (images, links)
- [ ] Verify message logged in database
- [ ] Test with multiple properties

### Email Notifications
- [ ] Test lead confirmation email
- [ ] Test booking confirmation email
- [ ] Test agent notification email
- [ ] Verify email templates render correctly
- [ ] Check spam score (Mail-Tester.com)

### Dashboard Analytics
- [ ] Access `/api/analytics/stats`
- [ ] Verify all counts are accurate
- [ ] Check caching works (5 min TTL)
- [ ] Test with different date ranges

### Error Handling
- [ ] Test invalid API requests (400 errors)
- [ ] Test missing environment variables (500 errors)
- [ ] Verify error messages are user-friendly
- [ ] Check error logs in Sentry

---

## 8. Launch Preparation

**Estimated Time:** 20-30 minutes

### DNS & SSL
- [ ] Verify DNS records are correct
- [ ] Check SSL certificate is active (green padlock)
- [ ] Test HTTPS redirect works
- [ ] Verify www → non-www redirect (or vice versa)
- [ ] Test subdomain redirects (if any)

### SEO
- [ ] Generate sitemap: `https://gnanova.com/sitemap.xml`
- [ ] Submit sitemap to Google Search Console
- [ ] Verify robots.txt is configured
- [ ] Check meta tags on all pages:
  - [ ] Title tags
  - [ ] Meta descriptions
  - [ ] Open Graph tags
  - [ ] Twitter Card tags
- [ ] Test structured data (JSON-LD) if implemented

### 404 & Error Pages
- [ ] Create custom 404 page
- [ ] Create custom 500 error page
- [ ] Test 404 page displays correctly
- [ ] Verify error pages are user-friendly

### Legal & Compliance
- [ ] Add Privacy Policy page
- [ ] Add Terms of Service page
- [ ] Add Cookie Policy (if using cookies)
- [ ] Verify GDPR compliance (if EU users)
- [ ] Add cookie consent banner (if needed)

### Social Media
- [ ] Set up social media preview images
- [ ] Test Open Graph tags with Facebook Debugger
- [ ] Test Twitter Card tags with Twitter Card Validator
- [ ] Prepare launch announcement posts

---

## 9. Post-Launch

**Estimated Time:** Ongoing

### Immediate (First 24 Hours)
- [ ] Monitor error logs in Sentry
- [ ] Check uptime monitoring alerts
- [ ] Review analytics for traffic spikes
- [ ] Monitor API response times
- [ ] Check database performance
- [ ] Verify all webhooks are firing

### First Week
- [ ] Review user feedback
- [ ] Fix any critical bugs
- [ ] Optimize slow queries
- [ ] Review conversion rates
- [ ] Check email deliverability
- [ ] Monitor costs (Vercel, Supabase, OpenAI, VAPI, Twilio)

### Ongoing
- [ ] Weekly backup verification
- [ ] Monthly security updates
- [ ] Quarterly performance reviews
- [ ] Regular dependency updates
- [ ] Monitor API usage and costs
- [ ] Review and optimize conversion funnel

---

## 🎯 Quick Reference

### Critical URLs
- **Production Site:** https://gnanova.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://app.supabase.com
- **VAPI Dashboard:** https://dashboard.vapi.ai
- **Sentry:** https://sentry.io

### Support Contacts
- **Vercel Support:** support@vercel.com
- **Supabase Support:** support@supabase.com
- **VAPI Support:** support@vapi.ai

### Rollback Plan
If critical issues occur:
1. Revert to previous Vercel deployment (Dashboard → Deployments → Previous)
2. Or rollback database migration (if needed)
3. Disable problematic features via feature flags
4. Notify team via Slack/email

---

## ✅ Sign-Off

**Deployed by:** _________________  
**Date:** _________________  
**Version:** _________________  
**All tests passed:** ☐ Yes ☐ No  
**Ready for production:** ☐ Yes ☐ No

---

**Total Estimated Time:** 4-6 hours  
**Actual Time Taken:** _________________

---

*Last updated: 2026-01-15*  
*For questions or updates to this checklist, contact the development team.*
