import { X } from 'lucide-react'
import { useEffect } from 'react'

interface DemoModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function DemoModal({ isOpen, onClose }: DemoModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1E293B] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
          <h3 className="text-xl font-bold text-white">Book Your Free Demo</h3>
          <button type="button" onClick={onClose} className="text-[#94A3B8] hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="p-6">
          <p className="mb-6 text-sm text-[#94A3B8]">
            See Priya qualify a live lead and walk through pipeline, commissions, and payment runs —
            built for UAE brokerages.
          </p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Your Name"
              className="w-full rounded-[10px] border border-white/10 bg-[#243447] px-4 py-3 text-white placeholder:text-[#64748B] focus:border-[#7C3AED] focus:outline-none"
            />
            <input
              type="email"
              placeholder="Work Email"
              className="w-full rounded-[10px] border border-white/10 bg-[#243447] px-4 py-3 text-white placeholder:text-[#64748B] focus:border-[#7C3AED] focus:outline-none"
            />
            <input
              type="tel"
              placeholder="+971-50-123-4567"
              className="w-full rounded-[10px] border border-white/10 bg-[#243447] px-4 py-3 text-white placeholder:text-[#64748B] focus:border-[#7C3AED] focus:outline-none"
            />
            <select className="w-full rounded-[10px] border border-white/10 bg-[#243447] px-4 py-3 text-white focus:border-[#7C3AED] focus:outline-none">
              <option>Dubai</option>
              <option>Abu Dhabi</option>
              <option>Sharjah</option>
              <option>Other UAE</option>
            </select>
            <button
              type="button"
              className="w-full rounded-[10px] bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] px-6 py-3 font-semibold text-white shadow-[0_8px_32px_rgba(124,58,237,0.35)]"
            >
              Schedule Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
