'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import PropertyCard, { PropertyCardSkeleton } from '../../../components/properties/PropertyCard'
import { apiFetch } from '../../../lib/api-fetch'
import type { Property, PropertySearchFilters, PropertyType } from '../../../types/property'

type CachedEntry = {
  properties: Property[]
  resultsCount: number
}

const LOCATIONS = ['Miami', 'Austin', 'Phoenix', 'Las Vegas', 'Atlanta']

const PROPERTY_TYPE_OPTIONS: { label: string; value: PropertyType }[] = [
  { label: 'Single Family', value: 'single_family' },
  { label: 'Condo', value: 'condo' },
  { label: 'Townhouse', value: 'townhouse' },
  { label: 'Apartment', value: 'apartment' },
]

const PAGE_SIZE = 6

export default function PropertiesPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const [minPrice, setMinPrice] = useState<number | undefined>()
  const [maxPrice, setMaxPrice] = useState<number | undefined>()
  const [minBeds, setMinBeds] = useState<number | undefined>()
  const [selectedTypes, setSelectedTypes] = useState<PropertyType[]>([])
  const [location, setLocation] = useState<string | undefined>()

  const [properties, setProperties] = useState<Property[]>([])
  const [resultsCount, setResultsCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const [suggestions, setSuggestions] = useState<string[]>([])

  const cacheRef = useRef<Map<string, CachedEntry>>(new Map())

  // Debounce query input
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim())
      setPage(1)
    }, 500)
    return () => clearTimeout(handle)
  }, [query])

  const filtersForRequest: PropertySearchFilters = useMemo(
    () => ({
      query: debouncedQuery || 'property search',
      minPrice,
      maxPrice,
      minBeds,
      location,
      // If exactly one type is selected, send it to the API; otherwise filter client-side.
      propertyType: selectedTypes.length === 1 ? selectedTypes[0] : undefined,
    }),
    [debouncedQuery, minPrice, maxPrice, minBeds, location, selectedTypes]
  )

  const cacheKey = useMemo(
    () => JSON.stringify(filtersForRequest),
    [filtersForRequest]
  )

  // Fetch properties whenever debounced query or filters change
  useEffect(() => {
    if (!debouncedQuery) {
      setProperties([])
      setResultsCount(0)
      return
    }

    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setProperties(cached.properties)
      setResultsCount(cached.resultsCount)
      return
    }

    let cancelled = false
    const fetchProperties = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiFetch('/api/properties/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filtersForRequest),
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || 'Failed to fetch properties')
        }

        const data: {
          success: boolean
          properties: Property[]
          query: string
          resultsCount: number
        } = await res.json()

        if (!data.success) {
          throw new Error('Search failed')
        }

        if (!cancelled) {
          let props = data.properties
          // If multiple property types selected, filter client-side
          if (selectedTypes.length > 1) {
            props = props.filter(
              (p) => p.property_type && selectedTypes.includes(p.property_type)
            )
          }

          setProperties(props)
          setResultsCount(props.length)
          cacheRef.current.set(cacheKey, { properties: props, resultsCount: props.length })

          // update suggestions
          setSuggestions((prev) => {
            const next = new Set(prev)
            if (data.query) next.add(data.query)
            return Array.from(next)
          })
        }
      } catch (err: any) {
        console.error('Error fetching properties:', err)
        if (!cancelled) {
          setError(err?.message || 'Failed to load properties')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchProperties()

    return () => {
      cancelled = true
    }
  }, [cacheKey, debouncedQuery, filtersForRequest, selectedTypes.length])

  const visibleProperties = useMemo(
    () => properties.slice(0, page * PAGE_SIZE),
    [properties, page]
  )

  const hasMore = visibleProperties.length < properties.length

  const handleToggleType = (type: PropertyType) => {
    setPage(1)
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleViewDetails = (id: string) => {
    // You can route to a property details page or open a modal here
    console.log('View details for property', id)
  }

  const handleBookViewing = (id: string) => {
    // You can open a booking modal or call /api/bookings/create here
    console.log('Book viewing for property', id)
  }

  const showEmptyState = !loading && visibleProperties.length === 0 && debouncedQuery

  // Autocomplete suggestions that match current query
  const filteredSuggestions = suggestions
    .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        {/* Search bar with autocomplete */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Search properties
          </label>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by features, budget, or location..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {filteredSuggestions.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                {filteredSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQuery(s)}
                    className="block w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Try: &quot;3 bedroom house under $500K in Miami&quot; or
            &quot;condos with pool in Austin&quot;.
          </p>
        </div>

        {/* Quick stats */}
        <div className="text-xs text-slate-500 lg:text-right">
          {loading ? (
            <span>Searching properties...</span>
          ) : (
            debouncedQuery && (
              <span>
                {resultsCount} result{resultsCount === 1 ? '' : 's'} found
              </span>
            )
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Price range */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Price range</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={minPrice ?? ''}
              onChange={(e) =>
                setMinPrice(e.target.value ? Number(e.target.value) : undefined)
              }
              className="w-1/2 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="number"
              placeholder="Max"
              value={maxPrice ?? ''}
              onChange={(e) =>
                setMaxPrice(e.target.value ? Number(e.target.value) : undefined)
              }
              className="w-1/2 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Bedrooms */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Bedrooms</p>
          <select
            value={minBeds ?? ''}
            onChange={(e) =>
              setMinBeds(e.target.value ? Number(e.target.value) : undefined)
            }
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5+</option>
          </select>
        </div>

        {/* Property types */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Property type</p>
          <div className="flex flex-wrap gap-1.5">
            {PROPERTY_TYPE_OPTIONS.map((opt) => {
              const active = selectedTypes.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleToggleType(opt.value)}
                  className={`px-2 py-1 rounded-full text-[11px] border transition ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Location */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Location</p>
          <select
            value={location ?? ''}
            onChange={(e) => setLocation(e.target.value || undefined)}
            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All cities</option>
            {LOCATIONS.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results grid */}
      {showEmptyState ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm font-semibold text-slate-700 mb-1">
            No properties match your criteria
          </p>
          <p className="text-xs text-slate-500">
            Try adjusting your filters or broadening your search terms.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {loading && properties.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: PAGE_SIZE }).map((_, idx) => (
                <PropertyCardSkeleton key={idx} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleProperties.map((property) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    onViewDetails={handleViewDetails}
                    onBookViewing={handleBookViewing}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

