# 🏠 Gnanova Real Estate AI - User Guide

## For Property Buyers/Leads

**Note:** This guide is for **Property Buyers/Leads** (the end users who interact with the AI).

**🔐 No Login Required:** Property buyers/leads do NOT need to create an account or log in. You simply visit the website, fill out a form, and receive an AI call.

**If you're a Real Estate Agent** looking to use Gnanova (with login credentials and dashboard access), see [AGENT_GUIDE.md](./AGENT_GUIDE.md).

---

## How Property Buyers Use the System

This guide explains the complete user journey from visiting the website to b ooking a property viewing.

---

## 📋 **STEP-BY-STEP USER FLOW**

### **STEP 1: Visit the Website**
- User visits the landing page (e.g., `https://gnanova.com`)
- Sees hero section with headline: **"Never Miss a $20K Commission Again"**
- Can explore:
  - Pricing page
  - Demo booking page
  - ROI Calculator
  - Features and testimonials

---

### **STEP 2: Submit Lead Form (Get AI Call)**

**Location:** Landing page, "Try Our AI Voice Agent" section

**What the user does:**
1. Scrolls to the **"Experience Instant AI Calls"** section
2. Fills out the form with:
   - **Name** (required)
   - **Email** (required)
   - **Phone** (required) - Format: `+1-555-123-4567`
   - **Location** (required) - e.g., "New York, NY"
   - **Timeline** (dropdown):
     - Immediately
     - 1-3 months
     - 3-6 months
     - 6+ months
3. Clicks **"📞 Call Me Now"** button

**What happens behind the scenes:**
- Form submits to `/api/leads/create`
- Lead is saved to Supabase database
- System triggers VAPI to initiate AI call
- User sees success message: **"Lead captured. AI will call within 2 minutes."**

**User sees:**
- ✅ Success message
- ⏳ Loading state: "Calling..."
- Form resets after successful submission

---

### **STEP 3: Receive AI Phone Call**

**Timing:** Within 10 seconds to 2 minutes after form submission

**What happens:**
1. User's phone rings
2. AI assistant **"Sarah"** answers (friendly female voice)
3. Sarah greets: *"Hi! This is Sarah calling from [AGENT_NAME]'s real estate team. I'm reaching out about the property inquiry you made recently. Do you have a quick moment to chat?"*

**If user says YES:**
- Sarah asks qualifying questions:
  1. **Budget:** *"What's your budget for this purchase?"*
  2. **Timeline:** *"When are you looking to move?"*
  3. **Location:** *"Which areas are you most interested in?"*
  4. **Property Type:** *"What type of property are you looking for? How many bedrooms?"*
  5. **Pre-approval:** *"Have you been pre-approved for a mortgage yet?"*
  6. **Current situation:** *"Are you working with another agent right now?"*

**If user says NO/BUSY:**
- Sarah asks: *"When would be a better time for me to call you back?"*
- Gets specific time
- Confirms callback time

---

### **STEP 4: AI Searches Properties (RAG System)**

**During the call, if user mentions property needs:**

**Example user says:**
- *"I want a 3 bedroom house under 500K"*
- *"Show me properties with pools in Miami"*
- *"I need something in downtown with 2 bedrooms"*

**What happens:**
1. AI assistant calls the `search_properties` function
2. System generates an embedding of the user's query using OpenAI
3. Searches property database using vector similarity (pgvector)
4. Filters by price, bedrooms, location, etc.
5. Returns top 5 matching properties
6. **AI speaks the results to the user:**
   - *"I found 5 properties that match your needs. The first one is a 3-bedroom home at 123 Main St, Miami, priced at $450,000. It has a pool and garage..."*

**User hears:**
- Property addresses
- Prices
- Key features (bedrooms, bathrooms, square footage)
- Amenities (pool, garage, etc.)

---

### **STEP 5: Property Recommendations Sent**

**After the call ends:**

**What happens automatically:**
1. System analyzes the call transcript
2. Extracts user preferences (budget, bedrooms, location, must-haves)
3. Calls `/api/properties/recommend` endpoint
4. Performs RAG search for top 5 properties
5. Saves recommendations to database
6. **Sends property details via WhatsApp** (if configured)
7. **Sends email summary** (optional)

