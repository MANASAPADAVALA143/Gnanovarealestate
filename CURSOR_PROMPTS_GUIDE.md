# 🎯 Cursor AI Prompts - Ready to Use (2-Prompt Optimized Version)

## 📌 Recommended Approach (Feb 2026)

**Use the consolidated 2-prompt version below for faster, more cohesive implementation.**

- **Run Prompt 1 first** → Implements Calls + Appointments + Analytics together
- **Test and debug** → Make sure everything works
- **Then run Prompt 2** → Adds Virtual Staging feature

This approach is better because:
- ✅ Features are interconnected (calls → appointments → analytics)
- ✅ Cursor handles large prompts well with proper context
- ✅ Faster implementation (2 runs vs 4)
- ✅ Better cohesion across related features
- ✅ Easier to maintain shared UI patterns

---

## ✅ SETUP CHECKLIST

Before running prompts, make sure:

- [x] **Dependencies installed**:
  ```bash
  npm install recharts react-big-calendar react-datepicker date-fns replicate
  npm install --save-dev @types/react-datepicker @types/react-big-calendar
  ```

- [x] **`.cursorrules` file exists** (already created in your project root)

- [x] **Servers running**:
  - Frontend: `npm run dev` → http://localhost:3000
  - Backend: `npm run webhook` → http://localhost:3001

- [x] **Supabase tables exist**: `leads`, `properties`, `calls`, `bookings`/`appointments`

---

## 📞 PROMPT 1: Complete Calls + Appointments + Analytics

**Before running:**
1. Open Cursor Composer (Cmd/Ctrl + L)
2. Select these files for context (optional but helpful):
   - `App.tsx`
   - `src/pages/Dashboard/Layout.tsx`
   - `src/lib/supabase.ts`

**Copy-paste this entire prompt into Cursor Composer:**

```
You are an expert React + TypeScript + Tailwind + Supabase developer building a real estate AI dashboard.

My app already has:
- Supabase client setup (auth, database, realtime).
- VAPI integration for AI calls (transcripts saved in Supabase 'calls' table).
- Dashboard layout with sections: /dashboard/calls, /dashboard/appointments, /dashboard/analytics.
- Existing tables: leads, properties, calls (with fields like id, lead_id, duration, transcript, recording_url, outcome, created_at), appointments (id, lead_id, property_id, date_time, status, notes).

Tasks (implement in this order, create/edit files as needed):

1. Complete /dashboard/calls page:
   - Fetch all calls from Supabase (table: calls or call_logs) ordered by created_at desc.
   - Show responsive table (use shadcn/ui Table if available, else Tailwind) with columns: Date, Lead Name (join leads), Duration, Outcome (e.g., Interested, Booked, No Answer), Transcript preview (click to expand full), Play recording button (if recording_url exists — use HTML audio player).
   - Add filters: by date range, by outcome, search by lead name/phone.
   - Pagination if >20 items.
   - Real-time updates with Supabase realtime subscription on new calls.

2. Complete /dashboard/appointments page:
   - Fetch appointments from Supabase (table: appointments) with joins to leads and properties.
   - Calendar view (simple list + fullCalendar or basic grid if no lib; prefer shadcn Calendar/DatePicker).
   - Table/List: Date/Time, Lead, Property, Status (Pending/Confirmed/Cancelled), Actions (Confirm, Cancel, Reschedule → modal with date picker).
   - Form modal to create/edit appointment (fields: lead select, property select, datetime, notes).
   - Send reminders (console.log for now; later integrate email/SMS).
   - Integrate with Google Calendar if possible (optional stretch: use @supabase auth token for OAuth later).

3. Build basic /dashboard/analytics page:
   - Stats cards: Total Calls, Conversion Rate (booked / total calls), Avg Call Duration, Appointments Booked This Week/Month.
   - Simple charts using Recharts: Line chart for calls over time, Pie chart for outcomes, Bar for appointments by status.
   - Fetch aggregated data via Supabase queries (use .rpc() if needed for custom SQL).
   - Make it responsive, dark-mode friendly.

Follow my app conventions:
- Use React hooks (useState, useEffect).
- Error handling + loading states (shadcn Skeleton or spinner).
- Tailwind classes for modern UI (cards, buttons, modals).
- TypeScript types for all data (e.g., Call, Appointment interfaces).
- Keep code clean, modular (separate components: CallTable, AppointmentCalendar, StatsCard).

Generate the necessary code changes, new components, and Supabase queries. If table schemas are missing, suggest ALTER TABLE or migrations.
```

