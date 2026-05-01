# 📊 Sample Property Data - Quick Start Guide

## 🎯 What You Have

I've created **2 sample CSV files** for you:

### 1. **sample-properties.csv** (3 properties)
- Location: `public/sample-properties.csv`
- Best for: Quick testing
- Properties: Miami (2), Austin (1)

### 2. **sample-properties-full.csv** (20 properties) ⭐
- Location: `public/sample-properties-full.csv`
- Best for: Full system testing
- Properties: Miami (7), Austin (7), Denver (6)
- Price range: $295K - $3.5M
- Types: Single family, condos, townhouses
- Diverse amenities and descriptions

---

## 🚀 How to Use Right Now

### Step 1: Access the File
The files are already in your `public` folder:
```
public/
├── sample-properties.csv          (3 properties - quick test)
└── sample-properties-full.csv     (20 properties - full test)
```

### Step 2: Upload to Dashboard

**Option A: Via Dashboard (Recommended)**
1. Start your servers:
   ```bash
   npm run webhook  # Backend
   npm run dev      # Frontend
   ```

2. Login: `http://localhost:3000/login`

3. Go to **Properties** page in sidebar

4. Click **"Download Sample CSV Template"** button
   - This downloads the 3-property version

5. OR manually navigate to:
   ```
   http://localhost:3000/sample-properties-full.csv
   ```
   - Right-click → Save As
   - Downloads the 20-property version

6. Back in dashboard, **drag & drop** the CSV file into the upload area

7. Wait for upload confirmation

8. Click **"Generate Embeddings"** button

9. Wait ~1-2 minutes (20 properties × 5 seconds each)

10. ✅ Done! All properties now searchable with RAG

**Option B: Direct File Upload**
1. Copy either CSV file from `public/` folder
2. Open in Excel/Google Sheets
3. Edit as needed
4. Save as CSV
5. Upload via dashboard

---

## 📋 What's in the Full Sample Data

### Miami Properties (7):
1. **Luxury Waterfront Villa** - $1.25M, 4BR, oceanfront
2. **Beachfront Paradise** - $2.15M, 5BR, private beach
3. **Luxury Penthouse** - $3.5M, 3BR, Brickell
4. **Art Deco Gem** - $695K, 2BR, South Beach
5. **Investor Opportunity** - $385K, 2BR, rental income
6. **Coral Gables Classic** - $1.65M, 5BR, historic
7. **Starter Home Deal** - $295K, 2BR, affordable

### Austin Properties (7):
1. **Modern Downtown Condo** - $550K, 2BR, downtown
2. **Urban Loft** - $425K, 1BR, industrial
3. **Hill Country Estate** - $1.85M, 6BR, 20 acres
4. **Tech Worker Special** - $475K, 2BR, near tech campuses
5. **Lake Travis Oasis** - $1.3M, 4BR, waterfront
6. **Barton Creek Beauty** - $775K, 3BR, greenbelt
7. **New Construction Modern** - $625K, 2BR, Rainey Street

### Denver Properties (6):
1. **Spacious Family Home** - $675K, 5BR, mountain views
2. **Mountain Retreat** - $850K, 4BR, 2 acres
3. **Cozy Craftsman** - $525K, 3BR, walkable
4. **Golf Course Living** - $925K, 4BR, golf course
5. **Downtown Walkable** - $595K, 3BR, townhome
6. **Cherry Creek Charm** - $1.15M, 4BR, premium location

### Price Distribution:
- **Under $500K**: 5 properties (affordable/starter)
- **$500K-$1M**: 8 properties (mid-range)
- **$1M-$2M**: 5 properties (luxury)
- **Over $2M**: 2 properties (ultra-luxury)

### Property Types:
- **Single Family**: 13 properties
- **Condos**: 6 properties
- **Townhouses**: 1 property

---

## 🧪 Test Queries After Upload

Once you've uploaded and embedded the properties, test these RAG searches:

### Budget-Based Queries:
```bash
# Affordable properties
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "affordable property under 500K"}'

# Mid-range
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "family home around 700K"}'

# Luxury
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "luxury waterfront property over 1 million"}'
```

### Location-Based Queries:
```bash
# Miami
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "beachfront property in Miami"}'

# Austin
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "modern condo in Austin downtown"}'

# Denver
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "mountain view home in Denver"}'
```

### Feature-Based Queries:
```bash
# Pool
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "house with pool and outdoor entertaining"}'

# Tech worker
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "condo near tech companies with home office"}'

# Investment
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "good investment property with rental income"}'
```

