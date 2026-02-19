import { supabase } from '@/lib/supabase';
import type { Product, Session } from '@/lib/types/database';

export interface FeedFilters {
  types?: string[];
  tags?: string[];
  search?: string;
  date?: string;
  cursor?: string;
  limit?: number;
}

export interface FeedItem {
  product: Product;
  next_session: Session | null;
  relevance_score: number;
}

export interface FeedResponse {
  items: FeedItem[];
  next_cursor: string | null;
  has_more: boolean;
}

/**
 * Get the personalized feed via the generate-feed edge function.
 * The edge function handles ranking, personalization, and pagination.
 */
export async function getFeed(
  filters?: FeedFilters
): Promise<FeedResponse> {
  const { data, error } = await supabase.functions.invoke('generate-feed', {
    body: filters ?? {},
  });

  if (error) throw new Error(error.message);
  return data as FeedResponse;
}

/**
 * Get a single product by ID with full details.
 */
export async function getProductById(id: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as Product;
}

/**
 * Get all upcoming sessions for a product.
 */
export async function getSessionsForProduct(
  productId: string
): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      court:courts (*)
    `)
    .eq('product_id', productId)
    .gte('starts_at', new Date().toISOString())
    .in('status', ['open', 'full'])
    .order('starts_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Session[];
}

/**
 * Log a user interaction with a product for feed personalization.
 */
export async function logInteraction(
  productId: string,
  interactionType: 'view' | 'tap' | 'book' | 'dismiss'
): Promise<void> {
  const { error } = await supabase.from('feed_interactions').insert({
    product_id: productId,
    interaction_type: interactionType,
    user_id: (await supabase.auth.getUser()).data.user?.id ?? '',
  });

  if (error) throw new Error(error.message);
}
