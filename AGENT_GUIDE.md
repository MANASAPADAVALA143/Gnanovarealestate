# 🏢 Gnanova Real Estate AI - Agent Guide

## Who Uses This Product?

**Gnanova is a SaaS product FOR Real Estate Agents.**

There are **two types of users**:

1. **Real Estate Agents** (Your Customers) - They pay for the service and use the dashboard
2. **Property Buyers/Leads** (Their Customers) - They interact with the AI assistant

---

## 👔 **REAL ESTATE AGENTS (Your Customers)**

### 🔐 **Agent Authentication - Separate Login System**

**Important:** Real estate agents have their own dedicated authentication system, completely separate from property buyers/leads.

**Agent Login Details:**
- **Separate Login Portal:** Agents access the dashboard through a dedicated login page (`/login`)
- **Authentication:** Uses Supabase Auth with email/password
- **Protected Dashboard:** Only authenticated agents can access the dashboard and management features
- **No Lead Login:** Property buyers/leads DO NOT log in - they only interact via website forms and AI calls

**How It Works:**
1. **Agent Signs Up** → Creates account with email/password
2. **Agent Profile Created** → System creates agent record in database
3. **Agent Logs In** → Accesses personalized dashboard
4. **Agent Manages** → Views leads, properties, analytics (all specific to their account)

**Security:**
- Row-Level Security (RLS) ensures agents only see their own data
- Agents can only manage their own leads and properties
- Session-based authentication with secure token storage

---

### What Agents Get:

Agents subscribe to Gnanova to:
- **Never miss a lead** - AI calls every lead within 2 minutes
- **Qualify leads automatically** - AI asks questions and scores leads
- **Search properties instantly** - AI can search properties during calls using RAG
- **Book appointments automatically** - AI schedules viewings
- **Get analytics** - See call stats, hot leads, bookings, property searches

### How Agents Use It:

#### **1. Sign Up & Setup**
- Agent visits pricing page
- Chooses plan (Solo Agent / Team / Agency)
- Books demo
- **Creates login account** (email + password)
- Gets access to dashboard
- Configures:
  - Their agent name
  - Phone number for AI calls
  - Property listings (upload properties)
  - WhatsApp integration (optional)

#### **2. Upload Properties**
- Agent adds properties to the system
- Properties are automatically:
  - Stored in Supabase database
  - Embedded using OpenAI (for RAG search)
  - Made searchable by AI during calls

