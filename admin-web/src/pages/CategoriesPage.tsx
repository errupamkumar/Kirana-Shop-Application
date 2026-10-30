import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, ErrorState, Field, ImageUpload, LoadingRows, PageHeader, Thumb } from '@/components/common'
import { apiErrorMessage } from '@/lib/api'
import { useCategories, useDeleteCategory, useSaveCategory } from '@/lib/queries'
import { categorySchema, toNumberOrNull, type CategoryForm } from '@/lib/schemas'
import type { Category } from '@/lib/types'
import { usePageTitle } from '@/lib/usePageTitle'

function toForm(c: Category | null): CategoryForm {
  return c
    ? { name: c.name, slug: c.slug, imageUrl: c.imageUrl ?? '', sortOrder: c.sortOrder, active: c.active }
    : { name: '', slug: '', imageUrl: '', sortOrder: 0, active: true }
}

function CategoryDialog({ open, category, onClose }: { open: boolean; category: Category | null; onClose: () => void }) {
  const save = useSaveCategory()
  const form = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: toForm(category) })
  const errors = form.formState.errors

  useEffect(() => {
    if (open) form.reset(toForm(category))
  }, [open, category, form])

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      { id: category?.id, body: { ...values, slug: values.slug || null, imageUrl: values.imageUrl || null } },
      {
        onSuccess: (c) => {
          toast.success(category ? `Saved ${c.name}` : `Created ${c.name}`)
          onClose()
        },
        onError: (e) => toast.error(apiErrorMessage(e)),
      },
    ),
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
        </DialogHeader>
        <form id="category-form" onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="c-name" error={errors.name?.message}>
            <Input id="c-name" {...form.register('name')} />
          </Field>
          <Field label="Slug" htmlFor="c-slug" error={errors.slug?.message} hint="Leave blank to generate from the name">
            <Input id="c-slug" {...form.register('slug')} />
          </Field>
          <Field label="Sort order" htmlFor="c-sort" error={errors.sortOrder?.message} hint="Lower numbers show first in the app">
            <Input id="c-sort" type="number" min="0" {...form.register('sortOrder', { setValueAs: toNumberOrNull })} />
          </Field>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Image</span>
            <Controller control={form.control} name="imageUrl" render={({ field }) => <ImageUpload value={field.value} onChange={field.onChange} />} />
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="active"
              render={({ field }) => <Switch id="c-active" checked={field.value} onCheckedChange={field.onChange} />}
            />
            <label htmlFor="c-active" className="text-sm">
              Visible in the app
            </label>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function CategoriesPage() {
  usePageTitle('Categories')
  const { data, isLoading, error, refetch } = useCategories()
  const remove = useDeleteCategory()
  const [editing, setEditing] = useState<Category | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Category | null>(null)

  return (
    <>
      <PageHeader
        title="Categories"
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus /> New category
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <LoadingRows />
      ) : !data || data.length === 0 ? (
        <EmptyState message="No categories yet." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="hidden sm:table-cell">Slug</TableHead>
                <TableHead className="hidden sm:table-cell">Sort</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Thumb url={c.imageUrl} alt={c.name} />
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{c.slug}</TableCell>
                  <TableCell className="hidden sm:table-cell">{c.sortOrder}</TableCell>
                  <TableCell>{c.productCount}</TableCell>
                  <TableCell>{c.active ? <Badge variant="secondary">Visible</Badge> : <Badge variant="outline">Hidden</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => {
                        setEditing(c)
                        setDialogOpen(true)
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CategoryDialog open={dialogOpen} category={editing} onClose={() => setDialogOpen(false)} />

      <AlertDialog open={deleting != null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.productCount > 0
                ? `It has ${deleting.productCount} products, so it will be hidden instead of deleted.`
                : 'This category has no products and will be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleting &&
                remove.mutate(deleting.id, {
                  onSuccess: (r) => toast.success(r.deleted ? 'Category deleted' : 'Category hidden (it has products)'),
                  onError: (e) => toast.error(apiErrorMessage(e)),
                })
              }
            >
              {deleting && deleting.productCount > 0 ? 'Hide category' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
