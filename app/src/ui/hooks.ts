import { useQuery } from '@tanstack/react-query';
import { useRepo } from './AppProviders';
import type { BookingQuery } from '../services/repo';

export function useItems() {
  const repo = useRepo();
  return useQuery({ queryKey: ['items'], queryFn: () => repo.listItems() });
}

export function useOfferings(q: { from?: string; to?: string; itemId?: string }) {
  const repo = useRepo();
  return useQuery({ queryKey: ['offerings', q], queryFn: () => repo.listOfferings(q) });
}

export function useBookings(q: BookingQuery, enabled = true) {
  const repo = useRepo();
  return useQuery({ queryKey: ['bookings', q], queryFn: () => repo.listBookings(q), enabled });
}

export function useBatches(itemId?: string) {
  const repo = useRepo();
  return useQuery({ queryKey: ['batches', itemId], queryFn: () => repo.listBatches(itemId) });
}
