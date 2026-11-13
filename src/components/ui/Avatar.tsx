import { cn } from '@/lib/cn'
import { initials } from '@/lib/names'

interface AvatarProps {
  name: string
  className?: string
}

/** Initials avatar (staff have no photos). Decorative: the name is shown next to it. */
export function Avatar({ name, className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
