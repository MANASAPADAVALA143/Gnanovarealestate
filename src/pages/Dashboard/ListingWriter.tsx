import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useLocation } from 'react-router-dom'
import {
  Upload,
  FileText,
  Copy,
  Check,
  Sparkles,
  Home,
  MapPin,
  DollarSign,
  BedDouble,
  Bath,
  Maximize,
  Loader2
} from 'lucide-react'

interface PropertyData {
  propertyType: string
  location: string
  price: string
  bedrooms: string
  bathrooms: string
  sqft: string
  features: string[]
  sellingPoints: string
}

interface GeneratedContent {
  fullDescription: string
  instagramCaption: string
  facebookPost: string
  buyerEmail: string
  whatsappMessage: string
}

const FEATURES_OPTIONS = [
  'Pool',
  'Parking',
  'Garden',
  'Gym',
  'Security',
  'Furnished',
  'Balcony',
  'Fireplace',
  'Central AC',
  'Smart Home',
  'Pet Friendly',
  'Storage'
]

const PROPERTY_TYPES = [
  'Single Family Home',
  'Condo',
  'Townhouse',
  'Multi-Family',
  'Land',
  'Commercial'
]

export default function ListingWriter() {
  const { agent } = useAuth()
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [propertyData, setPropertyData] = useState<PropertyData>({
    propertyType: '',
    location: '',
    price: '',
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    features: [],
    sellingPoints: ''
  })

  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [activeTab, setActiveTab] = useState<keyof GeneratedContent>('fullDescription')
  const [copiedTab, setCopiedTab] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [documentExtracted, setDocumentExtracted] = useState(false)

  // Check if we received pre-filled data from navigation
  useEffect(() => {
    if (location.state?.propertyData) {
      const prefillData = location.state.propertyData
      setPropertyData({
        propertyType: prefillData.property_type || '',
        location: prefillData.location || `${prefillData.address}, ${prefillData.city}` || '',
        price: prefillData.price?.toString() || '',
        bedrooms: prefillData.bedrooms?.toString() || '',
        bathrooms: prefillData.bathrooms?.toString() || '',
        sqft: prefillData.sqft?.toString() || '',
        features: prefillData.amenities || [],
        sellingPoints: prefillData.description || ''
      })
    }
  }, [location.state])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF, Word document, or image file')
      return
    }

    try {
      setUploading(true)
      setDocumentExtracted(false)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('agentId', agent?.id || '')

      console.log('📤 Uploading file:', file.name, file.type, file.size, 'bytes')
      
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

  const handleFeatureToggle = (feature: string) => {
    setPropertyData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }))
  }

  const handleGenerateListing = async () => {
    // Validate required fields
    if (!propertyData.location || !propertyData.price) {
      alert('Please fill in at least location and price')
      return
    }

    try {
      setGenerating(true)

      const response = await fetch('http://localhost:3001/api/listing-writer/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          propertyData,
          agentName: agent?.full_name || 'Agent',
          agentEmail: agent?.email || ''
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate listing')
      }

      const result = await response.json()

      if (result.success && result.content) {
        setGeneratedContent(result.content)
        setActiveTab('fullDescription')
      }
    } catch (error) {
      console.error('Error generating listing:', error)
      alert('Error generating listing. Please check your connection and try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async (content: string, tabName: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedTab(tabName)
      setTimeout(() => setCopiedTab(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const tabs = [
    { key: 'fullDescription', label: 'Full Description', icon: FileText },
    { key: 'instagramCaption', label: 'Instagram', icon: Sparkles },
    { key: 'facebookPost', label: 'Facebook', icon: Sparkles },
    { key: 'buyerEmail', label: 'Email', icon: Sparkles },
    { key: 'whatsappMessage', label: 'WhatsApp', icon: Sparkles }
  ] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Listing Writer</h1>
        <p className="text-slate-600 mt-1">Generate professional property listings in seconds</p>
      </div>

      {/* Document Upload Section */}
      <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-white rounded-xl border-2 border-dashed border-purple-300 p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            Upload Property Document
          </h3>
          <p className="text-slate-600 mb-4 max-w-md">
            Upload brochure, floor plan, or property document — AI will extract all details automatically
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                AI is reading your document...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload & Analyze
              </>
            )}
          </button>

          {documentExtracted && (
            <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg">
              <Check className="w-5 h-5" />
              <span className="font-medium">Details extracted from document ✓</span>
            </div>
          )}

          <p className="text-xs text-slate-500 mt-3">
            Supports PDF, Word, JPG, PNG
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Property Details Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Home className="w-5 h-5 text-purple-600" />
            Property Details
          </h2>

          {/* Property Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Property Type
            </label>
            <select
              value={propertyData.propertyType}
              onChange={(e) => setPropertyData({ ...propertyData, propertyType: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select type...</option>
              {PROPERTY_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location
            </label>
            <input
              type="text"
              value={propertyData.location}
              onChange={(e) => setPropertyData({ ...propertyData, location: e.target.value })}
              placeholder="e.g., 123 Main St, Miami, FL"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Price
            </label>
            <input
              type="text"
              value={propertyData.price}
              onChange={(e) => setPropertyData({ ...propertyData, price: e.target.value })}
              placeholder="e.g., $450,000"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Bedrooms & Bathrooms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <BedDouble className="w-4 h-4 inline mr-1" />
                Bedrooms
              </label>
              <input
                type="text"
                value={propertyData.bedrooms}
                onChange={(e) => setPropertyData({ ...propertyData, bedrooms: e.target.value })}
                placeholder="e.g., 3"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Bath className="w-4 h-4 inline mr-1" />
                Bathrooms
              </label>
              <input
                type="text"
                value={propertyData.bathrooms}
                onChange={(e) => setPropertyData({ ...propertyData, bathrooms: e.target.value })}
                placeholder="e.g., 2"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Square Feet */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Maximize className="w-4 h-4 inline mr-1" />
              Size (sqft)
            </label>
            <input
              type="text"
              value={propertyData.sqft}
              onChange={(e) => setPropertyData({ ...propertyData, sqft: e.target.value })}
              placeholder="e.g., 2,100"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Key Features */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Key Features
            </label>
            <div className="grid grid-cols-2 gap-3">
              {FEATURES_OPTIONS.map(feature => (
                <label
                  key={feature}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={propertyData.features.includes(feature)}
                    onChange={() => handleFeatureToggle(feature)}
                    className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-700">{feature}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Unique Selling Points */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Unique Selling Points
            </label>
            <textarea
              value={propertyData.sellingPoints}
              onChange={(e) => setPropertyData({ ...propertyData, sellingPoints: e.target.value })}
              placeholder="What makes this property special? e.g., Recently renovated kitchen, stunning ocean views, walk to schools..."
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateListing}
            disabled={generating}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating AI Content...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Listing
              </>
            )}
          </button>
        </div>

        {/* Right: Generated Output */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-slate-200 bg-slate-50">
            <div className="flex overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.key
                      ? 'border-purple-600 text-purple-600 bg-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {!generatedContent ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Ready to Generate
                </h3>
                <p className="text-slate-600 max-w-sm">
                  Fill in the property details and click "Generate Listing" to create professional marketing content
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Copy Button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleCopy(generatedContent[activeTab], activeTab)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    {copiedTab === activeTab ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                {/* Generated Content */}
                <div className="prose prose-slate max-w-none">
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">
                      {generatedContent[activeTab]}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
