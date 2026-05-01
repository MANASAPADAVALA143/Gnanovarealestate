# 🚀 GNANOVA - Implementation Roadmap

## Phase 1: Complete Core Dashboard Features ✅ IN PROGRESS

### 1.1 Calls Management Page (`/dashboard/calls`)
**Status**: 🔨 Ready to implement

**Features to Build:**
- [ ] Fetch all calls from Supabase `calls` table
- [ ] Display calls in responsive table with:
  - Date/Time
  - Lead Name (with join to `leads` table)
  - Duration
  - Outcome (Interested, Booked, No Answer, etc.)
  - Transcript preview (expandable)
  - Recording player (audio element)
- [ ] Filters:
  - Date range picker
  - Outcome filter (dropdown)
  - Search by lead name/phone
- [ ] Pagination (20 items per page)
- [ ] Real-time updates (Supabase subscription)
- [ ] Call details modal with full transcript
- [ ] Export calls to CSV

**Database Schema:**
```sql
-- Already exists, verify:
calls (
  id uuid PRIMARY KEY,
  lead_id uuid REFERENCES leads(id),
  status text,
  outcome text,
  duration integer,
  transcript text,
  recording_url text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz
)
```

---

### 1.2 Appointments Management Page (`/dashboard/appointments`)
**Status**: 📋 Ready to implement

**Features to Build:**
- [ ] Fetch appointments from Supabase with lead & property joins
- [ ] Calendar view (month/week/day)
- [ ] List view with table showing:
  - Date/Time
  - Lead name & contact
  - Property address
  - Status (Pending, Confirmed, Cancelled, Completed)
  - Notes
  - Actions (Confirm, Cancel, Reschedule)
- [ ] Create appointment modal:
  - Lead selector (dropdown with search)
  - Property selector (dropdown with search)
  - Date/Time picker
  - Notes textarea
  - Reminder settings
- [ ] Update appointment status
- [ ] Reschedule functionality (date picker modal)
- [ ] Confirmation emails (integration ready)
- [ ] Upcoming appointments widget for dashboard home
- [ ] Calendar export (.ics file)

**Database Schema:**
```sql
-- Already exists as 'bookings', may need updates:
appointments (
  id uuid PRIMARY KEY,
  lead_id uuid REFERENCES leads(id),
  property_id uuid REFERENCES properties(id),
  agent_id uuid REFERENCES agents(id),
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  status text DEFAULT 'pending',
  notes text,
  reminder_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

---

### 1.3 Analytics Dashboard Page (`/dashboard/analytics`)
**Status**: 📊 Ready to implement

**Features to Build:**
- [ ] Key Stats Cards (4-6 cards):
  - Total Calls (today, week, month)
  - Conversion Rate (appointments / calls)
  - Avg Call Duration
  - Appointments Booked
  - Hot Leads Count
  - Revenue/Pipeline (if available)
- [ ] Charts (using Recharts):
  - Line Chart: Calls over time (last 30 days)
  - Pie Chart: Call outcomes distribution
  - Bar Chart: Appointments by status
  - Area Chart: Lead sources
- [ ] Filters:
  - Date range selector
  - Agent filter (if multi-agent)
- [ ] Export analytics report (PDF/CSV)
- [ ] Real-time data updates
- [ ] Comparison metrics (vs previous period)

**Database Queries Needed:**
```sql
-- Create RPC functions:
- get_call_stats(start_date, end_date)
- get_conversion_metrics(start_date, end_date)
- get_appointments_by_status()
- get_lead_source_breakdown()
```

---

## Phase 2: AI Virtual Staging & Renovation 🎨 NEXT UP

### 2.1 Virtual Staging Feature
**Status**: 🎨 Ready to design

**Features to Build:**
- [ ] Virtual Staging Modal in Property Details:
  - Upload/Select property photo
  - Choose room type (Living Room, Bedroom, Kitchen, etc.)
  - Select staging style:
    - Modern Minimalist
    - Luxury/High-End
    - Family/Cozy
    - Scandinavian
    - Industrial
    - Traditional
  - Optional renovation prompt field
  - Generate button
- [ ] AI Image Generation:
  - Integrate Replicate API (or Fal.ai)
  - Model: `black-forest-labs/flux-dev` or similar
  - Generate 2-3 variants
  - Progress indicator (polling or webhook)
- [ ] Before/After Carousel:
  - Show original photo
  - Show staged versions
  - Side-by-side comparison slider
- [ ] Save staged images to Supabase Storage
- [ ] Display in property listings
- [ ] Add to Listing Writer generated content

**Database Schema:**
```sql
CREATE TABLE staged_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  original_image_url text NOT NULL,
  staged_image_url text NOT NULL,
  room_type text,
  style text,
  prompt text,
  model text,
  generation_time_seconds integer,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES agents(id)
);

