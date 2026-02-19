import { supabase } from '@/lib/supabase';
import type { Membership } from '@/lib/types/database';
import { MEMBERSHIP_TIERS, type MembershipTierConfig } from '@/lib/utils/constants';

/**
 * Get the current user's active membership.
 * Returns null if the user has no active membership.
 */
export async function getMyMembership(): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('*')
    .in('status', ['active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Membership | null;
}

/**
 * Get the static membership tier configurations with prices and benefits.
 */
export function getMembershipTiers(): MembershipTierConfig[] {
  return MEMBERSHIP_TIERS;
}

/**
 * Cancel the current user's active membership.
 * Cancellation takes effect at the end of the current billing period.
 */
export async function cancelMembership(): Promise<Membership> {
  const { data, error } = await supabase.functions.invoke(
    'cancel-membership',
    {}
  );

  if (error) throw new Error(error.message);
  return data as Membership;
}
