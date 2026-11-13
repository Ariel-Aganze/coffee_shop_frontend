import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combine class names conditionally and let later Tailwind classes win over
 * earlier conflicting ones: cn('px-2', isWide && 'px-6') → 'px-6'.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
