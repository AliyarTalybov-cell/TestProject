/**
 * Сначала Яндекс Погода (прокси / сервер с ключом), при 403 / ошибке — Open-Meteo без ключа.
 */

import { RUSSIAN_CITIES } from './cities'

const YANDEX_PROXY = '/api/weather'

const OPEN_METEO_BASE =
  'https://api.open-meteo.com/v1/forecast'

export type WeatherData = {
  cityName: string
  condition: string
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
  precProbability: number | null
  sunrise: string
  sunset: string
  dt: number
  timezone: number
  uvIndex?: number | null
  soilTemperature?: number | null
  soilMoisture?: number | null
  leafWetnessIndex?: boolean | null
  precType?: number | null
  precStrength?: number | null
  isThunder?: boolean | null
  dewPoint?: number | null
  kpIndex?: number | null
  meanSeaLevelPressure?: number | null
  altitude?: number | null
  pressureNorm?: number | null
}

const GQL_NOW_QUERY = `
  query WeatherNow($lat: Float!, $lon: Float!) {
    weatherByPoint(request: { lat: $lat, lon: $lon }) {
      now {
        temperature
        condition
        windSpeed
        windDirection
        humidity
        pressure
        visibility
        icon(format: SVG)
        precProbability
        kpIndex
        meanSeaLevelPressure
      }
      forecast {
        days(limit: 1) {
          sunrise
          sunset
        }
      }
    }
  }
`

const GQL_FORECAST_QUERY = `
  query WeatherForecast($lat: Float!, $lon: Float!) {
    weatherByPoint(request: { lat: $lat, lon: $lon }) {
      forecast {
        days(limit: 5) {
          time
          parts {
            day {
              minTemperature
              maxTemperature
              icon(format: SVG)
              condition
              windSpeed
              precProbability
            }
          }
        }
      }
    }
  }
`

function parseCondition(c: string): string {
  const cond = c?.toLowerCase() || ''
  if (cond.includes('clear')) return 'clear'
  if (cond.includes('cloud') || cond.includes('overcast')) return 'clouds'
  if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) return 'rain'
  if (cond.includes('snow')) return 'snow'
  if (cond.includes('storm')) return 'thunderstorm'
  return 'clear'
}

function parseWindDir(dir: string): string {
  const dirs: Record<string, string> = {
    nw: 'СЗ',
    n: 'С',
    ne: 'СВ',
    e: 'В',
    se: 'ЮВ',
    s: 'Ю',
    sw: 'ЮЗ',
    w: 'З',
    c: 'Штиль',
    NW: 'СЗ',
    N: 'С',
    NE: 'СВ',
    E: 'В',
    SE: 'ЮВ',
    S: 'Ю',
    SW: 'ЮЗ',
    W: 'З',
    C: 'Штиль',
    NORTH_WEST: 'СЗ',
    NORTH: 'С',
    NORTH_EAST: 'СВ',
    EAST: 'В',
    SOUTH_EAST: 'ЮВ',
    SOUTH: 'Ю',
    SOUTH_WEST: 'ЮЗ',
    WEST: 'З',
    CALM: 'Штиль',
  }
  const key = (dir || '').trim()
  return dirs[key] || dirs[key.toUpperCase()] || dir
}

function hPaToMmHg(hPa: number): number {
  return Math.round(hPa * 0.750061683)
}

function degToWindDir(deg: number | null | undefined): string {
  if (deg == null || Number.isNaN(deg)) return '—'
  const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ']
  const i = Math.round(deg / 45) % 8
  return dirs[(i + 8) % 8]
}

/** WMO Weather interpretation codes (WW) → категория для UI */
function conditionFromWmo(code: number): string {
  if (code === 0 || code === 1) return 'clear'
  if (code === 2 || code === 3) return 'clouds'
  if (code >= 45 && code <= 48) return 'mist'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow'
  if (code >= 95) return 'thunderstorm'
  return 'clear'
}

