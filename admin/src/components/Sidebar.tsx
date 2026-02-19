import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { User } from '@/lib/types';
import {
  LayoutDashboard,
  Package,
  Calendar,
  MapPin,
  ShoppingCart,
  Crown,
  DollarSign,
  BarChart3,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/sessions', icon: Calendar, label: 'Sessions' },
  { to: '/courts', icon: MapPin, label: 'Courts' },
  { to: '/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/memberships', icon: Crown, label: 'Memberships' },
  { to: '/pricing', icon: DollarSign, label: 'Pricing' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (data) setUser(data as User);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-charcoal text-white">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6">
        <h1 className="text-xl font-bold tracking-wide">
          <span className="text-sand">Bakyard</span>{' '}
          <span className="text-sm font-normal text-gray-400">Admin</span>
        </h1>
        <button
          onClick={onMobileClose}
          className="text-gray-400 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onMobileClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User + Sign Out */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal text-sm font-semibold">
            {user?.full_name
              ? user.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
              : 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">
              {user?.full_name || 'Admin'}
            </p>
            <p className="truncate text-xs text-gray-400">{user?.phone || ''}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

export function MobileMenuButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
