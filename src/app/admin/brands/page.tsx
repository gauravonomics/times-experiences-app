'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { MoreHorizontal, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetcher, mutate } from '@/lib/admin/fetcher'
import { ViewHeader } from '@/components/admin/view-header'
import { DataTable, type Column } from '@/components/admin/data-table'
import { ImageUpload } from '@/components/admin/image-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { Brand } from '@/lib/supabase/types'

interface BrandsResponse {
  brands: Brand[]
}

interface BrandForm {
  name: string
  logo_url: string | null
  primary_color: string
}

const emptyForm: BrandForm = {
  name: '',
  logo_url: null,
  primary_color: '#6366f1',
}

function formFromBrand(b: Brand): BrandForm {
  return {
    name: b.name,
    logo_url: b.logo_url,
    primary_color: b.primary_color ?? '#6366f1',
  }
}

export default function BrandsPage() {
  const { data, isLoading, mutate: revalidate } = useSWR<BrandsResponse>(
    '/api/admin/brands',
    fetcher
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BrandForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(brand: Brand) {
    setEditingId(brand.id)
    setForm(formFromBrand(brand))
    setDialogOpen(true)
  }

  function openDelete(brand: Brand) {
    setDeletingBrand(brand)
    setDeleteDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Brand name is required.')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        logo_url: form.logo_url,
        primary_color: form.primary_color,
      }

      if (editingId) {
        await mutate(`/api/admin/brands/${editingId}`, 'PATCH', body)
        toast.success('Brand updated.')
      } else {
        await mutate('/api/admin/brands', 'POST', body)
        toast.success('Brand created.')
      }

      setDialogOpen(false)
      revalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save brand.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingBrand) return
    setDeleting(true)
    try {
      await mutate(`/api/admin/brands/${deletingBrand.id}`, 'DELETE')
      toast.success('Brand deleted.')
      setDeleteDialogOpen(false)
      setDeletingBrand(null)
      revalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete brand.')
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<Brand>[] = [
    {
      key: 'logo',
      header: 'Logo',
      render: (b) =>
        b.logo_url ? (
          <img
            src={b.logo_url}
            alt={`${b.name} logo`}
            className="h-8 w-8 rounded object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-bold text-muted-foreground">
            {b.name.charAt(0).toUpperCase()}
          </div>
        ),
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (b) => <span className="font-medium">{b.name}</span>,
    },
    {
      key: 'slug',
      header: 'Slug',
      sortable: true,
      render: (b) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {b.slug}
        </code>
      ),
    },
    {
      key: 'primary_color',
      header: 'Color',
      render: (b) =>
        b.primary_color ? (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 rounded-full border"
              style={{ backgroundColor: b.primary_color }}
            />
            <code className="text-xs text-muted-foreground">
              {b.primary_color}
            </code>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (b) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                openEdit(b)
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation()
                openDelete(b)
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div>
      <ViewHeader
        title="Brands"
        description="Manage brand profiles and theming."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Brand
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.brands ?? []}
          rowKey={(b) => b.id}
          emptyMessage="No brands yet. Create one to get started."
        />
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Brand' : 'Create Brand'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the brand details below.'
                : 'Fill in the details to create a new brand.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="brand-name">Name</Label>
              <Input
                id="brand-name"
                placeholder="e.g. Times Experiences"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Logo</Label>
              <ImageUpload
                bucket="images"
                folder="brands"
                value={form.logo_url}
                onChange={(url) => setForm({ ...form, logo_url: url })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="brand-color">Primary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="brand-color"
                  value={form.primary_color}
                  onChange={(e) =>
                    setForm({ ...form, primary_color: e.target.value })
                  }
                  className="h-10 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <Input
                  value={form.primary_color}
                  onChange={(e) =>
                    setForm({ ...form, primary_color: e.target.value })
                  }
                  placeholder="#6366f1"
                  className="w-32 font-mono text-sm"
                />
                <span
                  className="inline-block h-6 w-6 rounded-full border"
                  style={{ backgroundColor: form.primary_color }}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Brand</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deletingBrand?.name}</strong>? This will fail if any
              events still reference this brand.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