CREATE INDEX idx_staged_images_property ON staged_images(property_id);
```

**API Integration:**
```typescript
// Replicate API example
async function generateStagedImage(
  imageUrl: string, 
  style: string, 
  roomType: string,
  customPrompt?: string
) {
  const prompt = `High-quality virtual staging of ${roomType} in ${style} style, 
    realistic lighting, professional real estate photo, ${customPrompt || ''}, 4k, 
    photorealistic, furnished, modern decor`
  
  // Call Replicate API
  // Return staged image URL(s)
}
```

---

### 2.2 Listing Writer Integration
**Status**: 📝 Extension

**Features to Add:**
- [ ] "Generate Staged Images" button after document upload
- [ ] Auto-generate 2-3 staged versions of main photo
- [ ] Include staged image URLs in generated content
- [ ] Add to social media posts (Instagram, Facebook)
- [ ] Before/after comparison in email templates

---

## Phase 3: Polish & Launch Prep 🚀

### 3.1 UI/UX Polish
- [ ] Consistent loading states across all pages
- [ ] Error handling improvements
- [ ] Toast notifications for actions
- [ ] Empty states with helpful CTAs
- [ ] Keyboard shortcuts for power users
- [ ] Mobile optimization (all pages)
- [ ] Dark mode consistency

### 3.2 Performance Optimization
- [ ] Image optimization (lazy loading, CDN)
- [ ] Code splitting (lazy load routes)
- [ ] Database query optimization
- [ ] Caching strategies (React Query)
- [ ] Bundle size optimization

### 3.3 Testing & QA
- [ ] Test all CRUD operations
- [ ] Test real-time updates
- [ ] Test error scenarios
- [ ] Mobile testing (all viewports)
- [ ] Browser compatibility (Chrome, Safari, Firefox, Edge)
- [ ] Load testing (100+ concurrent users)

### 3.4 Documentation
- [ ] User guide for agents
- [ ] Setup guide for admins
- [ ] API documentation
- [ ] Video tutorials (Loom)
- [ ] FAQ section

### 3.5 Deployment
- [ ] Environment variables check
- [ ] Database migrations applied
- [ ] Domain setup
- [ ] SSL certificate
- [ ] Analytics setup (Google Analytics, Mixpanel)
- [ ] Error monitoring (Sentry)
- [ ] Backup strategy

---

## Technology Stack Decisions

### For Analytics Charts:
- **Recharts** ✅ (Recommended)
  - React-first, composable
  - Good TypeScript support
  - Responsive out of the box
  - Lightweight

### For Date/Time Pickers:
- **react-datepicker** ✅ (Recommended)
  - Simple, customizable
  - Good UX
  - Accessible

### For Calendar View:
- **react-big-calendar** ✅ (Recommended)
  - Full-featured
  - Multiple views (month, week, day)
  - Drag & drop support

### For AI Image Generation:
- **Replicate API** ✅ (Recommended)
  - Easy to use
  - Multiple models available
  - Pay-per-use
  - Fast generation
  - Models to try:
    - `black-forest-labs/flux-dev` (fast, high quality)
    - `stability-ai/sdxl` (reliable)
    - `fofr/sdxl-interior-design` (specifically for staging)

---

## Implementation Priority

### Week 1 (MVP Ready):
1. ✅ Calls Management (2 days)
2. ✅ Appointments (2 days)
3. ✅ Basic Analytics (1 day)

### Week 2 (Wow Factor):
4. ✅ Virtual Staging (3-4 days)
5. ✅ UI/UX Polish (1 day)

### Week 3 (Launch):
6. ✅ Testing & QA (2 days)
7. ✅ Documentation (1 day)
8. ✅ Deployment (1 day)
9. 🚀 LAUNCH!

---

## Cost Estimates (Per Month)

### Infrastructure:
- Supabase: $25-50 (Pro plan)
- Vercel/Hosting: $20-40
- Domain: $15/year (~$1.25/month)

### AI APIs:
- OpenAI (embeddings + GPT-4): $50-150
- VAPI (voice calls): $100-300 (usage-based)
- Replicate (image generation): $20-80 (usage-based)
- Twilio (WhatsApp): $10-50

**Total: ~$225-620/month** (scales with usage)

---

## Success Metrics

### For Launch:
- [ ] 10 beta testers signed up
- [ ] 100+ properties loaded
- [ ] 50+ AI calls completed
- [ ] 20+ appointments booked
- [ ] 5+ pieces of positive feedback

### For Growth:
- [ ] 100 paying agents (Month 1)
- [ ] $10K MRR (Month 3)
- [ ] 95%+ uptime
- [ ] < 2 second page load times
- [ ] 4.5+ star rating

---

**Next Steps:**
1. Install dependencies: `npm install recharts react-datepicker react-big-calendar`
2. Start with Calls Management implementation
3. Move to Appointments
4. Build Analytics
5. Add Virtual Staging
6. Polish and launch!

**Let's build this! 🚀**
