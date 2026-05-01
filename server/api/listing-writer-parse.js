import OpenAI from 'openai'
import dotenv from 'dotenv'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import mammoth from 'mammoth'
import { createRequire } from 'module'

// pdf-parse is CommonJS, need to use require
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

dotenv.config()

// Check API key configuration
const openaiKey = process.env.OPENAI_API_KEY
console.log('🔑 OpenAI API Key status:', openaiKey ? `✅ Configured (${openaiKey.substring(0, 20)}...)` : '❌ NOT FOUND')

const openai = new OpenAI({
  apiKey: openaiKey
})

console.log('📦 Document parsers loaded: mammoth (docx), pdf-parse (pdf), GPT-4 Vision (images)')

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
 * Parse property document using GPT-4 Vision/AI
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
    
    // Handle images with GPT-4 Vision
    if (fileType.startsWith('image/')) {
      console.log('🖼️ Detected IMAGE file - Using GPT-4 Vision...')
      
      console.log('   → Converting image to base64...')
      const base64Image = fileBuffer.toString('base64')
      console.log('   → Base64 conversion complete, length:', base64Image.length)
      
      const dataUrl = `data:${fileType};base64,${base64Image}`
      console.log('   → Created data URL')

      console.log('   → Calling GPT-4 Vision API...')
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'This is a property listing document or brochure. Extract all property details you can find including: property type, location/address, price, number of bedrooms, bathrooms, square footage, features/amenities, and any unique selling points or descriptions. Format your response as a structured list.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ]
      })

      console.log('   → GPT-4 Vision API response received')
      extractedText = response.choices[0].message.content
      console.log('   ✅ Image text extracted successfully!')

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

    // Now use GPT to structure the extracted information
    console.log('\n✅ Step 6: Sending to GPT for structured extraction...')
    console.log('   → Calling OpenAI API with extracted text...')
    const structuredResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        {
          role: 'system',
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

If a field is not found, use an empty string. Always return valid JSON only, no other text.`
        },
        {
          role: 'user',
          content: `Extract property details from this text:\n\n${extractedText}`
        }
      ]
    })

    console.log('   → OpenAI API response received!')
    const jsonResponse = structuredResponse.choices[0].message.content
    console.log('📊 Structured response:', jsonResponse)

    // Parse the JSON response
    console.log('\n✅ Step 7: Parsing JSON response...')
    let propertyData
    try {
      // Clean response (GPT sometimes wraps JSON in markdown code blocks)
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
