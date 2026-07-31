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
  Loader2,
  ChevronDown,
  Globe2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface PropertyData {
  propertyType: string
  location: string
  price: string
  bedrooms: string
  bathrooms: string
  sqft: string
  features: string[]
  sellingPoints: string
  developerTrackRecord: string
  handoverQuarter: string
  paymentPlan: string
  districtStage: string
  isFreehold: boolean
  targetBuyer: 'end_user' | 'investor' | 'nri' | 'all'
}

interface GeneratedContent {
  fullDescription: string
  instagramCaption: string
  facebookPost: string
  buyerEmail: string
  whatsappMessage: string
  nriInternational: string
}

type PropertyOption = {
  id: string
  title?: string | null
  address?: string | null
  city?: string | null
  price?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  sqft?: number | null
  property_type?: string | null
  handover_quarter?: string | null
  is_freehold?: boolean | null
  district_stage?: number | null
  developer_track_record?: string | null
  amenities?: string[] | null
  description?: string | null
}

const emptyPropertyData = (): PropertyData => ({
  propertyType: '',
  location: '',
  price: '',
  bedrooms: '',
  bathrooms: '',
  sqft: '',
  features: [],
  sellingPoints: '',
  developerTrackRecord: '',
  handoverQuarter: '',
  paymentPlan: '',
  districtStage: '',
  isFreehold: true,
  targetBuyer: 'all',
})

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
  'Storage',
]

const PROPERTY_TYPES = [
  'Apartment',
  'Villa',
  'Townhouse',
  'Penthouse',
  'Duplex',
  'Studio',
  'Commercial',
  'Land',
]

const TARGET_BUYER_OPTIONS = [
  { value: 'end_user', label: 'End-user (family / own use)' },
  { value: 'investor', label: 'Investor (rental yield focus)' },
  { value: 'nri', label: 'International / NRI buyer' },
  { value: 'all', label: 'All buyer types' },
] as const