function wmoDescriptionRu(code: number): string {
  const table: Record<number, string> = {
    0: 'Ясно',
    1: 'Преимущественно ясно',
    2: 'Переменная облачность',
    3: 'Пасмурно',
    45: 'Туман',
    48: 'Туман с инеем',
    51: 'Морось слабая',
    53: 'Морось умеренная',
    55: 'Морось сильная',
    56: 'Ледяная морось',
    57: 'Сильная ледяная морось',
    61: '🌧 Дождь слабый',
    63: '🌧 Дождь',
    65: '🌧 Дождь сильный',
    66: 'Ледяной дождь',
    67: 'Сильный ледяной дождь',
    71: 'Снег слабый',
    73: 'Снег',
    75: 'Снег сильный',
    77: 'Снежные зёрна',
    80: 'Ливни слабые',
    81: 'Ливни',
    82: 'Сильные ливни',
    85: 'Снегопад слабый',
    86: 'Снегопад сильный',
    95: '⛈ Гроза',
    96: '⛈ Гроза с градом',
    99: '⛈ Сильная гроза с градом',
  }
  return table[code] ?? 'Погода'
}

/** Коды иконок OpenWeatherMap (день/ночь), для URL api.openweathermap.org */
function wmoToOwmIcon(code: number, isDay: boolean): string {
  const d = isDay ? 'd' : 'n'
  if (code === 0 || code === 1) return `01${d}`
  if (code === 2) return `02${d}`
  if (code === 3) return `04${d}`
  if (code >= 45 && code <= 48) return `50${d}`
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return `10${d}`
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return `13${d}`
  if (code >= 95) return `11${d}`
  return `01${d}`
}

function formatHmFromIso(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function openMeteoUrl(lat: number, lon: number): string {
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'auto',
    forecast_days: '6',
    wind_speed_unit: 'ms',
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'weather_code',
      'cloud_cover',
      'pressure_msl',
      'wind_speed_10m',
      'wind_direction_10m',
      'precipitation',
      'visibility',
      'dew_point_2m',
      'uv_index',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'sunrise',
      'sunset',
    ].join(','),
  })
  return `${OPEN_METEO_BASE}?${p.toString()}`
}

export type ForecastDayItem = {
  date: string
  dayLabel: string
  dateLabel: string
  tempMin: number
  tempMax: number
  icon: string
  condition: string
  windSpeed: number | null
  pop: number
  alert?: string
}

type OmBundle = { weather: WeatherData; forecast: ForecastDayItem[] }

const omInflight = new Map<string, Promise<OmBundle | null>>()

function openMeteoKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`
}

async function fetchOpenMeteoOnce(lat: number, lon: number, label: string): Promise<OmBundle | null> {
  try {
    const res = await fetch(openMeteoUrl(lat, lon))
    if (!res.ok) return null
    const j = (await res.json()) as Record<string, unknown>
    const current = j.current as Record<string, unknown> | undefined
    const daily = j.daily as Record<string, unknown[]> | undefined
    if (!current || !daily?.time?.length) return null

    const code = Number(current.weather_code ?? 0)
    const isDay = Boolean(current.is_day)
    const pMslp =
      current.pressure_msl != null && typeof current.pressure_msl === 'number'
        ? hPaToMmHg(current.pressure_msl)
        : null
    const pop0 = Number(daily.precipitation_probability_max?.[0] ?? 0)

    const weather: WeatherData = {
      cityName: label,
      condition: conditionFromWmo(code),
      coord: { lon, lat },
      temp: current.temperature_2m != null ? Number(current.temperature_2m) : null,
      feelsLike:
        current.apparent_temperature != null ? Number(current.apparent_temperature) : null,
      description: wmoDescriptionRu(code),
      icon: wmoToOwmIcon(code, isDay),
      humidity:
        current.relative_humidity_2m != null ? Number(current.relative_humidity_2m) : null,
      pressure: pMslp,
      seaLevel: null,
      grndLevel: null,
      visibility: current.visibility != null ? Number(current.visibility) : null,
      windSpeed: current.wind_speed_10m != null ? Number(current.wind_speed_10m) : null,
      windDeg: current.wind_direction_10m != null ? Number(current.wind_direction_10m) : null,
      windDirection: degToWindDir(
        current.wind_direction_10m != null ? Number(current.wind_direction_10m) : null,
      ),
      clouds: current.cloud_cover != null ? Number(current.cloud_cover) : null,
      precProbability: pop0,
      sunrise: formatHmFromIso(daily.sunrise?.[0] as string | undefined),
      sunset: formatHmFromIso(daily.sunset?.[0] as string | undefined),
      dt: Math.floor(Date.now() / 1000),
      timezone: 0,
      uvIndex: current.uv_index != null ? Number(current.uv_index) : null,
      soilTemperature: null,
      soilMoisture: null,
      leafWetnessIndex: null,
      precType: null,
      precStrength: null,
      isThunder: code >= 95,
      dewPoint: current.dew_point_2m != null ? Number(current.dew_point_2m) : null,
      kpIndex: null,
      meanSeaLevelPressure: pMslp,
      altitude: null,
      pressureNorm: null,
    }

    const forecast = mapOpenMeteoDaily(daily)
    return { weather, forecast }
  } catch (e) {
    console.error('Open-Meteo error:', e)
    return null
  }
}

async function getOpenMeteoBundle(lat: number, lon: number, label: string): Promise<OmBundle | null> {
  const k = openMeteoKey(lat, lon)
  let p = omInflight.get(k)
  if (!p) {
    p = fetchOpenMeteoOnce(lat, lon, label)
    omInflight.set(k, p)
    void p.finally(() => {
      queueMicrotask(() => omInflight.delete(k))
    })
  }
  const b = await p
  if (!b) return null
  if (label && b.weather.cityName !== label) {
    return { weather: { ...b.weather, cityName: label }, forecast: b.forecast }
  }
  return b
}

function mapOpenMeteoDaily(daily: Record<string, unknown[]>): ForecastDayItem[] {
  const times = (daily.time as string[]) || []
  const codes = (daily.weather_code as number[]) || []
  const tmax = (daily.temperature_2m_max as number[]) || []
  const tmin = (daily.temperature_2m_min as number[]) || []
  const pops = (daily.precipitation_probability_max as number[]) || []
  const winds = (daily.wind_speed_10m_max as number[]) || []
  const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  const monthNames: Record<number, string> = {
    1: 'Янв',
    2: 'Фев',
    3: 'Мар',
    4: 'Апр',
    5: 'Май',
    6: 'Июн',
    7: 'Июл',
    8: 'Авг',
    9: 'Сен',
    10: 'Окт',
    11: 'Ноя',
    12: 'Дек',
  }

  const n = Math.min(5, times.length)
  const out: ForecastDayItem[] = []
  for (let i = 0; i < n; i++) {
    const time = times[i]
    const parts = time.split('-').map(Number)
    const y = parts[0]
    const mo = parts[1]
    const da = parts[2]
    const dt = new Date(y, mo - 1, da)
    const dayLabel = dayLabels[dt.getDay()]
    const dateLabel = `${da} ${monthNames[mo]}`
    const code = codes[i] ?? 0
    const pMax = tmax[i] ?? 0
    const pMin = tmin[i] ?? 0
    const pop = pops[i] ?? 0
    const wind = winds[i] ?? null
    let alert: string | undefined
    if (wind != null && wind > 12) alert = 'СИЛЬНЫЙ ВЕТЕР ОТЛОЖИТЕ УБОРКУ'
    out.push({
      date: time,
      dayLabel,
      dateLabel,
      tempMin: pMin,
      tempMax: pMax,
      icon: wmoToOwmIcon(code, true),
      condition: conditionFromWmo(code),
      windSpeed: wind,
      pop,
      alert,
    })
  }
  return out
}

async function tryYandexNow(
  lat: number,
  lon: number,
  label: string,
): Promise<WeatherData | null> {
  const response = await fetch(YANDEX_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: GQL_NOW_QUERY,
      variables: { lat, lon },
    }),
  })

  if (!response.ok) {
    console.warn('Yandex Weather HTTP', response.status, '(ожидаемо при неверном ключе — включаем Open-Meteo)')
    return null
  }
  const result = (await response.json()) as {
    data?: { weatherByPoint?: { now?: Record<string, unknown>; forecast?: { days?: unknown[] }; location?: Record<string, unknown> } }
  }

  const weatherData = result.data?.weatherByPoint
  if (!weatherData?.now) return null

  const now = weatherData.now as Record<string, unknown>
  const loc = (weatherData as { location?: Record<string, unknown> }).location || {}
  const todayForecast = (weatherData.forecast?.days?.[0] as Record<string, string>) || {}

  return {
    cityName: label,
    condition: parseCondition(String(now.condition ?? '')),
    coord: { lon, lat },
    temp: now.temperature != null ? Number(now.temperature) : null,
    feelsLike: null,
    description: String(now.condition ?? ''),
    icon: String(now.icon ?? ''),
    humidity: now.humidity != null ? Number(now.humidity) : null,
    pressure: now.pressure != null ? Number(now.pressure) : null,
    seaLevel: null,
    grndLevel: null,
    visibility: now.visibility != null ? Number(now.visibility) : null,
    windSpeed: now.windSpeed != null ? Number(now.windSpeed) : null,
    windDeg: null,
    windDirection: parseWindDir(String(now.windDirection ?? '')),
    clouds: null,
    precProbability: now.precProbability != null ? Number(now.precProbability) : 0,
    sunrise: todayForecast.sunrise || '—',
    sunset: todayForecast.sunset || '—',
    dt: Math.floor(Date.now() / 1000),
    timezone: 0,
    uvIndex: now.uvIndex != null ? Number(now.uvIndex) : null,
    soilTemperature: now.soilTemperature != null ? Number(now.soilTemperature) : null,
    soilMoisture: now.soilMoisture != null ? Number(now.soilMoisture) : null,
    leafWetnessIndex:
      now.leafWetnessIndex === true || now.leafWetnessIndex === false
        ? now.leafWetnessIndex
        : null,
    precType: now.precType != null ? Number(now.precType) : null,
    precStrength: now.precStrength != null ? Number(now.precStrength) : null,
    isThunder: typeof now.isThunder === 'boolean' ? now.isThunder : null,
    dewPoint: now.dewPoint != null ? Number(now.dewPoint) : null,
    kpIndex: now.kpIndex != null ? Number(now.kpIndex) : null,
    meanSeaLevelPressure:
      now.meanSeaLevelPressure != null ? Number(now.meanSeaLevelPressure) : null,
    altitude: loc.altitude != null ? Number(loc.altitude) : null,
    pressureNorm: loc.pressureNorm != null ? Number(loc.pressureNorm) : null,
  }
}

function resolveLocation(
  cityOrLat: string | number,
  lonOrNull: number | string,
): { lat: number; lon: number; label: string } {
  let lat = 55.7558
  let lon = 37.6173
  let label = typeof cityOrLat === 'string' ? cityOrLat : 'Локация пользователя'

  if (typeof cityOrLat === 'number' && typeof lonOrNull === 'number') {
    lat = cityOrLat
    lon = lonOrNull
  } else if (typeof cityOrLat === 'string') {
    const cityData = RUSSIAN_CITIES.find((c) => c.value.startsWith(cityOrLat))
    if (cityData) {
      lat = cityData.lat
      lon = cityData.lon
      label = cityData.label
    }
  }

  return { lat, lon, label }
}

export async function fetchWeather(
  cityOrLat: string | number,
  lonOrNull: number | string = 'ru',
): Promise<WeatherData | null> {
  const { lat, lon, label } = resolveLocation(cityOrLat, lonOrNull)

  try {
    const yandex = await tryYandexNow(lat, lon, label)
    if (yandex) return yandex

    const om = await getOpenMeteoBundle(lat, lon, label)
    return om?.weather ?? null
  } catch (e) {
    console.error('fetchWeather error:', e)
    return null
  }
}

export function getWeatherIconUrl(iconOrUrl: string): string {
  if (iconOrUrl && iconOrUrl.startsWith('http')) {
    return iconOrUrl
  }
  if (/^[0-9]{2}[dn]$/.test(iconOrUrl)) {
    return `https://openweathermap.org/img/wn/${iconOrUrl}@2x.png`
  }
  return `https://yastatic.net/weather/i/icons/funky/dark/${iconOrUrl}.svg`
}

