import { useEffect, useState, useCallback } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { Court, Session } from '@/lib/types';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import { Plus, Pencil } from 'lucide-react';

interface CourtForm {
  name: string;
  surface_type: string;
  is_available: boolean;
  sort_order: string;
}

const emptyForm: CourtForm = {
  name: '',
  surface_type: 'sand',
  is_available: true,
  sort_order: '',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-200 border-green-400 text-green-900',
  full: 'bg-amber-200 border-amber-400 text-amber-900',
  in_progress: 'bg-blue-200 border-blue-400 text-blue-900',
  completed: 'bg-gray-200 border-gray-400 text-gray-700',
  cancelled: 'bg-red-200 border-red-400 text-red-900',
};

export default function Courts() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Court | null>(null);
  const [form, setForm] = useState<CourtForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadCourts = useCallback(async () => {
    setLoading(true);
    const [courtsRes, sessionsRes] = await Promise.all([
      supabase.from('courts').select('*').order('sort_order'),
      supabase
        .from('sessions')
        .select('*, product:products(title)')
        .gte('starts_at', startOfDay(new Date()).toISOString())
        .lte('starts_at', endOfDay(new Date()).toISOString())
        .not('court_id', 'is', null)
        .order('starts_at'),
    ]);
    if (courtsRes.data) setCourts(courtsRes.data as Court[]);
    if (sessionsRes.data) setTodaySessions(sessionsRes.data as Session[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCourts();
  }, [loadCourts]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(court: Court) {
    setEditing(court);
    setForm({
      name: court.name,
      surface_type: court.surface_type,
      is_available: court.is_available,
      sort_order: court.sort_order?.toString() || '',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError('Court name is required.');
      return;
    }
    setSaving(true);
    setFormError('');

    const payload = {
      name: form.name.trim(),
      surface_type: form.surface_type,
      is_available: form.is_available,
      sort_order: form.sort_order ? parseInt(form.sort_order) : null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from('courts')
        .update(payload)
        .eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('courts').insert(payload));
    }

    if (error) {
      setFormError(error.message);
    } else {
      setModalOpen(false);
      loadCourts();
    }
    setSaving(false);
  }

  async function toggleAvailability(court: Court) {
    await supabase
      .from('courts')
      .update({ is_available: !court.is_available })
      .eq('id', court.id);
    loadCourts();
  }

  function getCourtSessions(courtId: string) {
    return todaySessions.filter((s) => s.court_id === courtId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-teal" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Courts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your beach volleyball courts.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal/90"
        >
          <Plus className="h-4 w-4" />
          Add Court
        </button>
      </div>

      {/* Courts grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {courts.length === 0 ? (
          <div className="col-span-full rounded-xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-gray-400">No courts configured yet.</p>
          </div>
        ) : (
          courts.map((court) => {
            const courtSessions = getCourtSessions(court.id);
            return (
              <div
                key={court.id}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-charcoal">
                      {court.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-gray-500 capitalize">
                      {court.surface_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(court)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleAvailability(court)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        court.is_available ? 'bg-teal' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          court.is_available
                            ? 'translate-x-6'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Today's schedule */}
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase text-gray-400">
                    Today's Schedule
                  </p>
                  {courtSessions.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">
                      No sessions scheduled
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {courtSessions.map((s) => (
                        <div
                          key={s.id}
                          className={`rounded-lg border px-3 py-2 text-xs ${
                            STATUS_COLORS[s.status] ||
                            'bg-gray-100 border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {format(new Date(s.starts_at), 'h:mm a')} -{' '}
                              {format(new Date(s.ends_at), 'h:mm a')}
                            </span>
                            <span className="capitalize">
                              {s.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="mt-0.5 opacity-80">
                            {s.product?.title || 'Session'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Court' : 'Add Court'}
        size="sm"
      >
        <div className="space-y-4">
          <FormField
            type="text"
            label="Court Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
            placeholder="e.g. Court 1"
          />
          <FormField
            type="select"
            label="Surface Type"
            value={form.surface_type}
            onChange={(v) => setForm({ ...form, surface_type: v })}
            options={[
              { value: 'sand', label: 'Sand' },
              { value: 'grass', label: 'Grass' },
              { value: 'indoor', label: 'Indoor' },
            ]}
          />
          <FormField
            type="number"
            label="Sort Order"
            value={form.sort_order}
            onChange={(v) => setForm({ ...form, sort_order: v })}
            placeholder="e.g. 1"
            min="0"
          />
          <FormField
            type="checkbox"
            label="Available for booking"
            checked={form.is_available}
            onChange={(v) => setForm({ ...form, is_available: v })}
          />

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
              {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
