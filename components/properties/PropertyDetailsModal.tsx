import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '../ui/dialog'
import type { Property, PropertySearchResult } from '../../types/property'
import PropertyCard from './PropertyCard'

type PropertyDetailsModalProps = {
  open: boolean
  property: Property | null
  similarProperties?: PropertySearchResult[]
  onClose: () => void
  onBookViewing: (id: string) => void
  onSendWhatsApp: (id: string) => void
  onShare: (id: string) => void
  onContactAgent: (id: string) => void
}

export default function PropertyDetailsModal({
  open,
  property,
  similarProperties = [],
  onClose,
  onBookViewing,
  onSendWhatsApp,
  onShare,
  onContactAgent,
}: PropertyDetailsModalProps) {
  const [activeIndex, setActiveIndex] = React.useState(0)

  React.useEffect(() => {
    setActiveIndex(0)
  }, [property?.id])

  if (!property) {
    return null
  }

  const photos = property.photos && property.photos.length > 0 ? property.photos : []
  const mainPhoto =
    photos[activeIndex] ||
    'https://via.placeholder.com/800x500?text=Property'

  const price =
    property.price !== null && property.price !== undefined
      ? `$${property.price.toLocaleString()}`
      : 'Price on request'

  const addressLine = property.address || 'Address not available'
  const locationLine = [property.city, property.state, property.zip_code].filter(Boolean).join(', ')

  const beds = property.bedrooms ?? 'N/A'
  const baths = property.bathrooms ?? 'N/A'
  const sqft = property.sqft ? `${property.sqft.toLocaleString()} sqft` : 'Size N/A'

  const amenities = property.amenities ?? []

  const statusLabel =
    property.status === 'off_market'
      ? 'Off Market'
      : property.status.charAt(0).toUpperCase() + property.status.slice(1)

  const statusColor =
    property.status === 'active'
      ? 'bg-emerald-100 text-emerald-800'
      : property.status === 'pending'
      ? 'bg-amber-100 text-amber-800'
      : property.status === 'sold'
      ? 'bg-rose-100 text-rose-800'
      : 'bg-slate-100 text-slate-700'

  const handleCopyLink = () => {
    onShare(property.id)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
        <DialogHeader className="flex items-start justify-between gap-3">
          <div>
            <DialogTitle>{addressLine}</DialogTitle>
            <DialogDescription>{locationLine}</DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}
            >
              {statusLabel}
            </span>
            <DialogClose onClick={onClose}>Close</DialogClose>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Top section: gallery + summary */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Photo gallery */}
            <div className="w-full lg:w-2/3">
              <div className="relative h-56 sm:h-72 md:h-80 w-full overflow-hidden rounded-xl bg-slate-100">
                <img
                  src={mainPhoto}
                  alt={addressLine}
                  className="h-full w-full object-cover"
                />
              </div>
              {photos.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {photos.map((photo, index) => (
                    <button
                      key={photo + index}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={`h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border ${
                        index === activeIndex
                          ? 'border-blue-500'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <img
                        src={photo}
                        alt={`Thumbnail ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Summary / key facts */}
            <div className="w-full lg:w-1/3 space-y-4">
              <div>
                <p className="text-2xl font-bold text-slate-900">{price}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {beds} bd • {baths} ba • {sqft}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <div>
                  <p className="font-semibold text-slate-800">Year built</p>
                  <p>{property.year_built ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Property type</p>
                  <p>{property.property_type ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Parking</p>
                  <p>{property.parking || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-800">HOA fee</p>
                  <p>{property.hoa_fee ? `$${property.hoa_fee.toLocaleString()}` : 'None'}</p>
                </div>
                <div className="col-span-2">
                  <p className="font-semibold text-slate-800">School district</p>
                  <p>{property.school_district || 'Not specified'}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onBookViewing(property.id)}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                >
                  Book Viewing
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSendWhatsApp(property.id)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Send via WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Share
                  </button>
                </div>
              </div>

              {/* Agent info */}
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="text-[11px] font-semibold text-slate-700 mb-1">
                  Listing agent
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {property.listing_agent_name || 'Your Gnanova agent'}
                </p>
                <div className="mt-1 space-y-1">
                  {property.listing_agent_phone && (
                    <p>
                      <a
                        href={`tel:${property.listing_agent_phone}`}
                        className="text-blue-600 hover:underline"
                      >
                        {property.listing_agent_phone}
                      </a>
                    </p>
                  )}
                  {property.listing_agent_email && (
                    <p>
                      <a
                        href={`mailto:${property.listing_agent_email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {property.listing_agent_email}
                      </a>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onContactAgent(property.id)}
                  className="mt-3 inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition"
                >
                  Contact Agent
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Description</h3>
              <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                {property.description}
              </p>
            </section>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    {amenity}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Virtual tour */}
          {property.virtual_tour_url && (
            <section>
              <button
                type="button"
                onClick={() => window.open(property.virtual_tour_url!, '_blank')}
                className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                View Virtual Tour
              </button>
            </section>
          )}

          {/* Similar properties */}
          {similarProperties.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Similar properties</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {similarProperties.slice(0, 3).map((sp) => (
                  <PropertyCard
                    key={sp.id}
                    property={sp}
                    onViewDetails={onViewDetailsFromSimilar}
                    onBookViewing={onBookViewing}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )

  function onViewDetailsFromSimilar(id: string) {
    // When clicking a similar property, simply log or you can swap the main property in parent.
    console.log('View details from similar property', id)
  }
}