### Lifestyle Queries:
```bash
# Family
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "spacious family home with yard and good schools"}'

# Young professional
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "walkable downtown loft near nightlife"}'

# Retiree
curl -X POST http://localhost:3001/api/properties/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query": "golf course home with mountain views"}'
```

---

## 🎯 Expected Results

After uploading and embedding, you should see:

### In Dashboard:
- ✅ **Total Properties**: 20
- ✅ **Embedded**: 20
- ✅ **Pending**: 0
- ✅ **Avg Price**: ~$920K

### In RAG Search:
- ✅ Returns 5 most relevant properties
- ✅ Similarity scores 0.6-0.9
- ✅ Results match query intent
- ✅ Response time < 500ms

### In AI Voice Calls:
When leads ask: *"I want a 3 bedroom house under 600K"*
- AI searches using RAG
- Finds: Denver properties (#1, #3) and Austin property (#6)
- Reads details to lead
- Books viewing appointment

---

## 📝 CSV Format Explanation

Each property has these columns:

```csv
title,address,city,state,country,price,bedrooms,bathrooms,sqft,property_type,amenities,description,virtual_tour_url
```

### Important Notes:
- **Amenities**: Semicolon-separated (pool;garage;smart home)
- **Price**: No dollar signs or commas (just numbers)
- **Bathrooms**: Can be decimals (2.5 for half bath)
- **Property Type**: single_family, condo, townhouse, apartment
- **Description**: Rich text helps RAG matching

---

## 🔧 Customizing Sample Data

Want to add your own properties? Easy!

### Step 1: Open the CSV
```bash
# In Excel or Google Sheets
Open: public/sample-properties-full.csv
```

### Step 2: Add Your Properties
Copy a row and modify:
- Change address and location
- Update price and details
- Add your amenities
- Write compelling description

### Step 3: Save and Upload
- Save as CSV (UTF-8 encoding)
- Upload via dashboard
- Generate embeddings
- Test searches

### Example New Row:
```csv
Suburban Paradise,123 Main St,Denver,CO,USA,550000,3,2.5,2200,single_family,pool;garage;updated kitchen;fenced yard,Perfect suburban home with pool and modern updates. Great schools and family neighborhood.,https://example.com/tour
```

---

## 💡 Pro Tips

### For Better RAG Results:
1. **Rich Descriptions** - More text = better embeddings
2. **Include Benefits** - "family-friendly", "investment opportunity"
3. **Mention Lifestyle** - "walkable", "quiet", "trendy"
4. **Add Context** - "near tech companies", "close to beach"
5. **Use Descriptive Amenities** - "resort-style pool", "gourmet kitchen"

### For Testing:
1. **Upload small file first** (3 properties) - test workflow
2. **Then upload full file** (20 properties) - test scale
3. **Try diverse queries** - budget, location, features
4. **Test AI voice calls** - submit lead form and talk to Sarah
5. **Check dashboard** - verify all data displays correctly

### For Production:
1. **Start with real listings** - export from MLS
2. **Clean the data** - remove special characters
3. **Enhance descriptions** - add lifestyle details
4. **Include photos** - add image URLs (semicolon-separated)
5. **Keep updated** - remove sold properties

---

## 🚀 Quick Start Checklist

- [ ] Locate `public/sample-properties-full.csv`
- [ ] Start servers (backend + frontend)
- [ ] Login to dashboard
- [ ] Go to Properties page
- [ ] Download or use sample CSV
- [ ] Upload CSV file
- [ ] Click "Generate Embeddings"
- [ ] Wait for completion (~2 minutes)
- [ ] Verify 20 properties with ✅ badges
- [ ] Test RAG search with queries above
- [ ] Submit test lead and talk to AI
- [ ] Check AI finds matching properties

---

## ✅ Success Criteria

You'll know it's working when:

✅ **Dashboard shows 20 properties**  
✅ **All have green ✅ "Embedded" badges**  
✅ **Search finds relevant results**  
✅ **Similarity scores are 0.6+**  
✅ **AI voice can search properties**  
✅ **Results match query intent**  

---

## 🎉 You're Ready!

With 20 diverse sample properties, you can now:
- ✅ Demo to potential clients
- ✅ Test all RAG features
- ✅ Train AI voice assistant
- ✅ Validate search quality
- ✅ Show real-world use cases

**Upload the sample data and start testing!** 🚀

Need more sample data? Just copy rows in the CSV and modify the details!
