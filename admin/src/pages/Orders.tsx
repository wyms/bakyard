import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { Order, Booking, User } from '@/lib/types';
import DataTable, { type Column } from '@/components/DataTable';
import Modal from '@/components/Modal';

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  refunded: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
};

interface OrderWithRelations extends Order {
  booking?: Booking & { session?: { product?: { title: string } } };
  user?: User;
}

export default function Orders() {
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRelations | null>(
    null
  );
  const [refunding, setRefunding] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select(
        '*, booking:bookings(*, session:sessions(product:products(title))), user:users(*)'
      )
      .order('created_at', { ascending: false });

    if (filterStatus) {
      query = query.eq('status', filterStatus);
    }
    if (filterDateFrom) {
      query = query.gte('created_at', new Date(filterDateFrom).toISOString());
    }
    if (filterDateTo) {
      query = query.lte(
        'created_at',
        new Date(filterDateTo + 'T23:59:59').toISOString()
      );
    }

    const { data } = await query;
    if (data) setOrders(data as OrderWithRelations[]);
    setLoading(false);
  }, [filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleRefund(order: OrderWithRelations) {
    if (
      !window.confirm(
        `Refund $${((order.amount_cents - order.discount_cents) / 100).toFixed(2)} for this order?`
      )
    ) {
      return;
    }
    setRefunding(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', order.id);

    if (error) {
      alert('Failed to process refund: ' + error.message);
    } else {
      setSelectedOrder(null);
      loadOrders();
    }
    setRefunding(false);
  }

  const columns: Column<OrderWithRelations>[] = [
    {
      key: 'id',
      header: 'Order ID',
      render: (row) => (
        <span className="font-mono text-xs text-gray-500">
          {row.id.slice(0, 8)}...
        </span>
      ),
    },
    {
      key: 'user_id',
      header: 'User',
      render: (row) => (
        <span className="font-medium text-gray-900">
          {row.user?.full_name || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'amount_cents',
      header: 'Amount',
      sortable: true,
      render: (row) => {
        const net = row.amount_cents - row.discount_cents;
        return (
          <div>
            <span className="font-medium">
              ${(net / 100).toFixed(2)}
            </span>
            {row.discount_cents > 0 && (
              <span className="ml-1 text-xs text-green-600">
                (-${(row.discount_cents / 100).toFixed(2)})
              </span>
            )}
          </div>
        );
      },
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
          {row.status}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      render: (row) => format(new Date(row.created_at), 'MMM d, yyyy h:mm a'),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage customer orders and payments.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4">
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
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </select>
        </div>
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
        <button
          onClick={() => {
            setFilterStatus('');
            setFilterDateFrom('');
            setFilterDateTo('');
          }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
        >
          Clear
        </button>
      </div>

      <DataTable
        columns={columns}
        data={orders as unknown as Record<string, unknown>[]}
        loading={loading}
        onRowClick={(row) =>
          setSelectedOrder(row as unknown as OrderWithRelations)
        }
      />

      {/* Order Detail Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title="Order Details"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Order ID
                </p>
                <p className="mt-0.5 font-mono text-sm">{selectedOrder.id}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Status
                </p>
                <p className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      STATUS_BADGES[selectedOrder.status] ||
                      'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {selectedOrder.status}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Customer
                </p>
                <p className="mt-0.5 text-sm font-medium">
                  {selectedOrder.user?.full_name || 'Unknown'}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedOrder.user?.phone || ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Date
                </p>
                <p className="mt-0.5 text-sm">
                  {format(
                    new Date(selectedOrder.created_at),
                    'MMM d, yyyy h:mm a'
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Amount
                </p>
                <p className="mt-0.5 text-lg font-bold">
                  $
                  {(
                    (selectedOrder.amount_cents -
                      selectedOrder.discount_cents) /
                    100
                  ).toFixed(2)}
                </p>
                {selectedOrder.discount_cents > 0 && (
                  <p className="text-xs text-green-600">
                    Discount: -$
                    {(selectedOrder.discount_cents / 100).toFixed(2)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Product
                </p>
                <p className="mt-0.5 text-sm">
                  {selectedOrder.booking?.session?.product?.title || '--'}
                </p>
              </div>
            </div>

            {selectedOrder.stripe_payment_intent_id && (
              <div className="rounded-lg bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase text-gray-500">
                  Stripe Payment Intent
                </p>
                <p className="mt-0.5 font-mono text-sm text-gray-700">
                  {selectedOrder.stripe_payment_intent_id}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              {selectedOrder.status === 'paid' && (
                <button
                  onClick={() => handleRefund(selectedOrder)}
                  disabled={refunding}
                  className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral/90 disabled:opacity-60"
                >
                  {refunding ? 'Processing...' : 'Refund'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
