/** Парсит строку вида "55.7558, 37.6173" из поля геолокации. */
export function parseLatLonFromGeolocationString(raw: string | null | undefined): { lat: number; lon: number } | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  const parts = s.split(',').map((p) => Number(p.trim()))
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null
  return { lat: parts[0], lon: parts[1] }
}

/** Обратное геокодирование через загруженный API Карт (ymaps.geocode). */
export async function resolveYandexAddressLine(lat: number, lon: number): Promise<string> {
  const ymaps = (window as typeof window & { ymaps?: any }).ymaps
  if (!ymaps?.geocode) return ''
  try {
    const res = await ymaps.geocode([lat, lon], { results: 1 })
    const first = res?.geoObjects?.get?.(0)
    if (!first) return ''
    return first.getAddressLine?.() || first.properties?.get?.('text') || ''
  } catch (e) {
    console.error('[yandexGeocode] error:', e)
    return ''
  }
}
