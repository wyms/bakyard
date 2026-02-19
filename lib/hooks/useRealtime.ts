import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions {
  /** The database table to subscribe to. */
  table: string;
  /** Optional filter in the format "column=eq.value". */
  filter?: string;
  /** Events to listen for. Defaults to all ('*'). */
  event?: RealtimeEvent;
  /** Callback fired on each change. If omitted, invalidates TanStack Query keys instead. */
  callback?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  /** TanStack Query keys to invalidate on changes. Used when callback is not provided. */
  queryKeys?: unknown[][];
  /** Whether the subscription is enabled. Defaults to true. */
  enabled?: boolean;
}

/**
 * Generic realtime subscription hook.
 *
 * Subscribes to a Supabase Realtime channel for Postgres changes on a table.
 * Either calls the provided callback or invalidates TanStack Query keys on changes.
 */
export function useRealtime({
  table,
  filter,
  event = '*',
  callback,
  queryKeys,
  enabled = true,
}: UseRealtimeOptions) {
  const queryClient = useQueryClient();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime:${table}${filter ? `:${filter}` : ''}`;

    const channelConfig: Record<string, string> = {
      event,
      schema: 'public',
      table,
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as never,
        channelConfig,
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (callbackRef.current) {
            callbackRef.current(payload);
          } else if (queryKeys && queryKeys.length > 0) {
            queryKeys.forEach((key) => {
              queryClient.invalidateQueries({ queryKey: key });
            });
          } else {
            // Default: invalidate queries matching the table name
            queryClient.invalidateQueries({ queryKey: [table] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, event, enabled, queryClient, queryKeys]);
}
