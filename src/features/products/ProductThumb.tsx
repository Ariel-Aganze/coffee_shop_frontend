import { Coffee, Croissant, Package, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/cn'

import type { ProductType } from './api'

const TYPE_ICONS: Record<ProductType, LucideIcon> = {
  drink: Coffee,
  food: Croissant,
  packaged: Package,
}

interface ProductThumbProps {
  image: string | null | undefined
  type: ProductType
  className?: string
}

/** Product photo, or an icon for its type when there is none. Decorative: the name is next to it. */
export function ProductThumb({ image, type, className }: ProductThumbProps) {
  const Icon = TYPE_ICONS[type]
  return (
    <span
      className={cn(
        'grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-peach text-primary',
        className,
      )}
    >
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <Icon className="size-1/2" aria-hidden="true" />
      )}
    </span>
  )
}
