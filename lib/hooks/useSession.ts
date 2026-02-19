import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/hooks/useRealtime';
import type { Session, Booking } from '@/lib/types/database';

interface SessionWithRoster extends Session {
  bookings: (Booking & {
    user: { id: string; full_name: string | null; avatar_url: string | null };
  })[];
}

/**
 * Fetch a session by ID with its roster (bookings + profiles).
 */
async function fetchSession(id: string): Promise<SessionWithRoster> {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      product:products (*),
      court:courts (*),
      bookings (
        *,
        user:users (id, full_name, avatar_url)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as SessionWithRoster;
}

/**
 * Hook for fetching session details including the roster of bookings.
 * Subscribes to realtime changes on bookings for this session,
 * so the roster updates automatically when someone books or cancels.
 */
export function useSession(id: string) {
  const queryKey = ['session', id];

  // Subscribe to realtime booking changes for this session
  useRealtime({
    table: 'bookings',
    filter: `session_id=eq.${id}`,
    queryKeys: [queryKey],
    enabled: !!id,
  });

  // Also subscribe to session-level changes (status, spots_remaining)
  useRealtime({
    table: 'sessions',
    filter: `id=eq.${id}`,
    queryKeys: [queryKey],
    enabled: !!id,
  });

  return useQuery({
    queryKey,
    queryFn: () => fetchSession(id),
    enabled: !!id,
  });
}
