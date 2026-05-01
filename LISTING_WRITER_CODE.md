# 📝 Listing Writer - Complete Working Code

## ✅ What's Already Installed

```bash
npm list mammoth pdf-parse @anthropic-ai/sdk
# ✅ mammoth@1.11.0
# ✅ pdf-parse@2.4.5
# ✅ @anthropic-ai/sdk@0.71.2
```

---

## 🔧 Backend API - Document Parser

**File:** `server/api/listing-writer-parse.js`

```javascript
import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'
import multer from 'multer'
import fs from 'fs'
import mammoth from 'mammoth'
import { createRequire } from 'module'

// pdf-parse is CommonJS, need to use require
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

dotenv.config()

// Check API key configuration
const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
console.log('🔑 Anthropic API Key status:', anthropicKey ? `✅ Configured` : '❌ NOT FOUND')

const anthropic = new Anthropic({
  apiKey: anthropicKey
})

console.log('📦 Document parsers loaded: mammoth (docx), pdf-parse (pdf), Claude Vision (images)')

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ]
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, and images are allowed.'))
    }
  }
})

export const uploadMiddleware = upload.single('file')

/**
 * Parse property document using Claude Vision/AI
 */
export async function parseDocument(req, res) {
  let filePath = null

  console.log('\n🚀 === DOCUMENT PARSING STARTED ===')
  console.log('⏰ Timestamp:', new Date().toISOString())
  
  try {
    console.log('✅ Step 1: Checking if file was uploaded...')
    if (!req.file) {
      console.log('❌ No file found in request')
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      })
    }
    console.log('✅ File received!')

    console.log('✅ Step 2: Reading file from disk...')
    filePath = req.file.path
    const fileBuffer = fs.readFileSync(filePath)
    const fileType = req.file.mimetype
    console.log('✅ File read successfully!')

    console.log('📄 Parsing document:', req.file.originalname)
    console.log('📄 File type:', fileType)
    console.log('📄 File size:', req.file.size, 'bytes')
    console.log('📄 File path:', filePath)

    let extractedText = ''

    console.log('✅ Step 3: Determining file type and extraction method...')
    
    // Handle images with Claude Vision
    if (fileType.startsWith('image/')) {
      console.log('🖼️ Detected IMAGE file - Using Claude Vision...')
      
      console.log('   → Converting image to base64...')
      const base64Image = fileBuffer.toString('base64')
      console.log('   → Base64 conversion complete, length:', base64Image.length)
      
      // Determine media type for Claude
      let mediaType = 'image/jpeg'
      if (fileType.includes('png')) mediaType = 'image/png'
      if (fileType.includes('jpg') || fileType.includes('jpeg')) mediaType = 'image/jpeg'
      if (fileType.includes('webp')) mediaType = 'image/webp'
      if (fileType.includes('gif')) mediaType = 'image/gif'
      console.log('   → Detected media type:', mediaType)

      console.log('   → Calling Claude Vision API...')
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: 'This is a property listing document or brochure. Extract all property details you can find including: property type, location/address, price, number of bedrooms, bathrooms, square footage, features/amenities, and any unique selling points or descriptions. Format your response as a structured list.'
              }
            ]
          }
        ]
      })

      console.log('   → Claude Vision API response received')
      const content = response.content[0]
      if (content.type === 'text') {
        extractedText = content.text
        console.log('   ✅ Image text extracted successfully!')
      }

    } else if (fileType === 'application/pdf') {
      // Handle PDF files with pdf-parse
      console.log('📃 Detected PDF file - Using pdf-parse...')
      try {
        console.log('   → Parsing PDF content...')
        const pdfData = await pdfParse(fileBuffer)
        extractedText = pdfData.text
        console.log('   ✅ PDF text extracted:', extractedText.length, 'characters')
      } catch (pdfError) {
        console.error('❌ PDF parsing error:', pdfError.message)
        throw new Error(`Failed to parse PDF: ${pdfError.message}`)
      }
      
    } else if (fileType.includes('word')) {
      // Handle Word documents with mammoth
      console.log('📄 Detected WORD document - Using mammoth...')
      try {
        console.log('   → Extracting text from .docx...')
        const result = await mammoth.extractRawText({ path: filePath })
        extractedText = result.value
        console.log('   ✅ Word text extracted:', extractedText.length, 'characters')
        
        if (result.messages.length > 0) {
          console.log('⚠️ Mammoth warnings:', result.messages)
        }
      } catch (docError) {
        console.error('❌ Word document parsing error:', docError.message)
        throw new Error(`Failed to parse Word document: ${docError.message}`)
      }
    }

    console.log('\n✅ Step 4: Text extraction complete!')
    console.log('🔍 Extracted text preview:', extractedText.substring(0, 200))
    console.log('📊 Total characters extracted:', extractedText.length)
    
    // Validate extracted text
    console.log('✅ Step 5: Validating extracted text...')
    if (!extractedText || extractedText.trim().length < 10) {
      console.log('❌ Text validation failed - insufficient content')
      throw new Error('No meaningful text could be extracted from the document. Please ensure the document contains readable text.')
    }
    console.log('✅ Text validation passed!')

    // Now use Claude to structure the extracted information
    console.log('\n✅ Step 6: Sending to Claude for structured extraction...')
    console.log('   → Calling Claude API with extracted text...')
    const structuredResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a real estate data extraction assistant. Extract property details from the provided text and return them in valid JSON format with these exact keys:
{
  "property_type": "string (e.g., Single Family Home, Condo)",
  "location": "string (full address if available)",
  "price": "string (e.g., $450,000 or 450000)",
  "bedrooms": "string (just the number)",
  "bathrooms": "string (just the number)",
  "sqft": "string (just the number)",
  "features": ["array", "of", "features"],
  "selling_points": "string (description of unique features)"
}

If a field is not found, use an empty string. Always return valid JSON only, no other text.

Extract property details from this text:

${extractedText}`
        }
      ],
      temperature: 0.3
    })

    console.log('   → Claude API response received!')
    const content = structuredResponse.content[0]
    let jsonResponse = ''
    if (content.type === 'text') {
      jsonResponse = content.text
    }
    console.log('📊 Structured response:', jsonResponse)

    // Parse the JSON response
    console.log('\n✅ Step 7: Parsing JSON response...')
    let propertyData
    try {
      // Clean response (Claude sometimes wraps JSON in markdown code blocks)
      let cleanedResponse = jsonResponse.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\n?/g, '').replace(/```\n?$/g, '')
      }
      
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        propertyData = JSON.parse(jsonMatch[0])
      } else {
        propertyData = JSON.parse(cleanedResponse)
      }
      
      console.log('   ✅ JSON parsed successfully!')
      console.log('   ✅ Property data keys:', Object.keys(propertyData))
    } catch (parseError) {
      console.error('   ❌ JSON parsing failed!')
      console.error('   - Parse error:', parseError.message)
      console.error('   - Raw response:', jsonResponse)
      throw new Error(`Failed to structure property data: ${parseError.message}`)
    }

    console.log('\n🎉 === DOCUMENT PARSING SUCCESSFUL ===')
    console.log('✅ Step 8: Returning data to frontend...')
    return res.json({
      success: true,
      data: propertyData
    })

  } catch (error) {
    console.error('❌ Error parsing document:', error)
    console.error('📋 Error details:')
    console.error('   - Message:', error.message)
    console.error('   - Stack:', error.stack)
    console.error('   - File type:', req.file?.mimetype)
    console.error('   - File name:', req.file?.originalname)
    console.error('   - File size:', req.file?.size, 'bytes')
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse document',
      details: {
        fileType: req.file?.mimetype,
        fileName: req.file?.originalname,
        errorType: error.constructor.name
      }
    })
  } finally {
    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
        console.log('🗑️ Cleaned up temporary file')
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError)
      }
    }
  }
}
```

---

## 🎨 Frontend Component

**File:** `src/pages/Dashboard/ListingWriter.tsx` (File upload handler)

```typescript
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0]
  if (!file) return

  // Check file type
  const allowedTypes = [
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'image/jpeg', 
    'image/png', 
    'image/jpg'
  ]
  
  if (!allowedTypes.includes(file.type)) {
    alert('Please upload a PDF, Word document, or image file')
    return
  }

  try {
    setUploading(true)
    setDocumentExtracted(false)

    console.log('📤 Uploading file:', file.name, file.type, file.size, 'bytes')
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('agentId', agent?.id || '')

    const response = await fetch('http://localhost:3001/api/listing-writer/parse-document', {
      method: 'POST',
      body: formData
    })

    console.log('📥 Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('❌ Server error:', errorData)
      throw new Error(errorData.error || 'Failed to parse document')
    }

    const result = await response.json()
    console.log('✅ Parse result:', result)

    if (result.success && result.data) {
      console.log('✅ Setting property data:', result.data)
      setPropertyData({
        propertyType: result.data.property_type || '',
        location: result.data.location || '',
        price: result.data.price || '',
        bedrooms: result.data.bedrooms || '',
        bathrooms: result.data.bathrooms || '',
        sqft: result.data.sqft || '',
        features: result.data.features || [],
        sellingPoints: result.data.selling_points || ''
      })
      setDocumentExtracted(true)
      console.log('🎉 Document parsed successfully!')
    } else {
      console.error('❌ Invalid response format:', result)
      throw new Error(result.error || 'Invalid response from server')
    }
  } catch (error: any) {
    console.error('❌ Error uploading document:', error)
    console.error('❌ Error details:', error.message, error.stack)
    alert(`Error parsing document: ${error.message}\n\nPlease try again or fill the form manually.`)
  } finally {
    setUploading(false)
    console.log('🏁 Upload process complete')
  }
}
```

---

## 🔧 Server Route Registration

**File:** `webhook-server.js`

```javascript
import { generateListing } from './server/api/listing-writer-generate.js'
import { parseDocument, uploadMiddleware } from './server/api/listing-writer-parse.js'

// ... other code ...

// Parse property document with AI
app.post('/api/listing-writer/parse-document', uploadMiddleware, parseDocument)
```

---

## ✅ Environment Variables Required

**File:** `.env.local`

```env
ANTHROPIC_API_KEY=sk-ant-api03-your_key_here
OPENAI_API_KEY=sk-proj-your_key_here  # Optional, for other features
```

---

## 🧪 How to Test

1. **Start servers:**
   ```bash
   # Terminal 1 - Frontend
   npm run dev
   
   # Terminal 2 - Backend
   npm run webhook
   ```

2. **Open browser:**
   ```
   http://localhost:3000/dashboard/listing-writer
   ```

3. **Upload a document:**
   - PDF with property details
   - Word document (.docx)
   - Image (JPG/PNG) of a brochure

4. **Watch the logs:**
   - Frontend: Browser console (F12)
   - Backend: Terminal running `npm run webhook`

---

## 📋 Supported File Types

| Type | Extension | Parser Used |
|------|-----------|-------------|
| PDF | `.pdf` | pdf-parse |
| Word | `.docx` | mammoth |
| Image | `.jpg`, `.png` | Claude Vision |

---

## 🔍 Troubleshooting

### Error: "No file uploaded"
- Check that file input has `name="file"`
- Verify `formData.append('file', file)` is called

### Error: "Failed to parse PDF"
- PDF might be scanned/image-based (no text layer)
- Try converting to image first

### Error: "Insufficient quota"
- Check Anthropic API key has available credits
- Visit: https://console.anthropic.com/

### Error: "CORS"
- Verify `app.use(cors())` is in webhook-server.js
- Check backend is running on port 3001

---

## ✅ Current Status

- ✅ **Packages installed:** mammoth, pdf-parse, @anthropic-ai/sdk
- ✅ **API Key configured:** Anthropic (Claude)
- ✅ **Backend running:** Port 3001
- ✅ **Frontend running:** Port 3000
- ✅ **Enhanced logging:** Detailed step-by-step tracking

---

## 🎯 Next Steps

1. Click "Upload & Analyze" button
2. Select a test document
3. Watch the browser console (F12)
4. Watch the backend terminal logs
5. See property details auto-fill!

**Everything is ready to go!** 🚀