export default function ListingWriter() {
  const { agent } = useAuth()
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [propertyData, setPropertyData] = useState<PropertyData>(emptyPropertyData())
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [activeTab, setActiveTab] = useState<keyof GeneratedContent>('fullDescription')
  const [copiedTab, setCopiedTab] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [documentExtracted, setDocumentExtracted] = useState(false)
  const [uaeOpen, setUaeOpen] = useState(false)
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [importMessage, setImportMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadProperties() {
      const { data, error } = await supabase
        .from('properties')
        .select(
          'id, title, address, city, price, bedrooms, bathrooms, sqft, property_type, handover_quarter, is_freehold, district_stage, developer_track_record, amenities, description'
        )
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (error) {
        console.error('Failed to load properties for Listing Writer:', error.message)
        return
      }
      setProperties((data as PropertyOption[]) || [])
    }
    void loadProperties()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!importMessage) return
    const t = window.setTimeout(() => setImportMessage(null), 3000)
    return () => window.clearTimeout(t)
  }, [importMessage])

  // Check if we received pre-filled data from navigation
  useEffect(() => {
    if (location.state?.propertyData) {
      const prefillData = location.state.propertyData
      setPropertyData({
        ...emptyPropertyData(),
        propertyType: prefillData.property_type || '',
        location:
          prefillData.location ||
          [prefillData.address, prefillData.city].filter(Boolean).join(', ') ||
          '',
        price: prefillData.price?.toString() || '',
        bedrooms: prefillData.bedrooms?.toString() || '',
        bathrooms: prefillData.bathrooms?.toString() || '',
        sqft: prefillData.sqft?.toString() || '',
        features: prefillData.amenities || [],
        sellingPoints: prefillData.description || '',
        developerTrackRecord: prefillData.developer_track_record || '',
        handoverQuarter: prefillData.handover_quarter || '',
        districtStage: prefillData.district_stage?.toString() || '',
        isFreehold: prefillData.is_freehold !== false,
      })
      if (
        prefillData.handover_quarter ||
        prefillData.developer_track_record ||
        prefillData.district_stage
      ) {
        setUaeOpen(true)
      }
    }
  }, [location.state])

  const handleImportProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId)
    if (!propertyId) return

    const property = properties.find((p) => p.id === propertyId)
    if (!property) return

    const title = property.title || property.address || 'property'
    const locationLine = [property.address, property.city].filter(Boolean).join(', ')

    setPropertyData((prev) => ({
      ...prev,
      propertyType: property.property_type || prev.propertyType,
      location: locationLine || prev.location,
      price: property.price != null ? String(property.price) : prev.price,
      bedrooms: property.bedrooms != null ? String(property.bedrooms) : prev.bedrooms,
      bathrooms: property.bathrooms != null ? String(property.bathrooms) : prev.bathrooms,
      sqft: property.sqft != null ? String(property.sqft) : prev.sqft,
      features: property.amenities?.length ? property.amenities : prev.features,
      sellingPoints: property.description || prev.sellingPoints,
      developerTrackRecord: property.developer_track_record || '',
      handoverQuarter: property.handover_quarter || '',
      districtStage: property.district_stage != null ? String(property.district_stage) : '',
      isFreehold: property.is_freehold !== false,
    }))

    if (
      property.handover_quarter ||
      property.developer_track_record ||
      property.district_stage != null
    ) {
      setUaeOpen(true)
    }

    setImportMessage(`✓ Filled from ${title}`)
  }

  const handleClearForm = () => {
    setPropertyData(emptyPropertyData())
    setSelectedPropertyId('')
    setGeneratedContent(null)
    setDocumentExtracted(false)
    setImportMessage(null)
    setUaeOpen(false)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ]
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

      const response = await fetch('http://localhost:3001/api/listing-writer/parse-document', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to parse document')
      }

      const result = await response.json()

      if (result.success && result.data) {
        setPropertyData((prev) => ({
          ...prev,
          propertyType: result.data.property_type || prev.propertyType,
          location: result.data.location || prev.location,
          price: result.data.price || prev.price,
          bedrooms: result.data.bedrooms || prev.bedrooms,
          bathrooms: result.data.bathrooms || prev.bathrooms,
          sqft: result.data.sqft || prev.sqft,
          features: result.data.features || prev.features,
          sellingPoints: result.data.selling_points || prev.sellingPoints,
        }))
        setDocumentExtracted(true)
      } else {
        throw new Error(result.error || 'Invalid response from server')
      }
    } catch (error: any) {
      console.error('Error uploading document:', error)
      alert(
        `Error parsing document: ${error.message}\n\nPlease try again or fill the form manually.`
      )
    } finally {
      setUploading(false)
    }
  }

  const handleFeatureToggle = (feature: string) => {
    setPropertyData((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }))
  }

  const handleGenerateListing = async () => {
    if (!propertyData.location || !propertyData.price) {
      alert('Please fill in at least location and price')
      return
    }

    try {
      setGenerating(true)

      const response = await fetch('http://localhost:3001/api/listing-writer/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyData,
          agentName: agent?.full_name || 'Agent',
          agentEmail: agent?.email || '',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate listing')
      }

      const result = await response.json()

      if (result.success && result.content) {
        setGeneratedContent({
          fullDescription: result.content.fullDescription || '',
          instagramCaption: result.content.instagramCaption || '',
          facebookPost: result.content.facebookPost || '',
          buyerEmail: result.content.buyerEmail || '',
          whatsappMessage: result.content.whatsappMessage || '',
          nriInternational: result.content.nriInternational || '',
        })
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
    { key: 'whatsappMessage', label: 'WhatsApp', icon: Sparkles },
    { key: 'nriInternational', label: 'NRI / International', icon: Globe2 },
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Listing Writer</h1>
        <p className="text-slate-600 mt-1">Generate professional UAE property listings in seconds</p>
      </div>

      <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-white rounded-xl border-2 border-dashed border-purple-300 p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Upload Property Document</h3>
          <p className="text-slate-600 mb-4 max-w-md">
            Upload brochure, floor plan, or property document — AI will extract all details
            automatically
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

          <p className="text-xs text-slate-500 mt-3">Supports PDF, Word, JPG, PNG</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Home className="w-5 h-5 text-purple-600" />
            Property Details
          </h2>

          {/* Import from Property */}
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <label className="block text-sm font-medium text-slate-700">
              Pre-fill from existing property
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedPropertyId}
                onChange={(e) => handleImportProperty(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-sm"
              >
                <option value="">Select a property…</option>
                {properties.map((p) => {
                  const label = p.title || p.address || 'Untitled'
                  const loc = [p.address, p.city].filter(Boolean).join(', ') || '—'
                  const price =
                    p.price != null ? `AED ${Number(p.price).toLocaleString()}` : 'AED —'
                  return (
                    <option key={p.id} value={p.id}>
                      {label} — {loc} — {price}
                    </option>
                  )
                })}
              </select>
              <button
                type="button"
                onClick={handleClearForm}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-white"
              >
                Clear
              </button>
            </div>
            {importMessage && (
              <p className="text-sm font-medium text-green-600">{importMessage}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Property Type</label>
            <select
              value={propertyData.propertyType}
              onChange={(e) => setPropertyData({ ...propertyData, propertyType: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select type...</option>
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location
            </label>
            <input
              type="text"
              value={propertyData.location}
              onChange={(e) => setPropertyData({ ...propertyData, location: e.target.value })}
              placeholder="e.g., Dubai Marina, Dubai"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Price (AED)
            </label>
            <input
              type="text"
              value={propertyData.price}
              onChange={(e) => setPropertyData({ ...propertyData, price: e.target.value })}
              placeholder="e.g., 2100000"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Maximize className="w-4 h-4 inline mr-1" />
              Size (sqm)
            </label>
            <input
              type="text"
              value={propertyData.sqft}
              onChange={(e) => setPropertyData({ ...propertyData, sqft: e.target.value })}
              placeholder="e.g., 120"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Key Features</label>
            <div className="grid grid-cols-2 gap-3">
              {FEATURES_OPTIONS.map((feature) => (
                <label key={feature} className="flex items-center gap-2 cursor-pointer">
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Unique Selling Points
            </label>
            <textarea
              value={propertyData.sellingPoints}
              onChange={(e) => setPropertyData({ ...propertyData, sellingPoints: e.target.value })}
              placeholder="What makes this property special? e.g., Marina views, branded residence, high ROI..."
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* UAE-Specific Details (collapsible) */}
          <div
            className="overflow-hidden"
            style={{
              border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setUaeOpen((o) => !o)}
              className="w-full flex items-center justify-between text-left"
              style={{
                background: 'rgba(124,58,237,0.08)',
                padding: '12px 16px',
                cursor: 'pointer',
              }}
            >
              <span className="text-sm font-semibold text-slate-900">
                🇦🇪 UAE-Specific Details
              </span>
              <ChevronDown
                className={`w-4 h-4 text-violet-700 transition-transform ${
                  uaeOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {uaeOpen && (
              <div className="p-4 space-y-4 border-t border-violet-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Developer Track Record
                  </label>
                  <input
                    type="text"
                    value={propertyData.developerTrackRecord}
                    onChange={(e) =>
                      setPropertyData({
                        ...propertyData,
                        developerTrackRecord: e.target.value,
                      })
                    }
                    placeholder="e.g. Emaar — 115,000+ units delivered since 1997, known for Burj Khalifa and Downtown Dubai"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Expected Handover
                  </label>
                  <input
                    type="text"
                    value={propertyData.handoverQuarter}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, handoverQuarter: e.target.value })
                    }
                    placeholder="e.g. Q4 2027"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Payment Plan
                  </label>
                  <input
                    type="text"
                    value={propertyData.paymentPlan}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, paymentPlan: e.target.value })
                    }
                    placeholder="e.g. 30% on booking, 40% during construction, 30% on handover"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    District Stage
                  </label>
                  <select
                    value={propertyData.districtStage}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, districtStage: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  >
                    <option value="">Select district stage (optional)</option>
                    <option value="1">
                      Stage 1 — Early Speculation (highest upside, highest risk)
                    </option>
                    <option value="2">
                      Stage 2 — Infrastructure Arrival (best risk-adjusted entry point)
                    </option>
                    <option value="3">
                      Stage 3 — Community Maturity (stable yields, lower appreciation)
                    </option>
                    <option value="4">
                      Stage 4 — Saturation / Repositioning (building-level due diligence needed)
                    </option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={propertyData.isFreehold}
                    onChange={(e) =>
                      setPropertyData({ ...propertyData, isFreehold: e.target.checked })
                    }
                    className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-700">
                    Freehold Zone (foreigners can own)
                  </span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Target Buyer
                  </label>
                  <select
                    value={propertyData.targetBuyer}
                    onChange={(e) =>
                      setPropertyData({
                        ...propertyData,
                        targetBuyer: e.target.value as PropertyData['targetBuyer'],
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {TARGET_BUYER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

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

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => (
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

          <div className="p-6">
            {!generatedContent ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to Generate</h3>
                <p className="text-slate-600 max-w-sm">
                  Fill in the property details and click &quot;Generate Listing&quot; to create
                  professional marketing content
                </p>
              </div>
            ) : (
              <div className="space-y-4">
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

                <div className="prose prose-slate max-w-none">
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">
                      {generatedContent[activeTab] || 'No content for this tab yet.'}
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
