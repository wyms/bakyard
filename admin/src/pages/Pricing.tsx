import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PricingRule, PricingRuleType } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';
import FormField from '@/components/FormField';
import { Plus } from 'lucide-react';

const RULE_TYPES: { value: PricingRuleType; label: string }[] = [
  { value: 'peak', label: 'Peak' },
  { value: 'off_peak', label: 'Off-Peak' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'surge', label: 'Surge' },
];

const RULE_BADGES: Record<string, string> = {
  peak: 'bg-red-100 text-red-700',
  off_peak: 'bg-green-100 text-green-700',
  weekend: 'bg-blue-100 text-blue-700',
  holiday: 'bg-purple-100 text-purple-700',
  surge: 'bg-amber-100 text-amber-700',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface PricingForm {
  name: string;
  rule_type: PricingRuleType;
  multiplier: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const emptyForm: PricingForm = {
  name: '',
  rule_type: 'peak',
  multiplier: '1.0',
  days_of_week: [],
  start_time: '',
  end_time: '',
  is_active: true,
};

export default function Pricing() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [form, setForm] = useState<PricingForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const SAMPLE_BASE_PRICE = 2000; // $20.00 in cents

  const loadRules = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pricing_rules')
      .select('*')
      .order('name');
    if (data) setRules(data as PricingRule[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(rule: PricingRule) {
    setEditing(rule);
    setForm({
      name: rule.name,
      rule_type: rule.rule_type,
      multiplier: rule.multiplier.toString(),
      days_of_week: rule.days_of_week || [],
      start_time: rule.start_time || '',
      end_time: rule.end_time || '',
      is_active: rule.is_active,
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError('Rule name is required.');
      return;
    }
    const multiplier = parseFloat(form.multiplier);
    if (isNaN(multiplier) || multiplier <= 0) {
      setFormError('Multiplier must be a positive number.');
      return;
    }
    setSaving(true);
    setFormError('');

    const payload = {
      name: form.name.trim(),
      rule_type: form.rule_type,
      multiplier,
      days_of_week: form.days_of_week.length > 0 ? form.days_of_week : null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      is_active: form.is_active,
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from('pricing_rules')
        .update(payload)
        .eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('pricing_rules').insert(payload));
    }

    if (error) {
      setFormError(error.message);
    } else {
      setModalOpen(false);
      loadRules();
    }
    setSaving(false);
  }

  async function toggleActive(rule: PricingRule) {
    await supabase
      .from('pricing_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);
    loadRules();
  }

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day].sort(),
    }));
  }

  const columns: Column<PricingRule>[] = [
    {
      key: 'name',
      header: 'Rule Name',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: 'rule_type',
      header: 'Type',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            RULE_BADGES[row.rule_type] || 'bg-gray-100 text-gray-600'
          }`}
        >
          {row.rule_type.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'multiplier',
      header: 'Multiplier',
      sortable: true,
      render: (row) => (
        <span
          className={`font-semibold ${
            row.multiplier > 1
              ? 'text-red-600'
              : row.multiplier < 1
              ? 'text-green-600'
              : 'text-gray-600'
          }`}
        >
          {row.multiplier}x
        </span>
      ),
    },
    {
      key: 'days_of_week',
      header: 'Days',
      render: (row) =>
        row.days_of_week && row.days_of_week.length > 0
          ? row.days_of_week.map((d) => DAY_NAMES[d]).join(', ')
          : 'All days',
    },
    {
      key: 'start_time',
      header: 'Time Range',
      render: (row) =>
        row.start_time && row.end_time
          ? `${row.start_time} - ${row.end_time}`
          : 'All day',
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

  const previewMultiplier = parseFloat(form.multiplier) || 1;
  const previewPrice = (SAMPLE_BASE_PRICE * previewMultiplier) / 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Pricing Rules</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure dynamic pricing rules for sessions.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal/90"
        >
          <Plus className="h-4 w-4" />
          Create Rule
        </button>
      </div>

      <DataTable
        columns={columns}
        data={rules as unknown as Record<string, unknown>[]}
        loading={loading}
        onRowClick={(row) => openEdit(row as unknown as PricingRule)}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Pricing Rule' : 'Create Pricing Rule'}
      >
        <div className="space-y-4">
          <FormField
            type="text"
            label="Rule Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
            placeholder="e.g. Weekend Peak Hours"
          />
          <FormField
            type="select"
            label="Rule Type"
            value={form.rule_type}
            onChange={(v) =>
              setForm({ ...form, rule_type: v as PricingRuleType })
            }
            options={RULE_TYPES}
          />
          <FormField
            type="number"
            label="Multiplier"
            value={form.multiplier}
            onChange={(v) => setForm({ ...form, multiplier: v })}
            placeholder="e.g. 1.5"
            min="0.1"
            step="0.1"
          />

          {/* Days selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Days of Week
            </label>
            <div className="flex gap-1.5">
              {DAY_NAMES.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    form.days_of_week.includes(i)
                      ? 'bg-teal text-white'
                      : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Leave empty for all days
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              type="time"
              label="Start Time"
              value={form.start_time}
              onChange={(v) => setForm({ ...form, start_time: v })}
            />
            <FormField
              type="time"
              label="End Time"
              value={form.end_time}
              onChange={(v) => setForm({ ...form, end_time: v })}
            />
          </div>

          <FormField
            type="checkbox"
            label="Active"
            checked={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
          />

          {/* Price preview */}
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium uppercase text-gray-500">
              Price Preview
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Base price:{' '}
              <span className="font-medium">
                ${(SAMPLE_BASE_PRICE / 100).toFixed(2)}
              </span>{' '}
              &times; {previewMultiplier}x ={' '}
              <span className="text-lg font-bold text-teal">
                ${previewPrice.toFixed(2)}
              </span>
            </p>
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
