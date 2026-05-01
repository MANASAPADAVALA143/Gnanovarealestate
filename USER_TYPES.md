# 👥 Gnanova User Types - Quick Reference

## Two Types of Users

### 1. 👔 **Real Estate Agents** (Your Customers)
**They pay for the service and use the dashboard.**

**🔐 Authentication:**
- **Have their own login system** (email + password)
- **Access protected dashboard** at `/login` and `/dashboard`
- **Separate from leads** - agents authenticate, leads do not

**What they do:**
- Sign up and subscribe ($1,500-$4,000/month)
- Log in to access their dashboard
- Upload properties to the system
- Share their Gnanova-powered website with leads
- Monitor dashboard for leads, analytics, bookings
- Follow up on hot leads identified by AI

**What they get:**
- AI that calls every lead within 2 minutes
- Automatic lead qualification
- Property search during calls (RAG)
- Booking automation
- Analytics dashboard
- WhatsApp integration

**See:** [AGENT_GUIDE.md](./AGENT_GUIDE.md) for full details

---

### 2. 🏠 **Property Buyers/Leads** (Agent's Customers)
**They use the website and interact with the AI assistant.**

**🔐 Authentication:**
- **NO login required** - leads don't create accounts
- **Public website access** - anyone can submit the form
- **No dashboard access** - leads only interact via forms, AI calls, and messages

**What they do:**
- Visit agent's website (no login needed)
- Fill out lead form (Name, Phone, Email, Location)
- Receive AI phone call
- Talk to AI about property needs
- Get property recommendations
- Book property viewings

**What they get:**
- Instant AI response (no waiting)
- 24/7 availability
- Property search during call
- WhatsApp messages with property details
- Booking confirmations

**See:** [USER_GUIDE.md](./USER_GUIDE.md) for full details

---

## 🔄 Complete Flow

```
AGENT (Your Customer)
  ↓
Signs up → Uploads properties → Shares website
  ↓
LEAD (Agent's Customer)
  ↓
Visits website → Fills form → Gets AI call
  ↓
AI qualifies → Searches properties → Books viewing
  ↓
AGENT (Your Customer)
  ↓
Sees hot lead in dashboard → Follows up → Closes deal
```

---

## 💰 Business Model

**You (Product Owner):**
- Sell SaaS subscription to agents
- Monthly recurring revenue: $1,500-$4,000 per agent

**Agents (Your Customers):**
- Pay monthly subscription
- Get AI automation that captures and qualifies leads
- Close more deals = make more money

**Leads (Agent's Customers):**
- Use service for free
- Get instant AI response
- Find properties faster

---

## 📚 Documentation

- **For Agents:** [AGENT_GUIDE.md](./AGENT_GUIDE.md)
- **For Property Buyers:** [USER_GUIDE.md](./USER_GUIDE.md)
- **Technical Docs:** [DOCUMENTATION.md](./DOCUMENTATION.md)

---

## ✅ Quick Answer

**Q: Who uses this product?**
- **A: Real Estate Agents** (they pay for it and use the dashboard)

**Q: Who interacts with the AI?**
- **A: Property Buyers/Leads** (they use the website and get AI calls)

**Q: What's the value proposition?**
- **For Agents:** Never miss a lead, qualify automatically, close more deals
- **For Leads:** Instant response, 24/7 availability, find properties faster

---

## 🔐 Authentication Summary

| User Type | Login Required? | Access |
|-----------|----------------|--------|
| **Real Estate Agents** | ✅ YES - Email/Password | Dashboard, analytics, lead management, property management |
| **Property Buyers/Leads** | ❌ NO - No account needed | Public website, lead form, AI calls (no login portal) |

**Key Points:**
- **Agents have separate login credentials** - they create accounts and log in to access the dashboard
- **Leads do NOT log in** - they simply visit the website and submit a form
- **Two completely separate systems** - agent authentication vs. public lead capture
- **Data isolation** - agents only see their own leads and properties (enforced by Row-Level Security)
