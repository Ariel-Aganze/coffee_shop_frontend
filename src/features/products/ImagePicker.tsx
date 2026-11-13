import { ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useId, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'

import type { ProductType } from './api'
import { ProductThumb } from './ProductThumb'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

interface ImagePickerProps {
  /** Photo already saved on the server. */
  currentUrl: string | null | undefined
  /** Newly chosen file (not uploaded yet). */
  file: File | null
  /** The saved photo is marked for removal. */
  removed: boolean
  type: ProductType
  error?: string | undefined
  onPick: (file: File) => void
  onRemove: () => void
  onInvalid: (message: string) => void
}

/** Product photo with preview; checks type and size before anything is sent. */
export function ImagePicker(props: ImagePickerProps) {
  const { currentUrl, file, removed, type, error, onPick, onRemove, onInvalid } = props
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl])

  const shown = previewUrl ?? (removed ? null : currentUrl)

  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0]
    event.target.value = '' // picking the same file again still fires change
    if (!picked) return
    if (!IMAGE_TYPES.includes(picked.type)) return onInvalid(t('products.imageType'))
    if (picked.size > MAX_IMAGE_BYTES) return onInvalid(t('products.imageSize'))
    onPick(picked)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink" id={`${id}-label`}>
        {t('products.photo')}
      </span>
      <div className="flex items-center gap-4">
        <ProductThumb image={shown} type={type} className="size-20 rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            leadingIcon={<ImagePlus className="size-4" aria-hidden="true" />}
            aria-describedby={`${id}-hint`}
          >
            {shown ? t('products.replacePhoto') : t('products.addPhoto')}
          </Button>
          {shown && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              leadingIcon={<Trash2 className="size-4" aria-hidden="true" />}
            >
              {t('products.removePhoto')}
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          onChange={choose}
        />
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {t('products.photoHint')}
        </p>
      )}
    </div>
  )
}
