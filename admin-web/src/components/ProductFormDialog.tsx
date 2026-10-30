import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { useCategories, useSaveProduct } from '@/lib/queries'
import { productSchema, toNumberOrNull, toProductRequest, type ProductForm } from '@/lib/schemas'
import type { Product } from '@/lib/types'
import { Field, ImageUpload, selectClass } from './common'

const emptyVariant = { id: null, label: '', sku: '', mrp: null, sellingPrice: null, stockQty: 0, stockQtyLoaded: null, active: true }

function toForm(product: Product | null): ProductForm {
  if (!product) {
    return {
      categoryId: null as unknown as number,
      name: '',
      description: '',
      brand: '',
      imageUrl: '',
      active: true,
      variants: [emptyVariant as unknown as ProductForm['variants'][number]],
    }
  }
  return {
    categoryId: product.categoryId,
    name: product.name,
    description: product.description ?? '',
    brand: product.brand ?? '',
    imageUrl: product.imageUrl ?? '',
    active: product.active,
    variants: product.variants.map((v) => ({
      id: v.id,
      label: v.label,
      sku: v.sku,
      mrp: v.mrp,
      sellingPrice: v.sellingPrice,
      stockQty: v.stockQty,
      stockQtyLoaded: v.stockQty,
      active: v.active,
    })),
  }
}

export function ProductFormDialog({ open, product, onClose }: { open: boolean; product: Product | null; onClose: () => void }) {
  const categories = useCategories()
  const save = useSaveProduct()
  const form = useForm<ProductForm>({ resolver: zodResolver(productSchema), defaultValues: toForm(product) })
  const variants = useFieldArray({ control: form.control, name: 'variants' })
  const errors = form.formState.errors

  useEffect(() => {
    if (open) form.reset(toForm(product))
  }, [open, product, form])

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      { id: product?.id, body: toProductRequest(values) },
      {
        onSuccess: (p) => {
          toast.success(product ? `Saved ${p.name}` : `Created ${p.name}`)
          onClose()
        },
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    ),
  )

  const numberField = { setValueAs: toNumberOrNull }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'New product'}</DialogTitle>
          <DialogDescription>Each variant is a size or pack with its own price and stock.</DialogDescription>
        </DialogHeader>
        <form id="product-form" onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="p-name" error={errors.name?.message}>
              <Input id="p-name" {...form.register('name')} />
            </Field>
            <Field label="Category" htmlFor="p-category" error={errors.categoryId?.message}>
              <select id="p-category" className={`${selectClass} w-full`} {...form.register('categoryId', numberField)}>
                <option value="">Choose…</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Brand" htmlFor="p-brand" error={errors.brand?.message}>
              <Input id="p-brand" {...form.register('brand')} />
            </Field>
            <div className="flex items-center gap-2 pt-6">
              <Controller
                control={form.control}
                name="active"
                render={({ field }) => <Switch id="p-active" checked={field.value} onCheckedChange={field.onChange} />}
              />
              <label htmlFor="p-active" className="text-sm">
                Visible in the app
              </label>
            </div>
          </div>
          <Field label="Description" htmlFor="p-desc" error={errors.description?.message}>
            <Textarea id="p-desc" rows={2} {...form.register('description')} />
          </Field>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Image</span>
            <Controller
              control={form.control}
              name="imageUrl"
              render={({ field }) => <ImageUpload value={field.value} onChange={field.onChange} />}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Variants</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => variants.append(emptyVariant as unknown as ProductForm['variants'][number])}
                disabled={variants.fields.length >= 20}
              >
                <Plus /> Add variant
              </Button>
            </div>
            {errors.variants?.root?.message && <p className="text-xs text-destructive">{errors.variants.root.message}</p>}
            {errors.variants?.message && <p className="text-xs text-destructive">{errors.variants.message}</p>}
            {variants.fields.map((field, index) => {
              const e = errors.variants?.[index]
              return (
                <div key={field.id} className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1.3fr_0.8fr_0.8fr_0.7fr_auto_auto] sm:items-start">
                  <Field label="Label" htmlFor={`v-label-${index}`} error={e?.label?.message}>
                    <Input id={`v-label-${index}`} placeholder="500 g" {...form.register(`variants.${index}.label`)} />
                  </Field>
                  <Field label="SKU" htmlFor={`v-sku-${index}`} error={e?.sku?.message}>
                    <Input id={`v-sku-${index}`} {...form.register(`variants.${index}.sku`)} />
                  </Field>
                  <Field label="MRP ₹" htmlFor={`v-mrp-${index}`} error={e?.mrp?.message}>
                    <Input id={`v-mrp-${index}`} type="number" step="0.01" min="0" {...form.register(`variants.${index}.mrp`, numberField)} />
                  </Field>
                  <Field label="Price ₹" htmlFor={`v-price-${index}`} error={e?.sellingPrice?.message}>
                    <Input
                      id={`v-price-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      {...form.register(`variants.${index}.sellingPrice`, numberField)}
                    />
                  </Field>
                  <Field label="Stock" htmlFor={`v-stock-${index}`} error={e?.stockQty?.message}>
                    <Input id={`v-stock-${index}`} type="number" min="0" {...form.register(`variants.${index}.stockQty`, numberField)} />
                  </Field>
                  <div className="flex items-center gap-2 sm:pt-7">
                    <Controller
                      control={form.control}
                      name={`variants.${index}.active`}
                      render={({ field: f }) => (
                        <Switch aria-label={`Variant ${index + 1} active`} checked={f.value} onCheckedChange={f.onChange} />
                      )}
                    />
                  </div>
                  <div className="sm:pt-6">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove variant ${index + 1}`}
                      disabled={variants.fields.length === 1}
                      onClick={() => variants.remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