#### **3. Share Website with Leads**
- Agent shares their Gnanova-powered website
- Leads visit and fill out the form
- **AI automatically calls the lead** (agent doesn't need to do anything)

#### **4. Monitor Dashboard**
Agent logs into dashboard to see:

**Dashboard Homepage:**
- 📊 **Today's Stats:**
  - Calls made today
  - Hot leads identified
  - Appointments booked
  - Average lead score

- 🏠 **Property Search Stats:**
  - Total properties in database
  - Most searched location
  - Average property price
  - Latest property added

- 🔥 **Hot Properties Carousel:**
  - Top 5 most viewed properties this week
  - Click to view details

- 📋 **Recent Searches Table:**
  - Last 10 property searches by leads
  - Shows: Time, Lead name, Query, Results

- ⚡ **Quick Actions:**
  - "Search Properties" button
  - "Add New Property" button

**Leads Page:**
- View all leads
- Filter by status (new, hot, warm, cold)
- See lead details:
  - Name, phone, email
  - Location, timeline
  - AI call transcript
  - Lead score
  - Property recommendations
  - Booking status

**Properties Page:**
- Search properties using RAG (semantic search)
- Filter by:
  - Price range
  - Bedrooms
  - Property type
  - Location
- View property details
- Edit properties
- Add new properties

**Analytics Page:**
- Call statistics
- Lead conversion rates
- Property search frequency
- Booking trends
- Revenue metrics

#### **5. Follow Up on Hot Leads**
- AI identifies "hot leads" (ready to buy immediately)
- Agent gets notification
- Agent can:
  - Call the lead directly
  - Send property details
  - Schedule viewing
  - Add notes

#### **6. Manage Bookings**
- View all scheduled property viewings
- See which properties are booked
- Get notifications for new bookings
- Confirm or reschedule appointments

---

## 🏠 **PROPERTY BUYERS/LEADS (Agent's Customers)**

### What Leads Experience:

Leads interact with the AI assistant to find properties. They don't need to know about the dashboard - they just use the website.

#### **Simple 3-Step Process:**

1. **Fill Form** → Get AI Call
   - Lead visits agent's website
   - Fills out: Name, Email, Phone, Location, Timeline
   - Clicks "Call Me Now"
   - Receives call within 10 seconds to 2 minutes

2. **Talk to AI** → Get Property Recommendations
   - AI assistant "Sarah" calls
   - Asks qualifying questions
   - Lead says: "I want a 3 bedroom house under 500K"
   - AI searches properties using RAG
   - AI speaks top 5 matching properties

3. **Book Viewing** → Receive Confirmation
   - Lead books during call or via website
   - Receives WhatsApp message with property details
   - Gets confirmation email
   - Agent is notified

---

## 🔄 **COMPLETE FLOW: Agent → Lead → Agent**

```
1. AGENT SETUP
   Agent signs up → Configures account → Uploads properties
   
2. LEAD SUBMITS FORM
   Lead visits website → Fills form → Clicks "Call Me Now"
   
3. AI CALLS LEAD
   System automatically calls lead → AI qualifies → AI searches properties
   
4. LEAD GETS RESULTS
   AI speaks property matches → Lead books viewing → Gets WhatsApp/Email
   
5. AGENT FOLLOWS UP
   Agent sees hot lead in dashboard → Calls lead → Closes deal
```

---

## 💰 **BUSINESS MODEL**

### For You (Product Owner):
- Agents pay monthly subscription:
  - **Solo Agent:** $1,500/month
  - **Team (2-5):** $2,500/month
  - **Agency (5+):** $4,000/month

### For Agents:
- They get:
  - AI that never misses a call
  - Automatic lead qualification
  - Property search during calls
  - Booking automation
  - Analytics dashboard
- They save:
  - Time (no manual calling)
  - Money (fewer missed leads = more deals)
  - Effort (AI handles initial qualification)

### For Leads:
- Free service
- Instant response
- 24/7 availability
- No waiting for agent callback

---

## 📊 **WHAT AGENTS SEE IN DASHBOARD**

### Dashboard Homepage:
```
┌─────────────────────────────────────────┐
│  Today's Stats                          │
│  • Calls: 15                            │
│  • Hot Leads: 5                         │
│  • Appointments: 3                      │
│  • Avg Lead Score: 72                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Property Search Stats                  │
│  • Total Properties: 50                 │
│  • Most Searched: Miami                 │
│  • Avg Price: $450,000                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Hot Properties (Carousel)              │
│  [Property Card] [Property Card] ...    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Recent Searches                        │
│  Time    | Lead    | Query              │
│  10:30   | John    | 3 bed under 500K  │
│  09:15   | Sarah   | Pool in Miami     │
└─────────────────────────────────────────┘
```

### Leads Page:
```
┌─────────────────────────────────────────┐
│  All Leads                              │
│  [Search] [Filter: All/Hot/Warm/Cold]  │
│                                         │
│  Name      | Status | Score | Actions  │
│  John Doe  | Hot    | 85    | [View]   │
│  Jane Smith| Warm   | 65    | [View]   │
└─────────────────────────────────────────┘
```

### Properties Page:
```
┌─────────────────────────────────────────┐
│  Property Search                        │
│  [Search: "3 bedroom house"]             │
│  [Filters: Price, Beds, Type, Location] │
│                                         │
│  [Property Card] [Property Card] ...   │
└─────────────────────────────────────────┘
```

---

## 🎯 **KEY FEATURES FOR AGENTS**

| Feature | What It Does | Benefit |
|---------|-------------|---------|
| **AI Voice Calls** | Automatically calls every lead | Never miss a lead |
| **Lead Qualification** | AI asks questions and scores leads | Focus on hot leads |
| **RAG Property Search** | AI searches properties during calls | Instant property matching |
| **Booking Automation** | AI schedules viewings | Saves time |
| **WhatsApp Integration** | Sends property details via WhatsApp | Better engagement |
| **Analytics Dashboard** | See all stats in one place | Make data-driven decisions |
| **Property Management** | Upload and manage listings | Keep inventory updated |

---

## 🚀 **ONBOARDING PROCESS FOR AGENTS**

1. **Agent visits pricing page**
2. **Books demo** (15-minute walkthrough)
3. **Signs up** (chooses plan)
4. **Gets dashboard access**
5. **Completes setup:**
   - Adds agent name
   - Configures phone number
   - Uploads properties (or imports from MLS)
   - Connects WhatsApp (optional)
6. **Shares website** with leads
7. **Starts receiving AI-qualified leads**

---

## 📞 **SUPPORT FOR AGENTS**

Agents can:
- Book demo to see how it works
- Contact support for help
- View documentation
- Access training materials
- Get onboarding assistance

---

## ✅ **SUMMARY**

**Gnanova is a SaaS product that:**
- **Sells to:** Real Estate Agents (your customers)
- **Helps them:** Never miss leads, qualify automatically, close more deals
- **Used by:** Property Buyers/Leads (agent's customers)
- **Main value:** AI automation that works 24/7 to capture and qualify leads

**Agents pay you → You provide AI automation → Agents get more deals → Everyone wins!**
