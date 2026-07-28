import { Link } from 'react-router-dom'
import type { ConsentContext } from '../lib/consent'
import { CONSENT_TEXT } from '../lib/consent'

interface ConsentCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  showError?: boolean
  context?: ConsentContext
  /** Light = landing/demo forms; dark = open-house standalone page */
  variant?: 'light' | 'dark'
}

export function ConsentCheckbox({
  checked,
  onChange,
  showError = false,
  context = 'lead',
  variant = 'light',
}: ConsentCheckboxProps) {
  const hasError = showError && !checked
  const isDark = variant === 'dark'

  const boxClass = hasError
    ? isDark
      ? 'bg-orange-500/5 border-orange-400/50'
      : 'bg-orange-50 border-orange-300'
    : isDark
      ? 'bg-sky-500/5 border-sky-400/20'
      : 'bg-blue-50 border-blue-200'

  const textClass = isDark ? 'text-slate-400' : 'text-gray-600'
  const errorClass = isDark ? 'text-orange-300' : 'text-orange-600'
  const linkClass = isDark ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-700'

  return (
    <div className={`my-4 rounded-lg border p-3.5 transition-colors ${boxClass}`}>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-blue-600"
        />
        <span className={`text-xs leading-relaxed sm:text-sm ${textClass}`}>
          {CONSENT_TEXT[context]}{' '}
          <Link to="/privacy-policy" target="_blank" className={`font-medium underline ${linkClass}`}>
            View Privacy Policy
          </Link>
        </span>
      </label>
      {hasError && (
        <p className={`mt-2 pl-6 text-xs ${errorClass}`}>You must agree before submitting.</p>
      )}
    </div>
  )
}

export { CONSENT_TEXT, useConsentGate, type ConsentRecord } from '../lib/consent'
