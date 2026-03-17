import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export type LandTypeRow = {
  id: string
  name: string
  sort_order: number
  created_at: string
}

export type CropRow = {
  id: string
  key: string
  label: string
  sort_order: number
  created_at: string
}

const LAND_TYPES_TABLE = 'land_types'
const CROPS_TABLE = 'crops'

export async function loadLandTypes(): Promise<LandTypeRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(LAND_TYPES_TABLE)
    .select('id, name, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as LandTypeRow[]
}

export async function addLandType(name: string): Promise<LandTypeRow> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { data, error } = await supabase
    .from(LAND_TYPES_TABLE)
    .insert({ name: name.trim(), sort_order: 999 })
    .select()
    .single()
  if (error) throw error
  return data as LandTypeRow
}

export async function updateLandType(id: string, name: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { error } = await supabase.from(LAND_TYPES_TABLE).update({ name: name.trim() }).eq('id', id)
  if (error) throw error
}

export async function deleteLandType(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { error } = await supabase.from(LAND_TYPES_TABLE).delete().eq('id', id)
  if (error) throw error
}

export async function loadCrops(): Promise<CropRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(CROPS_TABLE)
    .select('id, key, label, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })
  if (error) throw error
  return (data ?? []) as CropRow[]
}

/** Генерирует ключ (латиница) из названия для хранения в БД — сотрудникам не показываем. */
function keyFromLabel(label: string): string {
  const tr: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  }
  let s = label.trim().toLowerCase()
  s = s.replace(/[а-яё]/g, (c) => tr[c] ?? c)
  s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return s || `crop_${Date.now()}`
}

export async function addCrop(key: string, label: string): Promise<CropRow> {
  if (!supabase) throw new Error('Supabase не настроен')
  const k = key.trim().toLowerCase().replace(/\s+/g, '_')
  const { data, error } = await supabase
    .from(CROPS_TABLE)
    .insert({ key: k, label: label.trim(), sort_order: 999 })
    .select()
    .single()
  if (error) throw error
  return data as CropRow
}

/** Добавить культуру по одному названию — ключ создаётся автоматически. */
export async function addCropByLabel(label: string): Promise<CropRow> {
  const key = keyFromLabel(label)
  return addCrop(key, label.trim())
}

export async function updateCrop(id: string, key: string, label: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const k = key.trim().toLowerCase().replace(/\s+/g, '_')
  const { error } = await supabase.from(CROPS_TABLE).update({ key: k, label: label.trim() }).eq('id', id)
  if (error) throw error
}

export async function deleteCrop(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { error } = await supabase.from(CROPS_TABLE).delete().eq('id', id)
  if (error) throw error
}

export { isSupabaseConfigured }