**User receives:**
- WhatsApp message with:
  - Greeting: *"Hi [Name]! Here are the properties you asked about:"*
  - For each property:
    - Address
    - Price
    - Beds/Baths
    - Key features
    - Virtual tour link
    - First photo as thumbnail
- Email with property summary (if configured)

---

### **STEP 6: Book Property Viewing**

**User can book a viewing in two ways:**

#### **Option A: During the AI Call**
- User says: *"I'd like to see that property"*
- AI asks: *"What's your availability this week?"*
- User provides date/time
- AI confirms: *"Perfect! [AGENT_NAME] will reach out to you on [DATE/TIME]."*

#### **Option B: Via Dashboard/Website**
- User visits property details page
- Clicks **"Book Viewing"** button
- Fills out booking form:
  - Property ID
  - Preferred date
  - Preferred time
  - Notes (optional)
- Submits form

**What happens:**
1. System calls `/api/bookings/create`
2. Booking saved to database
3. Confirmation email sent to user
4. Agent receives notification
5. Calendar invite sent (if configured)

**User receives:**
- ✅ Booking confirmation
- 📧 Email with booking details
- 📅 Calendar invite (optional)

---

### **STEP 7: View Properties on Dashboard**

**For agents/admins (not end users):**

Agents can:
- View all leads in dashboard
- See property search results
- View booking requests
- See analytics (calls, hot leads, appointments booked)
- Search properties using RAG search interface

---

## 🎯 **QUICK REFERENCE: What Users Can Do**

| Action | Where | How |
|--------|-------|-----|
| **Get AI Call** | Landing page | Fill out lead form → Click "Call Me Now" |
| **Search Properties** | During AI call | Say: "I want a 3 bedroom house under 500K" |
| **Get Property Details** | After call | Receive WhatsApp message with property links |
| **Book Viewing** | During call or website | Tell AI or fill booking form |
| **View Properties** | Dashboard (agents) | Use property search interface |

---

## 📱 **EXAMPLE USER CONVERSATION**

**AI (Sarah):** *"Hi! This is Sarah calling from Gnanova Real Estate. I'm reaching out about the property inquiry you made. Do you have a quick moment?"*

**User:** *"Yes, I do."*

**AI:** *"Great! What's your budget for this purchase?"*

**User:** *"I'm looking for something under 500K."*

**AI:** *"Perfect. How many bedrooms are you looking for?"*

**User:** *"Three bedrooms, and I'd love a pool."*

**AI:** *"I can help with that! Let me search for properties that match your needs..."* 
*[AI searches properties using RAG]*

**AI:** *"I found 5 properties that match. The first is a beautiful 3-bedroom home at 123 Ocean Drive, Miami, priced at $450,000. It has a pool, 2-car garage, and is 2,100 square feet. Would you like to hear about the others?"*

**User:** *"Yes, tell me about them."*

**AI:** *[Describes remaining 4 properties]*

**AI:** *"Would you like to schedule a viewing for any of these?"*

**User:** *"Yes, I'd like to see the first one."*

**AI:** *"Perfect! What's your availability this week?"*

**User:** *"How about Friday at 2 PM?"*

**AI:** *"Great! I've scheduled a viewing for Friday at 2 PM. You'll receive a confirmation text shortly. Our agent will meet you at the property. Have a great day!"*

---

## 🔧 **TECHNICAL REQUIREMENTS FOR USERS**

**For the system to work:**
- ✅ User must provide valid phone number (with country code)
- ✅ User must answer the AI call
- ✅ User must speak clearly during the call
- ✅ WhatsApp must be installed (for property details)
- ✅ Email must be valid (for confirmations)

**System requirements:**
- ✅ Backend server running on port 3001
- ✅ VAPI configured with phone number
- ✅ Supabase database with properties loaded
- ✅ OpenAI API key configured (for RAG search)
- ✅ Twilio configured (for WhatsApp)

---

## 📞 **SUPPORT**

If users have issues:
- **Call not received:** Check phone number format, ensure server is running
- **AI didn't understand:** Speak clearly, repeat the request
- **No properties found:** Try different search criteria
- **WhatsApp not received:** Check Twilio configuration

---

## 🎉 **SUMMARY**

**Simple 3-Step Process for Users:**

1. **Fill form** → Get AI call within 2 minutes
2. **Talk to AI** → Describe property needs → AI searches and tells you results
3. **Book viewing** → Schedule appointment → Receive confirmation

**That's it!** The AI handles everything automatically.
