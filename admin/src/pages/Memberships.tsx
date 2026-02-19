import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { Membership, MembershipTier, MembershipStatus } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';

const TIER_BADGES: Record<string, string> = {
  local_player: 'bg-gray-100 text-gray-700',
  sand_regular: 'bg-sand/20 text-amber-800',
  founders: 'bg-purple-100 text-purple-700',
};

const TIER_LABELS: Record<string, string> = {
  local_player: 'Local Player',
  sand_regular: 'Sand Regular',
  founders: 'Founders',
};

const STATUS_BADGES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function Memberships() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMembership, setSelectedMembership] =
    useState<Membership | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [filterTier, setFilterTier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('memberships')
      .select('*, user:users(*)')
      .order('created_at', { ascending: false });

    if (filterTier) {
      query = query.eq('tier', filterTier);
    }
    if (filterStatus) {
      query = query.eq('status', filterStatus);
    }

    const { data } = await query;
    if (data) setMemberships(data as Membership[]);
    setLoading(false);
  }, [filterTier, filterStatus]);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  async function handleCancel(membership: Membership) {
    if (
      !window.confirm(
        `Cancel membership for ${membership.user?.full_name || 'this user'}?`
      )
    ) {
      return;
    }
    setActionLoading(true);
    const { error } = await supabase
      .from('memberships')
      .update({ status: 'cancelled' })
      .eq('id', membership.id);

    if (error) {
      alert('Failed to cancel: ' + error.message);
    } else {
      setSelectedMembership(null);
      loadMemberships();
    }
    setActionLoading(false);
  }

  async function handleUpgrade(
    membership: Membership,
    newTier: MembershipTier
  ) {
    setActionLoading(true);

    const discounts: Record<string, number> = {
      local_player: 0,
      sand_regular: 10,
      founders: 20,
    };
    const priorityHours: Record<string, number> = {
      local_player: 0,
      sand_regular: 12,
      founders: 24,
    };

    const { error } = await supabase
      .from('memberships')
      .update({
        tier: newTier,
        discount_percent: discounts[newTier] || 0,
        priority_booking_hours: priorityHours[newTier] || 0,
      })
      .eq('id', membership.id);

    if (error) {
      alert('Failed to upgrade: ' + error.message);
    } else {
      setSelectedMembership(null);
      loadMemberships();
    }
    setActionLoading(false);
  }

  const columns: Column<Membership>[] = [
    {
      key: 'user_id',
      header: 'Member',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">
            {row.user?.full_name || 'Unknown'}
          </p>
          <p className="text-xs text-gray-500">{row.user?.phone || ''}</p>
        </div>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      sortable: true,
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            TIER_BADGES[row.tier] || 'bg-gray-100 text-gray-600'
          }`}
        >
          {TIER_LABELS[row.tier] || row.tier}
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
      key: 'discount_percent',
      header: 'Discount',
      sortable: true,
      render: (row) => `${row.discount_percent}%`,
    },
    {
      key: 'current_period_end',
      header: 'Period',
      sortable: true,
      render: (row) => (
        <div className="text-xs">
          <p>{format(new Date(row.current_period_start), 'MMM d')} -</p>
          <p>{format(new Date(row.current_period_end), 'MMM d, yyyy')}</p>
        </div>
      ),
    },
    {
      key: 'guest_passes_remaining',
      header: 'Guest Passes',
      sortable: true,
      render: (row) => String(row.guest_passes_remaining),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Memberships</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage member subscriptions.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Tier
          </label>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
          >
            <option value="">All Tiers</option>
            <option value="local_player">Local Player</option>
            <option value="sand_regular">Sand Regular</option>
            <option value="founders">Founders</option>
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
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="past_due">Past Due</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button
          onClick={() => {
            setFilterTier('');
            setFilterStatus('');
          }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      <DataTable
        columns={columns}
        data={memberships as unknown as Record<string, unknown>[]}
        loading={loading}
        onRowClick={(row) =>
          setSelectedMembership(row as unknown as Membership)
        }
      />

      {/* Membership Detail Modal */}
      <Modal
        isOpen={!!selectedMembership}
        onClose={() => setSelectedMembership(null)}
        title="Membership Details"
      >
        {selectedMembership && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Member
                </p>
                <p className="mt-0.5 text-sm font-medium">
                  {selectedMembership.user?.full_name || 'Unknown'}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedMembership.user?.phone || ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Tier
                </p>
                <p className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      TIER_BADGES[selectedMembership.tier] ||
                      'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {TIER_LABELS[selectedMembership.tier] ||
                      selectedMembership.tier}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Status
                </p>
                <p className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      STATUS_BADGES[selectedMembership.status] ||
                      'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {selectedMembership.status.replace('_', ' ')}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Discount
                </p>
                <p className="mt-0.5 text-lg font-bold">
                  {selectedMembership.discount_percent}%
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Priority Booking
                </p>
                <p className="mt-0.5 text-sm">
                  {selectedMembership.priority_booking_hours} hours ahead
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Guest Passes
                </p>
                <p className="mt-0.5 text-sm">
                  {selectedMembership.guest_passes_remaining} remaining
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium uppercase text-gray-500">
                  Current Period
                </p>
                <p className="mt-0.5 text-sm">
                  {format(
                    new Date(selectedMembership.current_period_start),
                    'MMM d, yyyy'
                  )}{' '}
                  -{' '}
                  {format(
                    new Date(selectedMembership.current_period_end),
                    'MMM d, yyyy'
                  )}
                </p>
              </div>
              {selectedMembership.stripe_subscription_id && (
                <div className="col-span-2">
                  <p className="text-xs font-medium uppercase text-gray-500">
                    Stripe Subscription
                  </p>
                  <p className="mt-0.5 font-mono text-sm text-gray-700">
                    {selectedMembership.stripe_subscription_id}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
              {selectedMembership.status === 'active' && (
                <>
                  {selectedMembership.tier !== 'founders' && (
                    <button
                      onClick={() => {
                        const nextTier: Record<string, MembershipTier> = {
                          local_player: 'sand_regular',
                          sand_regular: 'founders',
                        };
                        handleUpgrade(
                          selectedMembership,
                          nextTier[selectedMembership.tier]
                        );
                      }}
                      disabled={actionLoading}
                      className="rounded-lg bg-sand px-4 py-2 text-sm font-semibold text-white hover:bg-sand/90 disabled:opacity-60"
                    >
                      {actionLoading ? 'Processing...' : 'Upgrade Tier'}
                    </button>
                  )}
                  <button
                    onClick={() => handleCancel(selectedMembership)}
                    disabled={actionLoading}
                    className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral/90 disabled:opacity-60"
                  >
                    {actionLoading ? 'Processing...' : 'Cancel Membership'}
                  </button>
                </>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setSelectedMembership(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