---

## 🧪 TESTING PROMPT 1

After Cursor generates the code:

### Test Calls Page:
- [ ] Navigate to http://localhost:3000/dashboard/calls
- [ ] Table loads with call data
- [ ] Filters work (date range, outcome, search)
- [ ] Pagination works (if >20 calls)
- [ ] Click "View Details" shows full transcript
- [ ] Audio player works (if recording_url exists)
- [ ] Real-time updates work (add a new call in Supabase → should appear automatically)

### Test Appointments Page:
- [ ] Navigate to http://localhost:3000/dashboard/appointments
- [ ] List/Calendar view shows appointments
- [ ] Create new appointment modal works
- [ ] Can confirm/cancel appointments
- [ ] Reschedule functionality works
- [ ] Filters work

### Test Analytics Page:
- [ ] Navigate to http://localhost:3000/dashboard/analytics
- [ ] All stat cards show correct numbers
- [ ] Charts render properly (line, pie, bar)
- [ ] Date range filter updates charts
- [ ] No console errors

---

## 🎨 PROMPT 2: AI Virtual Staging + Renovation Visualizer

**Before running:**
1. Make sure Prompt 1 is working and tested
2. Get Replicate API key: https://replicate.com (sign up, get API key)
3. Add to `.env` file:
   ```
   REPLICATE_API_KEY=r8_your_key_here
   ```
4. Select files for context:
   - `src/pages/Dashboard/PropertiesManagement.tsx`
   - `src/pages/Dashboard/ListingWriter.tsx`

**Copy-paste this entire prompt into Cursor Composer:**

```
You are an expert in building AI image features in React apps with Tailwind and Supabase.

My app has:
- Properties page (/dashboard/properties) with property details, photos upload (stored in Supabase Storage).
- Listing Writer section that uses GPT-4o Vision to extract from uploaded docs/images.
- Existing image upload flow (e.g., property photos in Supabase buckets).

Goal: Add AI Virtual Staging to Properties and Listing Writer.

Tasks (step-by-step):

1. Add Virtual Staging section/tab in Property Details view:
   - Button: "Generate Virtual Staging" → opens modal.
   - Select room/photo from existing property images.
   - Choose style: Modern Minimalist, Luxury, Family/Cozy, Scandinavian (dropdown).
   - Optional: Renovation prompt field (e.g., "add kitchen island", "modern bathroom").
   - Call Replicate API (or Fal.ai / HuggingFace) to generate image using a model like: stability-ai/stable-diffusion-xl or black-forest-labs/flux.1-dev (fast staging models).
     - Example prompt template: "High-quality virtual staging of an empty [room type] in [style] style, realistic lighting, professional real estate photo, [custom renovation if provided], 4k".
   - Show loading spinner → display generated image(s) (3-5 variants if possible).
   - Save generated images to Supabase Storage (bucket: staged-photos) linked to property_id.
   - Add "before/after" carousel in property card (original + staged).

2. Integrate into Listing Writer:
   - After document upload and extraction, add "Generate Staged Images" button.
   - Auto-generate 2-3 staged versions of main photo.
   - Include staged image URLs in generated content (e.g., add to Instagram caption: "See staged version! [image link]").

3. UI/UX:
   - Use Tailwind + shadcn/ui for modal, select, buttons, image preview carousel (use Embla Carousel or simple grid).
   - Progress indicator for generation (Replicate webhooks or polling).
   - Error handling (API fail, quota).
   - Store user API key in settings if needed (or hardcode for dev).

Implementation details:
- Create new component: VirtualStagingModal.tsx, StagedImageCarousel.tsx.
- New Supabase table: staged_images (id, property_id, original_image_url, staged_url, style, prompt, created_at).
- Use fetch or axios for Replicate API call (POST to https://api.replicate.com/v1/predictions).
- Handle async generation (show placeholder until done).

Generate code for new components, API helpers, Supabase schema suggestions, and updates to existing Properties/Listings pages.
Make it secure (no client-side API keys exposed — use Edge Function if possible later).
```

---

## 🧪 TESTING PROMPT 2

After implementation:

### Test Virtual Staging:
- [ ] Navigate to a property in http://localhost:3000/dashboard/properties
- [ ] Click "Generate Virtual Staging" button
- [ ] Modal opens with options
- [ ] Select an image and style
- [ ] Click Generate
- [ ] Loading spinner shows (with progress text)
- [ ] Generated image(s) display
- [ ] Before/after comparison works
- [ ] Staged images save to Supabase Storage
- [ ] Can download staged images

