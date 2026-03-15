import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { StoredDowntime } from '@/lib/downtimeStorage'
import type { StoredOperation } from '@/lib/operationStorage'

export type DowntimeRow = {
  id: number
  user_id: string | null
  employee: string
  reason: string
  category: string
  start_iso: string
  end_iso: string
  duration_minutes: number
  field_id: string | null
  field_name: string | null
  operation: string | null
}

export type OperationRow = {
  id: number
  user_id: string | null
  employee: string
  field_id: string | null
  field_name: string | null
  operation: string | null
  start_iso: string
  end_iso: string
  duration_minutes: number
}

function rowToDowntime(r: DowntimeRow): StoredDowntime {
  return {
    id: r.id,
    employee: r.employee,
    reason: r.reason,
    category: r.category as StoredDowntime['category'],
    startISO: r.start_iso,
    endISO: r.end_iso,
    durationMinutes: r.duration_minutes,
    fieldId: r.field_id ?? undefined,
    fieldName: r.field_name ?? undefined,
    operation: r.operation ?? undefined,
  }
}

function rowToOperation(r: OperationRow): StoredOperation {
  return {
    id: r.id,
    employee: r.employee,
    fieldId: r.field_id ?? undefined,
    fieldName: r.field_name ?? undefined,
    operation: r.operation ?? undefined,
    startISO: r.start_iso,
    endISO: r.end_iso,
    durationMinutes: r.duration_minutes,
  }
}

export async function insertDowntime(
  event: StoredDowntime,
  userId: string | null,
): Promise<void> {
  if (!supabase) return
  await supabase.from('downtimes').insert({
    user_id: userId,
    employee: event.employee,
    reason: event.reason,
    category: event.category,
    start_iso: event.startISO,
    end_iso: event.endISO,
    duration_minutes: event.durationMinutes,
    field_id: event.fieldId ?? null,
    field_name: event.fieldName ?? null,
    operation: event.operation ?? null,
  })
}

export async function insertOperation(
  op: StoredOperation,
  userId: string | null,
): Promise<void> {
  if (!supabase) return
  await supabase.from('operations').insert({
    user_id: userId,
    employee: op.employee,
    field_id: op.fieldId ?? null,
    field_name: op.fieldName ?? null,
    operation: op.operation ?? null,
    start_iso: op.startISO,
    end_iso: op.endISO,
    duration_minutes: op.durationMinutes,
  })
}

export async function loadDowntimesFromSupabase(
  onlyCurrentUser: boolean,
  userId: string | null,
): Promise<StoredDowntime[]> {
  if (!supabase) return []
  let q = supabase
    .from('downtimes')
    .select('id, user_id, employee, reason, category, start_iso, end_iso, duration_minutes, field_id, field_name, operation')
    .order('start_iso', { ascending: false })
  if (onlyCurrentUser && userId) {
    q = q.eq('user_id', userId)
  }
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => rowToDowntime(r as DowntimeRow))
}

export async function loadOperationsFromSupabase(
  onlyCurrentUser: boolean,
  userId: string | null,
): Promise<StoredOperation[]> {
  if (!supabase) return []
  let q = supabase
    .from('operations')
    .select('id, user_id, employee, field_id, field_name, operation, start_iso, end_iso, duration_minutes')
    .order('start_iso', { ascending: false })
  if (onlyCurrentUser && userId) {
    q = q.eq('user_id', userId)
  }
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => rowToOperation(r as OperationRow))
}

export { isSupabaseConfigured }
