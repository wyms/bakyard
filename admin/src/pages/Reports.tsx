import { useEffect, useState, useCallback } from 'react';
import { format, subDays, parseISO, startOfDay, endOfDay } from 'date-fns';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import type { Order, Session, Booking, Product, Membership } from '@/lib/types';

interface RevenuePoint {
  date: string;
  revenue: number;
}

interface ProductTypeData {
  type: string;
  count: number;
}

interface TimeSlotData {
  hour: string;
  bookings: number;
}

interface TopProduct {
  title: string;
  bookings: number;
  revenue: number;
}

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(
    format(subDays(new Date(), 30), 'yyyy-MM-dd')
  );
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);

  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [productTypeData, setProductTypeData] = useState<ProductTypeData[]>([]);
  const [timeSlotData, setTimeSlotData] = useState<TimeSlotData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [activeMembers, setActiveMembers] = useState(0);
  const [newMembers, setNewMembers] = useState(0);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const fromDate = startOfDay(parseISO(dateFrom)).toISOString();
    const toDate = endOfDay(parseISO(dateTo)).toISOString();

    try {
      const [ordersRes, sessionsRes, bookingsRes, productsRes, membersRes, newMembersRes] =
        await Promise.all([
          supabase
            .from('orders')
            .select('amount_cents, discount_cents, created_at, booking_id')
            .eq('status', 'paid')
            .gte('created_at', fromDate)
            .lte('created_at', toDate),
          supabase
            .from('sessions')
            .select('*, product:products(title, type)')
            .gte('starts_at', fromDate)
            .lte('starts_at', toDate),
          supabase
            .from('bookings')
            .select('*, session:sessions(starts_at, product_id, product:products(title, type))')
            .gte('reserved_at', fromDate)
            .lte('reserved_at', toDate)
            .neq('status', 'cancelled'),
          supabase.from('products').select('id, title, type'),
          supabase
            .from('memberships')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active'),
          supabase
            .from('memberships')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', fromDate)
            .lte('created_at', toDate),
        ]);

      const orders = (ordersRes.data || []) as Order[];
      const sessions = (sessionsRes.data || []) as (Session & {
        product?: Product;
      })[];
      const bookings = (bookingsRes.data || []) as (Booking & {
        session?: Session & { product?: Product };
      })[];

      // Total revenue
      const revenue = orders.reduce(
        (sum, o) => sum + (o.amount_cents - o.discount_cents),
        0
      );
      setTotalRevenue(revenue);
      setTotalBookings(bookings.length);
      setActiveMembers(membersRes.count || 0);
      setNewMembers(newMembersRes.count || 0);

      // Revenue by day
      const dailyRevenue = new Map<string, number>();
      const from = parseISO(dateFrom);
      const to = parseISO(dateTo);
      let current = from;
      while (current <= to) {
        dailyRevenue.set(format(current, 'MMM dd'), 0);
        current = new Date(current.getTime() + 86400000);
      }
      orders.forEach((o) => {
        const key = format(new Date(o.created_at), 'MMM dd');
        dailyRevenue.set(
          key,
          (dailyRevenue.get(key) || 0) + (o.amount_cents - o.discount_cents)
        );
      });
      setRevenueData(
        Array.from(dailyRevenue.entries()).map(([date, rev]) => ({
          date,
          revenue: rev / 100,
        }))
      );

      // Bookings by product type
      const typeCounts = new Map<string, number>();
      bookings.forEach((b) => {
        const type = b.session?.product?.type || 'unknown';
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      });
      setProductTypeData(
        Array.from(typeCounts.entries())
          .map(([type, count]) => ({
            type: type.replace(/_/g, ' '),
            count,
          }))
          .sort((a, b) => b.count - a.count)
      );

      // Popular time slots
      const hourCounts = new Map<number, number>();
      for (let h = 6; h <= 22; h++) {
        hourCounts.set(h, 0);
      }
      bookings.forEach((b) => {
        if (b.session?.starts_at) {
          const hour = new Date(b.session.starts_at).getHours();
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        }
      });
      setTimeSlotData(
        Array.from(hourCounts.entries())
          .filter(([h]) => h >= 6 && h <= 22)
          .map(([hour, count]) => ({
            hour: format(new Date(2024, 0, 1, hour), 'ha'),
            bookings: count,
          }))
      );

      // Top products
      const productStats = new Map<
        string,
        { title: string; bookings: number; revenue: number }
      >();
      bookings.forEach((b) => {
        const title = b.session?.product?.title || 'Unknown';
        const existing = productStats.get(title) || {
          title,
          bookings: 0,
          revenue: 0,
        };
        existing.bookings += 1;
        productStats.set(title, existing);
      });
      // Associate revenue with products via booking_id
      const bookingIdToProduct = new Map<string, string>();
      bookings.forEach((b) => {
        bookingIdToProduct.set(
          b.id,
          b.session?.product?.title || 'Unknown'
        );
      });
      orders.forEach((o) => {
        const productTitle = bookingIdToProduct.get(o.booking_id);
        if (productTitle) {
          const existing = productStats.get(productTitle);
          if (existing) {
            existing.revenue += (o.amount_cents - o.discount_cents) / 100;
          }
        }
      });
      setTopProducts(
        Array.from(productStats.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10)
      );
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Analytics and performance metrics.
          </p>
        </div>

        {/* Date range picker */}
        <div className="flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => {
                setDateFrom(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
                setDateTo(format(new Date(), 'yyyy-MM-dd'));
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              7d
            </button>
            <button
              onClick={() => {
                setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
                setDateTo(format(new Date(), 'yyyy-MM-dd'));
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              30d
            </button>
            <button
              onClick={() => {
                setDateFrom(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
                setDateTo(format(new Date(), 'yyyy-MM-dd'));
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              90d
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-teal" />
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">
                Total Revenue
              </p>
              <p className="mt-1 text-2xl font-bold text-charcoal">
                ${(totalRevenue / 100).toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">
                Total Bookings
              </p>
              <p className="mt-1 text-2xl font-bold text-charcoal">
                {totalBookings}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">
                Active Members
              </p>
              <p className="mt-1 text-2xl font-bold text-charcoal">
                {activeMembers}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-medium text-gray-500">
                New Members (Period)
              </p>
              <p className="mt-1 text-2xl font-bold text-charcoal">
                {newMembers}
              </p>
            </div>
          </div>

          {/* Revenue chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-charcoal">
              Revenue Over Time
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `$${value.toFixed(2)}`,
                      'Revenue',
                    ]}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#1A5E63"
                    fill="#1A5E63"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Two-column charts */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Bookings by product type */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-charcoal">
                Bookings by Product Type
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productTypeData} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0f0f0"
                      horizontal={false}
                    />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis
                      dataKey="type"
                      type="category"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#D4A574"
                      radius={[0, 4, 4, 0]}
                      name="Bookings"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Popular time slots */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-charcoal">
                Popular Time Slots
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeSlotData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                      }}
                    />
                    <Bar
                      dataKey="bookings"
                      fill="#1A5E63"
                      radius={[4, 4, 0, 0]}
                      name="Bookings"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top products table */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-charcoal">
              Top Products
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                      #
                    </th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                      Product
                    </th>
                    <th className="pb-2 text-right text-xs font-semibold uppercase text-gray-500">
                      Bookings
                    </th>
                    <th className="pb-2 text-right text-xs font-semibold uppercase text-gray-500">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-gray-400"
                      >
                        No data for this period.
                      </td>
                    </tr>
                  ) : (
                    topProducts.map((product, i) => (
                      <tr key={product.title} className="hover:bg-gray-50">
                        <td className="py-2.5 text-gray-400">{i + 1}</td>
                        <td className="py-2.5 font-medium text-gray-900">
                          {product.title}
                        </td>
                        <td className="py-2.5 text-right text-gray-600">
                          {product.bookings}
                        </td>
                        <td className="py-2.5 text-right font-medium text-gray-900">
                          ${product.revenue.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
