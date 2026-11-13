import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField } from '@/components/ui/SelectField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { useFormat } from '@/features/business/useBusiness'
import { ApiError } from '@/lib/api/errors'
import { applyServerErrors, fieldMessage } from '@/lib/forms'

import {
  categoryKeys,
  createProduct,
  fetchCategoryOptions,
  PRODUCT_TYPES,
  productKeys,
  updateProduct,
  type Product,
} from './api'
import { ImagePicker } from './ImagePicker'
import { amountSchema, marginRatio } from '@/lib/amount'

const FIELDS = [
  'name',
  'sku',
  'category',
  'product_type',
  'description',
  'initial_selling_price',
  'initial_cost_price',
] as const

function buildSchema(decimals: number) {
  return z.object({
    name: z.string().trim().min(1, 'products.nameRequired').max(255),
    sku: z
      .string()
      .trim()
      .min(1, 'products.skuRequired')
      .max(64)
      .regex(/^[\w.-]+$/, 'products.skuInvalid'),
    category: z.string(),
    product_type: z.enum(PRODUCT_TYPES),
    description: z.string().trim().max(2000),
    initial_selling_price: amountSchema(decimals, { required: false }),
    initial_cost_price: amountSchema(decimals, { required: false }),
  })
}
type FormInput = z.input<ReturnType<typeof buildSchema>>
type FormOutput = z.output<ReturnType<typeof buildSchema>>

interface ProductFormDialogProps {
  open: boolean
  onClose: () => void
  /** Edit this product; omit to add a new one. */
  product?: Product | null
}

export function ProductFormDialog({ open, onClose, product }: ProductFormDialogProps) {
  const { t } = useTranslation()
  const format = useFormat()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !product
  const { currencyCode, currencyDecimals } = format.settings
  const [formError, setFormError] = useState<string | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [imageError, setImageError] = useState<string | undefined>()

  const categories = useQuery({
    queryKey: categoryKeys.options,
    queryFn: fetchCategoryOptions,
    enabled: open,
    staleTime: 60_000,
  })

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(buildSchema(currencyDecimals)),
    values: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      category: product?.category ? String(product.category) : '',
      product_type: product?.product_type ?? 'drink',
      description: product?.description ?? '',
      initial_selling_price: '',
      initial_cost_price: '',
    },
  })
  const [type, price, cost] = useWatch({
    control,
    name: ['product_type', 'initial_selling_price', 'initial_cost_price'],
  })

  function close() {
    reset()
    setFormError(null)
    setImage(null)
    setImageRemoved(false)
    setImageError(undefined)
    onClose()
  }

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null)
    if (isNew && !data.initial_selling_price) {
      setError('initial_selling_price', { message: 'products.amountRequired' })
      return
    }
    const category = data.category ? Number(data.category) : null
    try {
      let saved: Product
      if (product) {
        const changes = Object.fromEntries(
          (['name', 'sku', 'product_type', 'description'] as const)
            .filter((f) => dirtyFields[f])
            .map((f) => [f, data[f]]),
        )
        if (dirtyFields.category) Object.assign(changes, { category })
        if (imageRemoved && !image) Object.assign(changes, { image: null })
        saved = product
        if (Object.keys(changes).length > 0) saved = await updateProduct(product.id, changes)
        if (image) saved = await updateProduct(product.id, {}, image)
        toast.success(t('products.saved'))
      } else {
        saved = await createProduct(
          {
            name: data.name,
            sku: data.sku,
            category,
            product_type: data.product_type,
            description: data.description,
            initial_selling_price: data.initial_selling_price,
            ...(data.initial_cost_price ? { initial_cost_price: data.initial_cost_price } : {}),
          },
          image,
        )
        const id = saved.id
        toast.success(t('products.created', { name: saved.name }), {
          action: { label: t('products.open'), onClick: () => void navigate(`/products/${id}`) },
        })
      }
      queryClient.setQueryData(productKeys.detail(saved.id), saved)
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: categoryKeys.all }) // product counts
      close()
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.image) {
        setImageError(error.fieldErrors.image.join(' '))
      }
      setFormError(applyServerErrors(error, setError, {}, [...FIELDS, 'image' as never]))
    }
  })

  const err = (field: keyof FormInput) => fieldMessage(t, errors[field]?.message)
  const options = (categories.data ?? []).filter((c) => c.is_active || c.id === product?.category)
  const margin = marginRatio(price, cost || '0')
  const imageChanged = image !== null || imageRemoved

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      dismissible={!isSubmitting}
      title={product ? t('products.editTitle', { name: product.name }) : t('products.addTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={isSubmitting}>
            {t('changePassword.cancel')}
          </Button>
          <Button
            type="submit"
            form="product-form"
            loading={isSubmitting}
            disabled={!isNew && !isDirty && !imageChanged}
          >
            {isNew ? t('products.create') : t('products.save')}
          </Button>
        </>
      }
    >
      {formError && (
        <Alert tone="danger" className="mb-4">
          {formError}
        </Alert>
      )}
      <form
        id="product-form"
        onSubmit={(e) => void onSubmit(e)}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <TextField
          label={t('products.name')}
          className="sm:col-span-2"
          autoComplete="off"
          error={err('name')}
          {...register('name')}
        />
        <TextField
          label={t('products.sku')}
          hint={t('products.skuHint')}
          autoCapitalize="characters"
          spellCheck={false}
          autoComplete="off"
          error={err('sku')}
          {...register('sku')}
        />
        <SelectField
          label={t('products.type')}
          error={err('product_type')}
          {...register('product_type')}
        >
          {PRODUCT_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`products.types.${value}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('products.category')}
          className="sm:col-span-2"
          hint={
            options.length === 0 && !categories.isPending
              ? t('products.noCategoriesHint')
              : undefined
          }
          error={err('category')}
          {...register('category')}
        >
          <option value="">{t('products.noCategory')}</option>
          {options.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.is_active ? c.name : t('products.categoryInactive', { name: c.name })}
            </option>
          ))}
        </SelectField>

        {isNew && (
          <>
            <TextField
              label={t('products.sellingPrice')}
              inputMode="decimal"
              autoComplete="off"
              trailing={<span className="pr-3 text-sm text-ink-muted">{currencyCode}</span>}
              error={err('initial_selling_price')}
              {...register('initial_selling_price')}
            />
            <TextField
              label={t('products.costPrice')}
              inputMode="decimal"
              autoComplete="off"
              trailing={<span className="pr-3 text-sm text-ink-muted">{currencyCode}</span>}
              hint={
                margin === null
                  ? t('products.costHint')
                  : t('products.marginPreview', { margin: format.percent(margin * 100) })
              }
              error={err('initial_cost_price')}
              {...register('initial_cost_price')}
            />
          </>
        )}

        <TextAreaField
          label={t('products.description')}
          className="sm:col-span-2"
          rows={3}
          error={err('description')}
          {...register('description')}
        />

        <div className="sm:col-span-2">
          <ImagePicker
            currentUrl={product?.image}
            file={image}
            removed={imageRemoved}
            type={type}
            error={imageError}
            onPick={(file) => {
              setImage(file)
              setImageRemoved(false)
              setImageError(undefined)
            }}
            onRemove={() => {
              setImage(null)
              setImageRemoved(Boolean(product?.image))
              setImageError(undefined)
            }}
            onInvalid={setImageError}
          />
        </div>
      </form>
    </Dialog>
  )
}
