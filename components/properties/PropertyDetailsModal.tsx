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
import PropertyPaymentPlanPanel from './PropertyPaymentPlanPanel'
import {
  computePricePerSqm,
  capitalizeWords,
  formatPricePerSqm,
  getCompletionStatusMeta,
  getDistrictStageMeta,
} from '../../src/lib/uae-property'
import { Building2 } from 'lucide-react'

type PropertyDetailsModalProps = {
  open: boolean
  property: Property | null
  similarProperties?: PropertySearchResult[]
  isManager?: boolean
  onClose: () => void
  onBookViewing: (id: string) => void
  onSendWhatsApp: (id: string) => void
  onShare: (id: string) => void
  onContactAgent: (id: string) => void
  onPaymentPlanChanged?: () => void
}

export default function PropertyDetailsModal({
  open,
  property,
  similarProperties = [],
  isManager = false,
  onClose,
  onBookViewing,
  onSendWhatsApp,
  onShare,
  onContactAgent,
  onPaymentPlanChanged,
}: PropertyDetailsModalProps) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [tab, setTab] = React.useState<'overview' | 'payment'>('overview')

  React.useEffect(() => {
    setActiveIndex(0)
    setTab('overview')
  }, [property?.id])

  if (!property) {
    return null
  }

  const photos = [
    ...(property.image_url ? [property.image_url] : []),
    ...((property.photos || []).filter((p) => p && p !== property.image_url)),
  ]
  const mainPhoto = photos[activeIndex] || null

  const price =
    property.price !== null && property.price !== undefined
      ? `AED ${property.price.toLocaleString()}`
      : 'Price on request'

  const addressLine = property.address || 'Address not available'
  const locationLine = [capitalizeWords(property.city), capitalizeWords(property.state)]
    .filter(Boolean)
    .join(', ')

  const beds = property.bedrooms ?? 'N/A'
  const baths = property.bathrooms ?? 'N/A'
  const sqft = property.sqft ? `${property.sqft.toLocaleString()} sqm` : 'Size N/A'

  const amenities = property.amenities ?? []

  const pricePerSqmLabel = formatPricePerSqm(
    property.price_per_sqm ?? computePricePerSqm(property.price, property.sqft)
  )
  const districtMeta = getDistrictStageMeta(property.district_stage ?? null)
  const completionMeta = getCompletionStatusMeta(property.completion_status ?? null)
  const isFreehold = property.is_freehold !== false

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

  function onViewDetailsFromSimilar(id: string) {
    console.log('View details from similar property', id)
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

        <div className="flex gap-1 border-b border-slate-200 px-4">
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === 'overview'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setTab('payment')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === 'payment'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Payment Plan
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {tab === 'payment' ? (
            <PropertyPaymentPlanPanel
              propertyId={property.id}
              propertyPrice={property.price}
              isManager={isManager}
              onPlanChanged={onPaymentPlanChanged}
            />
          ) : (
            <>
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-2/3">
                  <div className="relative h-56 sm:h-72 md:h-80 w-full overflow-hidden rounded-xl bg-slate-100">
                    {mainPhoto ? (
                      <img
                        src={mainPhoto}
                        alt={addressLine}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full flex-col items-center justify-center gap-2"
                        style={{
                          background:
                            'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(6,182,212,0.05) 100%)',
                        }}
                      >
                        <Building2
                          className="h-12 w-12"
                          style={{ color: 'rgba(124,58,237,0.3)' }}
                        />
                        <span className="text-xs text-slate-400">No photo yet</span>
                      </div>
                    )}
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

                <div className="w-full lg:w-1/3 space-y-4">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{price}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {beds} bd • {baths} ba • {sqft}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {completionMeta && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${completionMeta.badgeClass}`}
                        >
                          {completionMeta.label}
                        </span>
                      )}
                      {pricePerSqmLabel && (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {pricePerSqmLabel}
                        </span>
                      )}
                      {property.handover_quarter?.trim() && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">
                          {property.handover_quarter.trim()}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          isFreehold
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isFreehold ? '✓ Freehold' : 'Leasehold'}
                      </span>
                      {districtMeta && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${districtMeta.badgeClass}`}
                        >
                          {districtMeta.shortLabel}
                        </span>
                      )}
                    </div>
                    {property.developer_track_record?.trim() && (
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                        <span className="font-semibold text-slate-800">Developer: </span>
                        {property.developer_track_record.trim()}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div>
                      <p className="font-semibold text-slate-800">Completion Status</p>
                      <p>
                        {completionMeta ? (
                          <span
                            className={`inline-flex mt-0.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${completionMeta.badgeClass}`}
                          >
                            {completionMeta.label}
                          </span>
                        ) : (
                          'Not specified'
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Property type</p>
                      <p>{property.property_type ?? 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Parking</p>
                      <p>
                        {property.parking_spaces != null && property.parking_spaces > 0
                          ? `${property.parking_spaces} space${property.parking_spaces === 1 ? '' : 's'}`
                          : 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Service Charge</p>
                      <p>
                        {property.service_charge != null && Number(property.service_charge) > 0
                          ? `AED ${Number(property.service_charge).toLocaleString()} / year`
                          : 'Not specified'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="font-semibold text-slate-800">RERA Permit No.</p>
                      <p>{property.rera_permit?.trim() || 'Not specified'}</p>
                    </div>
                  </div>

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

              {property.description && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900">Description</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {property.description}
                  </p>
                </section>
              )}

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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
