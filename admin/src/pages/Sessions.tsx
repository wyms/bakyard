import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { Session, Product, Court, Booking, SessionStatus } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import { Plus, ArrowLeft } from 'lucide-react';

const STATUS_BADGES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  full: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

const SESSION_STATUSES: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'full', label: 'Full' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface SessionForm {
  product_id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  price_cents: string;
  spots_total: string;
  status: SessionStatus;
}

const emptyForm: SessionForm = {
  product_id: '',
  court_id: '',
  starts_at: '',
  ends_at: '',
  price_cents: '',
  spots_total: '',
  status: 'open',
};

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [form, setForm] = useState<SessionForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Detail view
  const [detailSession, setDetailSession] = useState<Session | null>(null);
  const [sessionBookings, setSessionBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('sessions')
      .select('*, product:products(*), court:courts(*)')
      .order('starts_at', { ascending: false });

    if (filterDateFrom) {
      query = query.gte('starts_at', new Date(filterDateFrom).toISOString());
    }
    if (filterDateTo) {
      query = query.lte(
        'starts_at',
        new Date(filterDateTo + 'T23:59:59').toISOString()
      );
    }
    if (filterProduct) {
      query = query.eq('product_id', filterProduct);
    }
    if (filterStatus) {
      query = query.eq('status', filterStatus);
    }

    const { data } = await query;
    if (data) setSessions(data as Session[]);
    setLoading(false);
  }, [filterDateFrom, filterDateTo, filterProduct, filterStatus]);

  useEffect(() => {
    loadSessions();
    loadProductsAndCourts();
  }, [loadSessions]);

  async function loadProductsAndCourts() {
    const [productsRes, courtsRes] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true).order('title'),
      supabase.from('courts').select('*').order('sort_order'),
    ]);
    if (productsRes.data) setProducts(productsRes.data as Product[]);
    if (courtsRes.data) setCourts(courtsRes.data as Court[]);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openDetail(session: Session) {
    setDetailSession(session);
    loadSessionBookings(session.id);
  }

  async function loadSessionBookings(sessionId: string) {
    setLoadingBookings(true);
    const { data } = await supabase
      .from('bookings')
      .select('*, user:users(*)')
      .eq('session_id', sessionId)
      .order('reserved_at', { ascending: false });
    if (data) setSessionBookings(data as Booking[]);
    setLoadingBookings(false);
  }

  async function handleSave() {
    if (!form.product_id) {
      setFormError('Product is required.');
      return;
    }
    if (!form.starts_at || !form.ends_at) {
      setFormError('Start and end times are required.');
      return;
    }
    setSaving(true);
    setFormError('');

    const spotsTotal = parseInt(form.spots_total) || 0;
    const payload = {
      product_id: form.product_id,
      court_id: form.court_id || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      price_cents: form.price_cents
        ? Math.round(parseFloat(form.price_cents) * 100)
        : 0,
      spots_total: spotsTotal,
      spots_remaining: editing
        ? editing.spots_remaining
        : spotsTotal,
      status: form.status,
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from('sessions')
        .update(payload)
        .eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('sessions').insert(payload));
    }

    if (error) {
      setFormError(error.message);
    } else {
      setModalOpen(false);
      loadSessions();
    }
    setSaving(false);
  }

  const columns: Column<Session>[] = [
    {
      key: 'starts_at',
      header: 'Date / Time',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-gray-900">
            {format(new Date(row.starts_at), 'MMM d, yyyy')}
          </div>
          <div className="text-xs text-gray-500">
            {format(new Date(row.starts_at), 'h:mm a')} -{' '}
            {format(new Date(row.ends_at), 'h:mm a')}
          </div>
        </div>
      ),
    },
    {
      key: 'product_id',
      header: 'Product',
      render: (row) => (
        <span className="font-medium">
          {row.product?.title || '--'}
        </span>
      ),
    },
    {
      key: 'court_id',
      header: 'Court',
      render: (row) => row.court?.name || '--',
    },
    {
      key: 'spots_remaining',
      header: 'Spots',
      sortable: true,
      render: (row) => (
        <span
          className={
            row.spots_remaining === 0 ? 'font-semibold text-red-600' : ''
          }
        >
          {row.spots_total - row.spots_remaining}/{row.spots_total}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_BADGES[row.status] || 'bg-gray-100 text-gray-600'
          }`}
        >
          {row.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'price_cents',
      header: 'Price',
      sortable: true,
      render: (row) => `$${(row.price_cents / 100).toFixed(2)}`,
    },
  ];

  // Detail view
  if (detailSession) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDetailSession(null)}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-charcoal">
              Session Detail
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {detailSession.product?.title} -{' '}
              {format(new Date(detailSession.starts_at), 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase text-gray-500">Court</p>
            <p className="mt-1 text-lg font-semibold">
              {detailSession.court?.name || '--'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase text-gray-500">
              Spots Filled
            </p>
            <p className="mt-1 text-lg font-semibold">
              {detailSession.spots_total - detailSession.spots_remaining}/
              {detailSession.spots_total}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase text-gray-500">Price</p>
            <p className="mt-1 text-lg font-semibold">
              ${(detailSession.price_cents / 100).toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium uppercase text-gray-500">
              Status
            </p>
            <p className="mt-1">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_BADGES[detailSession.status] ||
                  'bg-gray-100 text-gray-600'
                }`}
              >
                {detailSession.status.replace('_', ' ')}
              </span>
            </p>
          </div>
        </div>

        {/* Bookings for this session */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-charcoal">
            Bookings
          </h2>
          {loadingBookings ? (
            <div className="py-8 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-teal" />
            </div>
          ) : sessionBookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No bookings for this session.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    User
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Guests
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Reserved At
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessionBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="py-2.5 font-medium text-gray-900">
                      {b.user?.full_name || 'Unknown'}
                    </td>
                    <td className="py-2.5 text-gray-600">{b.guests}</td>
                    <td className="py-2.5 text-gray-600">
                      {format(new Date(b.reserved_at), 'MMM d, h:mm a')}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          b.status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : b.status === 'reserved'
                            ? 'bg-amber-100 text-amber-700'
                            : b.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Sessions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Schedule and manage sessions for your products.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal/90"
        >
          <Plus className="h-4 w-4" />
          Create Session
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            From
          </label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            To
          </label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Product
          </label>
          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
          >
            {SESSION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setFilterDateFrom('');
            setFilterDateTo('');
            setFilterProduct('');
            setFilterStatus('');
          }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      <DataTable
        columns={columns}
        data={sessions as unknown as Record<string, unknown>[]}
        loading={loading}
        onRowClick={(row) => openDetail(row as unknown as Session)}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Session' : 'Create Session'}
      >
        <div className="space-y-4">
          <FormField
            type="select"
            label="Product"
            value={form.product_id}
            onChange={(v) => setForm({ ...form, product_id: v })}
            required
            options={[
              { value: '', label: 'Select a product' },
              ...products.map((p) => ({ value: p.id, label: p.title })),
            ]}
          />
          <FormField
            type="select"
            label="Court"
            value={form.court_id}
            onChange={(v) => setForm({ ...form, court_id: v })}
            options={[
              { value: '', label: 'No court' },
              ...courts.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              type="datetime-local"
              label="Start Time"
              value={form.starts_at}
              onChange={(v) => setForm({ ...form, starts_at: v })}
              required
            />
            <FormField
              type="datetime-local"
              label="End Time"
              value={form.ends_at}
              onChange={(v) => setForm({ ...form, ends_at: v })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              type="number"
              label="Price ($)"
              value={form.price_cents}
              onChange={(v) => setForm({ ...form, price_cents: v })}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            <FormField
              type="number"
              label="Total Spots"
              value={form.spots_total}
              onChange={(v) => setForm({ ...form, spots_total: v })}
              placeholder="e.g. 12"
              min="1"
            />
          </div>
          {editing && (
            <FormField
              type="select"
              label="Status"
              value={form.status}
              onChange={(v) =>
                setForm({ ...form, status: v as SessionStatus })
              }
              options={SESSION_STATUSES.filter((s) => s.value !== '').map(
                (s) => ({ value: s.value, label: s.label })
              )}
            />
          )}

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
