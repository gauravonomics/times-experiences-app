'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { MoreHorizontal, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetcher, mutate } from '@/lib/admin/fetcher'
import { ViewHeader } from '@/components/admin/view-header'
import { DataTable, type Column } from '@/components/admin/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import type { Template } from '@/lib/supabase/types'

interface TemplatesResponse {
  templates: Template[]
}

interface TemplateForm {
  name: string
  type: string
  default_capacity: string
  description_prompt: string
  default_metadata: string
}

const emptyForm: TemplateForm = {
  name: '',
  type: '',
  default_capacity: '',
  description_prompt: '',
  default_metadata: '',
}

function formFromTemplate(t: Template): TemplateForm {
  return {
    name: t.name,
    type: t.type,
    default_capacity: t.default_capacity?.toString() ?? '',
    description_prompt: t.description_prompt ?? '',
    default_metadata: t.default_metadata ? JSON.stringify(t.default_metadata, null, 2) : '',
  }
}

export default function TemplatesPage() {
  const { data, isLoading, mutate: revalidate } = useSWR<TemplatesResponse>(
    '/api/admin/templates',
    fetcher
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(template: Template) {
    setEditingId(template.id)
    setForm(formFromTemplate(template))
    setDialogOpen(true)
  }

  function openDelete(template: Template) {
    setDeletingTemplate(template)
    setDeleteDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.type.trim()) {
      toast.error('Name and type are required.')
      return
    }

    // Validate JSON if provided
    let parsedMetadata: Record<string, unknown> | undefined
    if (form.default_metadata.trim()) {
      try {
        parsedMetadata = JSON.parse(form.default_metadata)
      } catch {
        toast.error('Default metadata must be valid JSON.')
        return
      }
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type.trim(),
      }
      if (form.default_capacity.trim()) {
        body.default_capacity = parseInt(form.default_capacity, 10)
      } else {
        body.default_capacity = null
      }
      if (form.description_prompt.trim()) {
        body.description_prompt = form.description_prompt.trim()
      } else {
        body.description_prompt = null
      }
      if (parsedMetadata) {
        body.default_metadata = parsedMetadata
      }

      if (editingId) {
        await mutate(`/api/admin/templates/${editingId}`, 'PATCH', body)
        toast.success('Template updated.')
      } else {
        await mutate('/api/admin/templates', 'POST', body)
        toast.success('Template created.')
      }

      setDialogOpen(false)
      revalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingTemplate) return
    setDeleting(true)
    try {
      await mutate(`/api/admin/templates/${deletingTemplate.id}`, 'DELETE')
      toast.success('Template deleted.')
      setDeleteDialogOpen(false)
      setDeletingTemplate(null)
      revalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete template.')
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<Template>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (t) => <span className="font-medium">{t.name}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (t) => <Badge variant="secondary">{t.type}</Badge>,
    },
    {
      key: 'default_capacity',
      header: 'Default Capacity',
      sortable: true,
      render: (t) => (
        <span className="text-muted-foreground">
          {t.default_capacity ?? '—'}
        </span>
      ),
    },
    {
      key: 'description_prompt',
      header: 'Description Prompt',
      render: (t) => (
        <span className="text-muted-foreground">
          {t.description_prompt
            ? t.description_prompt.length > 80
              ? `${t.description_prompt.substring(0, 80)}...`
              : t.description_prompt
            : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (t) => (
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
                openEdit(t)
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
                openDelete(t)
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
        title="Templates"
        description="Reusable event templates and page designs."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
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
          data={data?.templates ?? []}
          rowKey={(t) => t.id}
          emptyMessage="No templates yet. Create one to get started."
        />
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the template details below.'
                : 'Fill in the details to create a new event template.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                placeholder="e.g. Supper Club"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-type">Type</Label>
              <Input
                id="template-type"
                placeholder="e.g. dinner, workshop, panel"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-capacity">Default Capacity</Label>
              <Input
                id="template-capacity"
                type="number"
                placeholder="e.g. 50"
                value={form.default_capacity}
                onChange={(e) =>
                  setForm({ ...form, default_capacity: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-prompt">Description Prompt</Label>
              <Textarea
                id="template-prompt"
                placeholder="Style/tone guidance for event descriptions..."
                rows={3}
                value={form.description_prompt}
                onChange={(e) =>
                  setForm({ ...form, description_prompt: e.target.value })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-metadata">
                Default Metadata{' '}
                <span className="text-muted-foreground">(JSON, optional)</span>
              </Label>
              <Textarea
                id="template-metadata"
                placeholder='{"dress_code": "smart casual"}'
                rows={3}
                className="font-mono text-xs"
                value={form.default_metadata}
                onChange={(e) =>
                  setForm({ ...form, default_metadata: e.target.value })
                }
              />
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
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deletingTemplate?.name}</strong>? This action cannot be
              undone.
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
