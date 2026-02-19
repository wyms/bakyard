import { supabase } from '@/lib/supabase';
import type { CoachProfile, Product, Session } from '@/lib/types/database';

/**
 * Get a coach profile by ID with the associated user record.
 * Only returns active coaches.
 */
export async function getCoachProfile(coachId: string): Promise<CoachProfile> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select(`
      *,
      user:users (*)
    `)
    .eq('id', coachId)
    .eq('is_active', true)
    .single();

  if (error) throw new Error(error.message);
  return data as CoachProfile;
}

/**
 * Get upcoming sessions for a coach.
 * Joins through products where coach_id matches the coach's user_id,
 * then fetches sessions for those products that start in the future.
 */
export async function getCoachSessions(coachId: string): Promise<Session[]> {
  // First, get the coach profile to find the user_id
  const profile = await getCoachProfile(coachId);

  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      product:products (*),
      court:courts (*)
    `)
    .eq('product.coach_id', profile.user_id)
    .gte('starts_at', new Date().toISOString())
    .in('status', ['open', 'full'])
    .not('product', 'is', null)
    .order('starts_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Session[];
}

/**
 * Get all active products belonging to a coach.
 * Uses the coach's user_id as the foreign key on products.
 */
export async function getCoachProducts(coachId: string): Promise<Product[]> {
  // First, get the coach profile to find the user_id
  const profile = await getCoachProfile(coachId);

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('coach_id', profile.user_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}
