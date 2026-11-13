import { Search, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  className?: string
  /** Wait this long after typing stops before reporting the value. */
  debounceMs?: number
}

/** Search box that reports its value once typing pauses, with a clear button. */
export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
  className,
  debounceMs = 300,
}: SearchInputProps) {
  const { t } = useTranslation()
  const id = useId()
  const [draft, setDraft] = useState(value)

  // Follow outside changes (e.g. back button, "clear filters").
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChange(draft.trim()), debounceMs)
    return () => clearTimeout(timer)
  }, [draft, value, onChange, debounceMs])

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder ?? label}
        autoComplete="off"
        className="h-11 w-full rounded-control border border-border bg-surface pr-10 pl-10 text-base text-ink placeholder:text-ink-subtle focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none sm:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft('')
            onChange('')
          }}
          aria-label={t('list.clearSearch')}
          className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
