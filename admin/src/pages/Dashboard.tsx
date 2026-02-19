import { useEffect, useState } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { DollarSign, CalendarCheck, Users, Percent } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session, Booking, Order } from '@/lib/types';
import StatCard from '@/components/StatCard';

interface RevenueDataPoint {
  date: string;
  revenue: number;
}

export default function Dashboard() {
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayBookings, setTodayBookings] = useState(0);
  const [activeMembers, setActiveMembers] = useState(0);
  const [courtUtilization, setCourtUtilization] = useState(0);
  const [revenueChart, setRevenueChart] = useState<RevenueDataPoint[]>([]);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    const today = new Date();
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();

    try {
      // Fetch all data in parallel
      const [
        ordersRes,
        bookingsRes,
        membersRes,
        sessionsRes,
        totalCourtsRes,
        todaySessionsRes,
        recentBookingsRes,
        chartOrdersRes,
      ] = await Promise.all([
        // Today's revenue
        supabase
          .from('orders')
          .select('amount_cents, discount_cents')
          .eq('status', 'paid')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd),
        // Today's bookings
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .gte('reserved_at', todayStart)
          .lte('reserved_at', todayEnd),
        // Active members
        supabase
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        // Today's sessions for utilization
        supabase
          .from('sessions')
          .select('spots_total, spots_remaining')
          .gte('starts_at', todayStart)
          .lte('starts_at', todayEnd)
          .in('status', ['open', 'full', 'in_progress', 'completed']),
        // Total courts for context
        supabase
          .from('courts')
          .select('id', { count: 'exact', head: true })
          .eq('is_available', true),
        // Today's sessions list
        supabase
          .from('sessions')
          .select('*, product:products(*), court:courts(*)')
          .gte('starts_at', todayStart)
          .lte('starts_at', todayEnd)
          .order('starts_at', { ascending: true }),
        // Recent bookings
        supabase
          .from('bookings')
          .select('*, session:sessions(*, product:products(*)), user:users(*)')
          .order('reserved_at', { ascending: false })
          .limit(10),
        // Revenue chart data (last 30 days)
        supabase
          .from('orders')
          .select('amount_cents, discount_cents, created_at')
          .eq('status', 'paid')
          .gte('created_at', subDays(today, 30).toISOString()),
      ]);

      // Process today's revenue
      if (ordersRes.data) {
        const revenue = (ordersRes.data as Order[]).reduce(
          (sum, o) => sum + (o.amount_cents - o.discount_cents),
          0
        );
        setTodayRevenue(revenue);
      }

      // Process today's bookings count
      setTodayBookings(bookingsRes.count || 0);

      // Process active members
      setActiveMembers(membersRes.count || 0);

      // Process court utilization
      if (sessionsRes.data && sessionsRes.data.length > 0) {
        const sessions = sessionsRes.data as Session[];
        const totalSpots = sessions.reduce((sum, s) => sum + s.spots_total, 0);
        const bookedSpots = sessions.reduce(
          (sum, s) => sum + (s.spots_total - s.spots_remaining),
          0
        );
        setCourtUtilization(
          totalSpots > 0 ? Math.round((bookedSpots / totalSpots) * 100) : 0
        );
      }

      // Process today's sessions
      if (todaySessionsRes.data) {
        setTodaySessions(todaySessionsRes.data as Session[]);
      }

      // Process recent bookings
      if (recentBookingsRes.data) {
        setRecentBookings(recentBookingsRes.data as Booking[]);
      }

      // Process revenue chart
      if (chartOrdersRes.data) {
        const dailyRevenue = new Map<string, number>();
        for (let i = 29; i >= 0; i--) {
          const date = format(subDays(today, i), 'MMM dd');
          dailyRevenue.set(date, 0);
        }
        (chartOrdersRes.data as Order[]).forEach((o) => {
          const date = format(new Date(o.created_at), 'MMM dd');
          const current = dailyRevenue.get(date) || 0;
          dailyRevenue.set(date, current + (o.amount_cents - o.discount_cents));
        });
        setRevenueChart(
          Array.from(dailyRevenue.entries()).map(([date, revenue]) => ({
            date,
            revenue: revenue / 100,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      open: 'bg-green-100 text-green-700',
      full: 'bg-amber-100 text-amber-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-gray-100 text-gray-600',
      cancelled: 'bg-red-100 text-red-700',
      reserved: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-green-100 text-green-700',
      no_show: 'bg-red-100 text-red-700',
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          styles[status] || 'bg-gray-100 text-gray-600'
        }`}
      >
        {status.replace('_', ' ')}
      </span>
    );
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
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview for {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Today's Revenue"
          value={formatCents(todayRevenue)}
          iconColor="text-green-600"
        />
        <StatCard
          icon={CalendarCheck}
          label="Today's Bookings"
          value={String(todayBookings)}
          iconColor="text-blue-600"
        />
        <StatCard
          icon={Users}
          label="Active Members"
          value={String(activeMembers)}
          iconColor="text-purple-600"
        />
        <StatCard
          icon={Percent}
          label="Court Utilization"
          value={`${courtUtilization}%`}
          iconColor="text-sand"
        />
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-charcoal">
          Revenue (Last 30 Days)
        </h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                labelStyle={{ color: '#2D2D2D' }}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
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

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Today's Sessions */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-charcoal">
            Today's Sessions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Time
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Product
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Court
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Spots
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {todaySessions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-gray-400"
                    >
                      No sessions scheduled today.
                    </td>
                  </tr>
                ) : (
                  todaySessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="py-2.5 text-gray-700">
                        {format(new Date(session.starts_at), 'h:mm a')}
                      </td>
                      <td className="py-2.5 font-medium text-gray-900">
                        {session.product?.title || '--'}
                      </td>
                      <td className="py-2.5 text-gray-600">
                        {session.court?.name || '--'}
                      </td>
                      <td className="py-2.5 text-gray-600">
                        {session.spots_total - session.spots_remaining}/
                        {session.spots_total}
                      </td>
                      <td className="py-2.5">
                        {getStatusBadge(session.status)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-charcoal">
            Recent Bookings
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    User
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Product
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Date
                  </th>
                  <th className="pb-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentBookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-gray-400"
                    >
                      No recent bookings.
                    </td>
                  </tr>
                ) : (
                  recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-900">
                        {booking.user?.full_name || 'Unknown'}
                      </td>
                      <td className="py-2.5 text-gray-600">
                        {booking.session?.product?.title || '--'}
                      </td>
                      <td className="py-2.5 text-gray-600">
                        {format(
                          new Date(booking.reserved_at),
                          'MMM d, h:mm a'
                        )}
                      </td>
                      <td className="py-2.5">
                        {getStatusBadge(booking.status)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
