/**
 * OpenWeatherMap API для панели агронома.
 * Вызов при загрузке страницы и при смене города.
 */

const OPENWEATHER_BASE = 'https://api.openweathermap.org/data/2.5/weather'
const APPID = 'f8a7bf6a4c76418c05f1f818fd12375f'
const UNITS = 'metric'
const LANG = 'ru'

const WIND_DIRECTIONS = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ']

export type WeatherData = {
  cityName: string
  coord: { lon?: number; lat?: number }
  temp: number | null
  feelsLike: number | null
  description: string
  icon: string
  humidity: number | null
  pressure: number | null
  seaLevel: number | null
  grndLevel: number | null
  visibility: number | null
  windSpeed: number | null
  windDeg: number | null
  windDirection: string
  clouds: number | null
  sunrise: string
  sunset: string
  dt: number
  timezone: number
}

type OpenWeatherRaw = {
  cod?: number
  name?: string
  coord?: { lon?: number; lat?: number }
  weather?: Array<{ description?: string; icon?: string }>
  main?: {
    temp?: number
    feels_like?: number
    pressure?: number
    humidity?: number
    sea_level?: number
    grnd_level?: number
  }
  visibility?: number
  wind?: { speed?: number; deg?: number }
  clouds?: { all?: number }
  sys?: { sunrise?: number; sunset?: number }
  timezone?: number
  dt?: number
}

function windDegToLabel(deg: number | null | undefined): string {
  if (deg == null) return '—'
  const index = Math.round(((deg % 360) + 360) / 45) % 8
  return WIND_DIRECTIONS[index]
}

function buildWeatherUrl(city: string, countryCode = 'ru'): string {
  const params = new URLSearchParams({
    q: `${city},${countryCode}`,
    APPID,
    units: UNITS,
    lang: LANG,
  })
  return `${OPENWEATHER_BASE}?${params.toString()}`
}

function parseWeatherResponse(raw: OpenWeatherRaw): WeatherData | null {
  if (!raw || raw.cod !== 200) return null

  const weather = raw.weather?.[0]
  const main = raw.main ?? {}
  const wind = raw.wind ?? {}
  const sys = raw.sys ?? {}
  const clouds = raw.clouds ?? {}
  const tz = raw.timezone ?? 0

  const sunrise = sys.sunrise ? new Date((sys.sunrise + tz) * 1000) : null
  const sunset = sys.sunset ? new Date((sys.sunset + tz) * 1000) : null
  const formatTime = (date: Date | null) =>
    date ? `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}` : '—'

  return {
    cityName: raw.name ?? '—',
    coord: { lon: raw.coord?.lon, lat: raw.coord?.lat },
    temp: main.temp != null ? Math.round(main.temp) : null,
    feelsLike: main.feels_like != null ? Math.round(main.feels_like) : null,
    description: weather?.description ?? '—',
    icon: weather?.icon ?? '01d',
    humidity: main.humidity ?? null,
    pressure: main.pressure ?? null,
    seaLevel: main.sea_level ?? null,
    grndLevel: main.grnd_level ?? null,
    visibility: raw.visibility ?? null,
    windSpeed: wind.speed ?? null,
    windDeg: wind.deg ?? null,
    windDirection: windDegToLabel(wind.deg),
    clouds: clouds.all ?? null,
    sunrise: formatTime(sunrise),
    sunset: formatTime(sunset),
    dt: raw.dt ?? 0,
    timezone: raw.timezone ?? 0,
  }
}

export async function fetchWeather(city: string, countryCode = 'ru'): Promise<WeatherData | null> {
  const url = buildWeatherUrl(city, countryCode)
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const raw = await response.json()
    return parseWeatherResponse(raw)
  } catch (e) {
    console.error('Weather API error:', e)
    return null
  }
}

export function getWeatherIconUrl(icon: string): string {
  return `https://openweathermap.org/img/wn/${icon || '01d'}@2x.png`
}