### Test Listing Writer Integration:
- [ ] Go to http://localhost:3000/dashboard/listing-writer
- [ ] Upload a property document
- [ ] See "Generate Staged Images" button
- [ ] Generate works and adds to content
- [ ] Staged URLs appear in social media captions

---

## 🚨 COMMON ISSUES & QUICK FIXES

### Issue: Supabase queries fail
**Fix**: Check RLS policies. For development, disable RLS:
```sql
ALTER TABLE calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
```

### Issue: Real-time updates don't work
**Fix**: Enable realtime in Supabase dashboard:
1. Go to Database → Replication
2. Enable replication for `calls`, `appointments` tables

### Issue: Charts don't render
**Fix**: 
- Check data format matches Recharts requirements
- Console.log the data before passing to chart
- Check Recharts docs: https://recharts.org/

### Issue: Replicate API fails
**Fix**:
- Verify API key in `.env` is correct
- Check Replicate account has billing enabled
- Model name is correct: `black-forest-labs/flux-dev` or `fofr/sdxl-interior-design`
- Handle rate limits with try-catch

### Issue: TypeScript errors
**Fix**: 
- Make sure types are installed: `npm install --save-dev @types/[package]`
- Check imports are correct
- Define interfaces for all data types

### Issue: Modal not closing
**Fix**: 
- Check state management (`useState` for modal open/close)
- Make sure onClick handlers are attached correctly

---

## 💡 PRO TIPS FOR USING CURSOR

1. **Select relevant files** before running prompts (gives better context)
2. **Review changes carefully** - Cursor shows diffs before applying
3. **Test incrementally** - Don't apply all changes at once
4. **Use Cursor Chat** for fixes - Highlight problematic code and ask "Fix this"
5. **Keep `.cursorrules` updated** - Helps Cursor understand your patterns
6. **Use checkpoints** - Cursor can revert changes if needed
7. **Ask for explanations** - "Explain how this CallTable component works"

---

## 📋 DATABASE SCHEMA REFERENCE

### Calls Table (should exist):
```sql
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
  created_at timestamptz,
  campaign_id uuid,
  call_type text,
  vapi_call_id text
)
```

### Appointments Table (may need to create):
```sql
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES agents(id),
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  status text DEFAULT 'pending',
  notes text,
  reminder_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Staged Images Table (for Prompt 2):
```sql
CREATE TABLE staged_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  original_image_url text NOT NULL,
  staged_image_url text NOT NULL,
  room_type text,
  style text,
  prompt text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES agents(id)
);
```

---

## 🎯 IMPLEMENTATION TIMELINE

### Today (2-3 hours):
- ⏰ **30 min**: Run Prompt 1 in Cursor
- ⏰ **60 min**: Review generated code, apply changes, fix errors
- ⏰ **30 min**: Test Calls, Appointments, Analytics
- ⏰ **30 min**: Debug and polish

### Tomorrow (2-3 hours):
- ⏰ **15 min**: Get Replicate API key, add to .env
- ⏰ **30 min**: Run Prompt 2 in Cursor
- ⏰ **60 min**: Review, apply, fix
- ⏰ **45 min**: Test Virtual Staging
- ⏰ **30 min**: Polish UI/UX

### Result:
✅ Fully working Calls Management
✅ Complete Appointments system
✅ Analytics Dashboard with charts
✅ AI Virtual Staging with before/after
✅ **Sellable MVP ready!** 🚀

---

## 🚀 LAUNCH CHECKLIST

Before going live:
- [ ] All features tested on mobile
- [ ] No console errors
- [ ] Loading states everywhere
- [ ] Error handling in place
- [ ] Sample data in production database
- [ ] Environment variables set in production
- [ ] API keys secured (not exposed in client)
- [ ] User guide written
- [ ] Demo video recorded
- [ ] Pricing page updated

---

## 📞 NEXT STEPS

1. **Run Prompt 1 now** - Copy-paste into Cursor Composer (Cmd/Ctrl + L)
2. **Test thoroughly** - Check all three pages (Calls, Appointments, Analytics)
3. **Fix any issues** - Use Cursor Chat to debug
4. **Run Prompt 2** - Add Virtual Staging
5. **Polish & launch** - You're ready to sell!

---

**You're minutes away from a fully-featured real estate AI platform!** 🎉

**Current Status:**
- ✅ Dependencies installed
- ✅ `.cursorrules` configured
- ✅ Servers running
- ✅ Prompts ready to use

**Just open Cursor Composer and paste Prompt 1!** 🚀