export function conditionCategoryLabelRu(category: string): string {
  const c = (category || 'clear').toLowerCase()
  const map: Record<string, string> = {
    clear: 'Ясно',
    clouds: 'Облачно',
    mist: 'Туман',
    rain: 'Дождь',
    snow: 'Снег',
    thunderstorm: 'Гроза',
  }
  return map[c] ?? '—'
}

export async function fetchForecast5(lat: number, lon: number): Promise<ForecastDayItem[]> {
  try {
    const response = await fetch(YANDEX_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: GQL_FORECAST_QUERY,
        variables: { lat, lon },
      }),
    })

    if (response.ok) {
      const result = (await response.json()) as {
        errors?: unknown[]
        data?: { weatherByPoint?: { forecast?: { days?: unknown[] } } }
      }
      if (result?.errors?.length) {
        console.error('Forecast GraphQL response errors:', result.errors)
      } else {
        const days = result.data?.weatherByPoint?.forecast?.days || []
        if (days.length) {
          const dayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
          const monthNames: Record<number, string> = {
            1: 'Янв',
            2: 'Фев',
            3: 'Мар',
            4: 'Апр',
            5: 'Май',
            6: 'Июн',
            7: 'Июл',
            8: 'Авг',
            9: 'Сен',
            10: 'Окт',
            11: 'Ноя',
            12: 'Дек',
          }

          return (days as { time: string; parts?: { day?: Record<string, unknown> } }[]).map(
            (day) => {
              const d = new Date(day.time)
              const dayLabel = dayLabels[d.getUTCDay()]
              const dateLabel = `${d.getUTCDate()} ${monthNames[d.getUTCMonth() + 1]}`
              const p = day.parts?.day || {}
              const windSpeed = p.windSpeed != null ? Number(p.windSpeed) : null
              let alert: string | undefined
              if (windSpeed != null && windSpeed > 12) alert = 'СИЛЬНЫЙ ВЕТЕР ОТЛОЖИТЕ УБОРКУ'

              return {
                date: day.time.split('T')[0],
                dayLabel,
                dateLabel,
                tempMin:
                  p.minTemperature != null
                    ? Number(p.minTemperature)
                    : p.maxTemperature != null
                      ? Number(p.maxTemperature)
                      : 0,
                tempMax: p.maxTemperature != null ? Number(p.maxTemperature) : 0,
                icon: String(p.icon || ''),
                condition: parseCondition(String(p.condition || '')),
                windSpeed,
                pop: p.precProbability != null ? Number(p.precProbability) : 0,
                alert,
              }
            },
          )
        }
      }
    } else {
      console.warn('Yandex Forecast HTTP', response.status)
    }

    const om = await getOpenMeteoBundle(lat, lon, '')
    return om?.forecast ?? []
  } catch (e) {
    console.error('Forecast API error:', e)
    return []
  }
}
