import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, ProductType, User } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import { Plus } from 'lucide-react';

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'court_rental', label: 'Court Rental' },
  { value: 'open_play', label: 'Open Play' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'community_day', label: 'Community Day' },
  { value: 'food_addon', label: 'Food Add-on' },
];

const TYPE_BADGE_COLORS: Record<string, string> = {
  court_rental: 'bg-blue-100 text-blue-700',
  open_play: 'bg-green-100 text-green-700',
  coaching: 'bg-purple-100 text-purple-700',
  clinic: 'bg-amber-100 text-amber-700',
  tournament: 'bg-red-100 text-red-700',
  community_day: 'bg-pink-100 text-pink-700',
  food_addon: 'bg-orange-100 text-orange-700',
};

interface ProductForm {
  title: string;
  type: ProductType;
  description: string;
  base_price_cents: string;
  capacity: string;
  duration_minutes: string;
  tags: string[];
  coach_id: string;
  is_recurring: boolean;
  is_active: boolean;
}

const emptyForm: ProductForm = {
  title: '',
  type: 'court_rental',
  description: '',
  base_price_cents: '',
  capacity: '',
  duration_minutes: '',
  tags: [],
  coach_id: '',
  is_recurring: false,
  is_active: true,
};

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [coaches, setCoaches] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setProducts(data as Product[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
    loadCoaches();
  }, [loadProducts]);

  async function loadCoaches() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'coach');
    if (data) setCoaches(data as User[]);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      title: product.title,
      type: product.type,
      description: product.description || '',
      base_price_cents: product.base_price_cents
        ? (product.base_price_cents / 100).toFixed(2)
        : '',
      capacity: product.capacity?.toString() || '',
      duration_minutes: product.duration_minutes?.toString() || '',
      tags: product.tags || [],
      coach_id: product.coach_id || '',
      is_recurring: product.is_recurring,
      is_active: product.is_active,
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    setSaving(true);
    setFormError('');

    const payload = {
      title: form.title.trim(),
      type: form.type,
      description: form.description.trim() || null,
      base_price_cents: form.base_price_cents
        ? Math.round(parseFloat(form.base_price_cents) * 100)
        : null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      duration_minutes: form.duration_minutes
        ? parseInt(form.duration_minutes)
        : null,
      tags: form.tags.length > 0 ? form.tags : null,
      coach_id: form.coach_id || null,
      is_recurring: form.is_recurring,
      is_active: form.is_active,
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('products').insert(payload));
    }

    if (error) {
      setFormError(error.message);
    } else {
      setModalOpen(false);
      loadProducts();
    }
    setSaving(false);
  }

  async function toggleActive(product: Product) {
    await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);
    loadProducts();
  }

  const columns: Column<Product>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-gray-900">{row.title}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            TYPE_BADGE_COLORS[row.type] || 'bg-gray-100 text-gray-600'
          }`}
        >
          {row.type.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'base_price_cents',
      header: 'Price',
      sortable: true,
      render: (row) =>
        row.base_price_cents != null
          ? `$${(row.base_price_cents / 100).toFixed(2)}`
          : '--',
    },
    {
      key: 'capacity',
      header: 'Capacity',
      sortable: true,
      render: (row) => (row.capacity != null ? String(row.capacity) : '--'),
    },
    {
      key: 'is_active',
      header: 'Active',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleActive(row);
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            row.is_active ? 'bg-teal' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              row.is_active ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your bookable products and offerings.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal/90"
        >
          <Plus className="h-4 w-4" />
          Create Product
        </button>
      </div>

      <DataTable
        columns={columns}
        data={products as unknown as Record<string, unknown>[]}
        loading={loading}
        onRowClick={(row) => openEdit(row as unknown as Product)}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Product' : 'Create Product'}
        size="lg"
      >
        <div className="space-y-4">
          <FormField
            type="text"
            label="Title"
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
            required
            placeholder="e.g. Open Play Session"
          />
          <FormField
            type="select"
            label="Type"
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v as ProductType })}
            options={PRODUCT_TYPES}
          />
          <FormField
            type="textarea"
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="Product description..."
          />
          <div className="grid grid-cols-3 gap-4">
            <FormField
              type="number"
              label="Price ($)"
              value={form.base_price_cents}
              onChange={(v) => setForm({ ...form, base_price_cents: v })}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            <FormField
              type="number"
              label="Capacity"
              value={form.capacity}
              onChange={(v) => setForm({ ...form, capacity: v })}
              placeholder="e.g. 12"
              min="1"
            />
            <FormField
              type="number"
              label="Duration (min)"
              value={form.duration_minutes}
              onChange={(v) => setForm({ ...form, duration_minutes: v })}
              placeholder="e.g. 60"
              min="15"
              step="15"
            />
          </div>
          <FormField
            type="multiselect"
            label="Tags"
            values={form.tags}
            onChange={(v) => setForm({ ...form, tags: v })}
            placeholder="Type a tag and press Enter"
          />
          <FormField
            type="select"
            label="Coach"
            value={form.coach_id}
            onChange={(v) => setForm({ ...form, coach_id: v })}
            options={[
              { value: '', label: 'No coach' },
              ...coaches.map((c) => ({
                value: c.id,
                label: c.full_name || c.id,
              })),
            ]}
          />
          <div className="flex gap-6">
            <FormField
              type="checkbox"
              label="Recurring"
              checked={form.is_recurring}
              onChange={(v) => setForm({ ...form, is_recurring: v })}
            />
            <FormField
              type="checkbox"
              label="Active"
              checked={form.is_active}
              onChange={(v) => setForm({ ...form, is_active: v })}
            />
          </div>

          {formError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal/90 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
