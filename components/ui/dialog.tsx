import * as React from 'react'

// Minimal dialog implementation with a shadcn/ui-compatible API.
// This avoids adding new dependencies while letting us use <Dialog>, <DialogContent>, etc.

type DialogProps = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null

  const handleClose = () => {
    onOpenChange?.(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        className="max-h-[95vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

type DialogContentProps = {
  children: React.ReactNode
  className?: string
}

export function DialogContent({ children, className = '' }: DialogContentProps) {
  return <div className={`flex flex-col ${className}`}>{children}</div>
}

type DialogHeaderProps = {
  children: React.ReactNode
  className?: string
}

export function DialogHeader({ children, className = '' }: DialogHeaderProps) {
  return <div className={`border-b border-slate-200 px-4 py-3 ${className}`}>{children}</div>
}

type DialogTitleProps = {
  children: React.ReactNode
  className?: string
}

export function DialogTitle({ children, className = '' }: DialogTitleProps) {
  return <h2 className={`text-lg font-semibold text-slate-900 ${className}`}>{children}</h2>
}

type DialogDescriptionProps = {
  children: React.ReactNode
  className?: string
}

export function DialogDescription({ children, className = '' }: DialogDescriptionProps) {
  return <p className={`text-sm text-slate-600 ${className}`}>{children}</p>
}

type DialogCloseProps = {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function DialogClose({ children, onClick, className = '' }: DialogCloseProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 ${className}`}
    >
      {children}
    </button>
  )
}

