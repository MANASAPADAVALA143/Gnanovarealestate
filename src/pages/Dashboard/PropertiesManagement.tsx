import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle,
  Clock,
  Home,
  DollarSign,
  BedDouble,
  Bath,
  Maximize,
  PenTool
} from 'lucide-react'

interface Property {
  id: string
  title?: string
  address: string
  city: string
  state?: string
  country?: string
  price: number
  bedrooms: number
  bathrooms: number
  sqft?: number
  property_type?: string
  amenities?: string[]
  description?: string
  photos?: string[]
  virtual_tour_url?: string
  status: string
  embedding?: number[]
  created_at?: string
}

export default function PropertiesManagement() {
  const { agent } = useAuth()
  const navigate = useNavigate()
  const [properties, setProperties] = useState<Property[]>([])
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [embedding, setEmbedding] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddForm, setShowAddForm] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{
    total: number
    success: number
    errors: string[]
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    fetchProperties()
  }, [agent])

  useEffect(() => {
    // Filter properties based on search term
    if (!searchTerm) {
      setFilteredProperties(properties)
    } else {
      const term = searchTerm.toLowerCase()
      const filtered = properties.filter(p =>
        p.address?.toLowerCase().includes(term) ||
        p.city?.toLowerCase().includes(term) ||
        p.title?.toLowerCase().includes(term) ||
        p.property_type?.toLowerCase().includes(term)
      )
      setFilteredProperties(filtered)
    }
    setCurrentPage(1)
  }, [searchTerm, properties])

  async function fetchProperties() {
    try {
      setLoading(true)
      
      const response = await fetch(`http://localhost:3001/api/properties?agentId=${agent?.id}`)
      const data = await response.json()

      if (data.success) {
        setProperties(data.properties)
        setFilteredProperties(data.properties)
      }
    } catch (error) {
      console.error('Error fetching properties:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCSVUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setUploadProgress(null)

      const csvText = await file.text()

      console.log('📤 Sending CSV upload request...')
      console.log('CSV length:', csvText.length)
      console.log('Agent ID:', agent?.id)

      const response = await fetch('http://localhost:3001/api/properties/upload-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvText,
          agentId: agent?.id,
        }),
      })

      console.log('📥 Response status:', response.status)
      console.log('📥 Response ok:', response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Server error:', errorText)
        throw new Error(`Server returned ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('✅ Result:', result)

      if (result.success) {
        setUploadProgress({
          total: result.count + (result.errors?.length || 0),
          success: result.count,
          errors: result.errors || [],
        })
        
        alert(`Successfully uploaded ${result.count} properties!${result.errors?.length ? `\n\nWarnings: ${result.errors.length} properties had issues.` : ''}`)
        await fetchProperties()
      } else {
        const errorMessage = result.errors?.length > 0 
          ? result.errors.join('\n') 
          : result.error || 'Unknown error occurred'
        alert(`Upload failed:\n\n${errorMessage}`)
      }
    } catch (error: any) {
      console.error('CSV upload error:', error)
      alert(`Upload error: ${error.message}`)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleGenerateEmbeddings() {
    if (!confirm('Generate embeddings for all properties without them? This may take a few minutes.')) {
      return
    }

    try {
      setEmbedding(true)

      const response = await fetch('http://localhost:3001/api/properties/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (result.success) {
        alert(`✅ Successfully generated embeddings for ${result.count} properties!`)
        await fetchProperties()
      } else {
        alert(`❌ Embedding failed: ${result.error}`)
      }
    } catch (error: any) {
      console.error('Embedding error:', error)
      alert(`❌ Error: ${error.message}`)
    } finally {
      setEmbedding(false)
    }
  }

  async function handleDeleteProperty(propertyId: string) {
    if (!confirm('Are you sure you want to delete this property?')) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3001/api/properties/${propertyId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        alert('Property deleted successfully')
        await fetchProperties()
      } else {
        alert(`Delete failed: ${result.error}`)
      }
    } catch (error: any) {
      console.error('Delete error:', error)
      alert(`Error: ${error.message}`)
    }
  }

  function handleWriteListing(property: Property) {
    // Navigate to Listing Writer with pre-filled data
    navigate('/dashboard/listing-writer', {
      state: {
        propertyData: {
          property_type: property.property_type,
          address: property.address,
          city: property.city,
          location: `${property.address}, ${property.city}${property.state ? ', ' + property.state : ''}`,
          price: property.price,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          sqft: property.sqft,
          amenities: property.amenities || [],
          description: property.description || ''
        }
      }
    })
  }

  function downloadSampleCSV() {
    const link = document.createElement('a')
    link.href = '/sample-properties.csv'
    link.download = 'sample-properties.csv'
    link.click()
  }

  // Pagination
  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedProperties = filteredProperties.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  // Count properties with/without embeddings
  const embeddedCount = properties.filter(p => p.embedding).length
  const pendingCount = properties.length - embeddedCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            Upload, manage, and search your property listings
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Add Property
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Home className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Properties</p>
              <p className="text-2xl font-bold text-gray-900">{properties.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Embedded</p>
              <p className="text-2xl font-bold text-gray-900">{embeddedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Price</p>
              <p className="text-2xl font-bold text-gray-900">
                AED{' '}
                {properties.length > 0
                  ? Math.round(
                      properties.reduce((sum, p) => sum + (Number(p.price) || 0), 0) /
                        properties.length /
                        1000
                    )
                  : 0}
                K
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Upload Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Bulk Upload Properties</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Upload Area */}
          <div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
                id="csv-upload"
                disabled={uploading}
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {uploading ? 'Uploading...' : 'Click to upload CSV'}
                </p>
                <p className="text-xs text-gray-500">
                  or drag and drop your CSV file here
                </p>
              </label>
            </div>

            {uploadProgress && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Upload Complete!
                </p>
                <p className="text-xs text-blue-800">
                  ✅ Successful: {uploadProgress.success} / {uploadProgress.total}
                </p>
                {uploadProgress.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-red-800 font-medium">Errors:</p>
                    {uploadProgress.errors.slice(0, 3).map((err, idx) => (
                      <p key={idx} className="text-xs text-red-700">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={downloadSampleCSV}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              <Download className="w-5 h-5" />
              Download Sample CSV Template
            </button>

            <button
              onClick={handleGenerateEmbeddings}
              disabled={embedding || pendingCount === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50"
            >
              {embedding ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  Generating Embeddings...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Generate Embeddings ({pendingCount})
                </>
              )}
            </button>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">
                <strong>CSV Format:</strong>
              </p>
              <p className="text-xs text-gray-500 font-mono">
                title, address, city, state, country, price, bedrooms, bathrooms, sqm, property_type, amenities, description, virtual_tour_url
                (use sqm for size — UAE square metres; column may still be named sqft in DB)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by address, city, or type..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <p className="text-sm text-gray-600">
            {filteredProperties.length} properties
          </p>
        </div>
      </div>

      {/* Properties Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Embedding</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading properties...
                  </td>
                </tr>
              ) : paginatedProperties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {searchTerm ? 'No properties match your search' : 'No properties yet. Upload a CSV or add manually.'}
                  </td>
                </tr>
              ) : (
                paginatedProperties.map((property) => (
                  <tr key={property.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {property.title || property.address}
                        </p>
                        <p className="text-xs text-gray-500">{property.property_type || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{property.city}</p>
                      <p className="text-xs text-gray-500">{property.state || property.country}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">
                        AED {property.price?.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <BedDouble className="w-4 h-4" />
                          {property.bedrooms}
                        </span>
                        <span className="flex items-center gap-1">
                          <Bath className="w-4 h-4" />
                          {property.bathrooms}
                        </span>
                        {property.sqft && (
                          <span className="flex items-center gap-1">
                            <Maximize className="w-4 h-4" />
                            {property.sqft} sqm
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        property.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {property.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {property.embedding ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs">
                          <CheckCircle className="w-4 h-4" />
                          Embedded
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-yellow-600 text-xs">
                          <Clock className="w-4 h-4" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleWriteListing(property)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg flex items-center gap-1.5 transition-all"
                          title="Write Listing"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          Write Listing
                        </button>
                        <button
                          onClick={() => handleDeleteProperty(property.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                          title="Delete Property"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredProperties.length)} of {filteredProperties.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Property Modal */}
      {showAddForm && (
        <AddPropertyModal
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false)
            fetchProperties()
          }}
          agentId={agent?.id}
        />
      )}
    </div>
  )
}

// Add Property Modal Component
function AddPropertyModal({ 
  onClose, 
  onSuccess,
  agentId 
}: { 
  onClose: () => void
  onSuccess: () => void
  agentId?: string
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    address: '',
    city: '',
    state: '',
    country: 'USA',
    price: '',
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    property_type: 'single_family',
    amenities: '',
    description: '',
    virtual_tour_url: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      setLoading(true)

      const property = {
        ...formData,
        price: parseFloat(formData.price),
        bedrooms: parseInt(formData.bedrooms),
        bathrooms: parseFloat(formData.bathrooms),
        sqft: formData.sqft ? parseInt(formData.sqft) : undefined,
        amenities: formData.amenities ? formData.amenities.split(',').map(a => a.trim()) : [],
        agentId,
      }

      const response = await fetch('http://localhost:3001/api/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(property),
      })

      const result = await response.json()

      if (result.success) {
        alert('Property added successfully!')
        onSuccess()
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Add New Property</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Luxury Waterfront Villa"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="123 Main St"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                placeholder="Miami"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
                placeholder="FL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (AED) *</label>
              <input
                type="number"
                required
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                placeholder="500000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
              <select
                value={formData.property_type}
                onChange={(e) => setFormData({...formData, property_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="single_family">Single Family</option>
                <option value="condo">Condo</option>
                <option value="townhouse">Townhouse</option>
                <option value="apartment">Apartment</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms *</label>
              <input
                type="number"
                required
                value={formData.bedrooms}
                onChange={(e) => setFormData({...formData, bedrooms: e.target.value})}
                placeholder="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms *</label>
              <input
                type="number"
                step="0.5"
                required
                value={formData.bathrooms}
                onChange={(e) => setFormData({...formData, bathrooms: e.target.value})}
                placeholder="2.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Size (sqm)</label>
              <input
                type="number"
                value={formData.sqft}
                onChange={(e) => setFormData({...formData, sqft: e.target.value})}
                placeholder="185"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amenities (comma-separated)</label>
              <input
                type="text"
                value={formData.amenities}
                onChange={(e) => setFormData({...formData, amenities: e.target.value})}
                placeholder="pool, garage, smart home"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Beautiful property with..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Virtual Tour URL</label>
              <input
                type="url"
                value={formData.virtual_tour_url}
                onChange={(e) => setFormData({...formData, virtual_tour_url: e.target.value})}
                placeholder="https://example.com/tour"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
