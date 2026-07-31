import type { Property } from '../../types/property'
import {
  computePricePerSqm,
  formatPricePerSqm,
  getDistrictStageMeta,
} from '../../src/lib/uae-property'

type PropertyCardProps = {
  property: Property
  onViewDetails: (id: string) => void
  onBookViewing: (id: string) => void
}

export function PropertyCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-pulse">
      <div className="h-40 bg-slate-200" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-2/3" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="flex gap-2 mt-2">
          <div className="h-9 bg-slate-200 rounded w-24" />
          <div className="h-9 bg-slate-200 rounded w-28" />
        </div>
      </div>
    </div>
  )
}

export default function PropertyCard({
  property,
  onViewDetails,
  onBookViewing,
}: PropertyCardProps) {
  const mainPhoto =
    property.photos && property.photos.length > 0
      ? property.photos[0]
      : 'https://via.placeholder.com/600x400?text=Property'

  const price =
    property.price !== null && property.price !== undefined
      ? `AED ${property.price.toLocaleString()}`
      : 'Price on request'

  const addressLine = property.address || 'Address not available'

  const beds = property.bedrooms ?? 'N/A'
  const baths = property.bathrooms ?? 'N/A'
  const sqft = property.sqft ? `${property.sqft.toLocaleString()} sqm` : 'Size N/A'

  const amenities = property.amenities ?? []
  const keyAmenities = amenities.slice(0, 3)

  const pricePerSqmLabel = formatPricePerSqm(
    property.price_per_sqm ?? computePricePerSqm(property.price, property.sqft)
  )
  const districtMeta = getDistrictStageMeta(property.district_stage ?? null)
  const isFreehold = property.is_freehold !== false

  const rawStatus = property.status && String(property.status).trim() ? String(property.status) : 'unknown'

  const statusColor =
    rawStatus === 'active'
      ? 'bg-emerald-100 text-emerald-800'
      : rawStatus === 'pending'
      ? 'bg-amber-100 text-amber-800'
      : rawStatus === 'sold'
      ? 'bg-rose-100 text-rose-800'
      : 'bg-slate-100 text-slate-700'

  const statusLabel =
    rawStatus === 'off_market'
      ? 'Off Market'
      : rawStatus === 'unknown'
      ? 'Unknown'
      : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1)

  return (
    <div className="group flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative h-44 w-full overflow-hidden">
        <img
          src={mainPhoto}
          alt={addressLine}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold bg-black/60 text-white">
          {price}
        </div>
        <div
          className={`absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}
        >
          {statusLabel}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 truncate">{addressLine}</p>
          <p className="text-xs text-slate-500">
            {[property.city, property.state, property.zip_code].filter(Boolean).join(', ')}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span>
            <span className="font-semibold">{beds}</span> bd
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>
            <span className="font-semibold">{baths}</span> ba
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>{sqft}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {pricePerSqmLabel && (
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {pricePerSqmLabel}
            </span>
          )}
          {property.handover_quarter?.trim() && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
              {property.handover_quarter.trim()}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isFreehold
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isFreehold ? '✓ Freehold' : 'Leasehold'}
          </span>
          {districtMeta && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${districtMeta.badgeClass}`}
            >
              {districtMeta.shortLabel}
            </span>
          )}
        </div>

        {keyAmenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {keyAmenities.map((amenity) => (
              <span
                key={amenity}
                className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-100"
              >
                {amenity}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => onViewDetails(property.id)}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            View Details
          </button>
          <button
            type="button"
            onClick={() => onBookViewing(property.id)}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            Book Viewing
          </button>
        </div>
      </div>
    </div>
  )
}

