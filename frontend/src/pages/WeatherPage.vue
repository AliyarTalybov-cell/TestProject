<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchWeather, getWeatherIconUrl, type WeatherData } from '@/lib/weatherApi'

const CITIES = [
  { value: 'Kursk,ru', label: 'Курск' },
  { value: 'Krasnodar,ru', label: 'Краснодар' },
  { value: 'Rostov-on-Don,ru', label: 'Ростов-на-Дону' },
] as const

const cityValue = ref('Kursk,ru')
const weather = ref<WeatherData | null>(null)
const loading = ref(true)
const error = ref(false)


async function load() {
  loading.value = true
  error.value = false
  const [city, country] = cityValue.value.split(',')
  const data = await fetchWeather(city, country)
  weather.value = data
  loading.value = false
  if (!data) error.value = true
}

function refresh() {
  load()
}

onMounted(() => {
  load()
})

const updatedAt = computed(() => {
  const d = new Date()
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
})

const dateStr = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
})

const timeStr = computed(() => {
  const d = new Date()
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
})

const windStrong = computed(() => (weather.value?.windSpeed ?? 0) > 5)
const windExtreme = computed(() => (weather.value?.windSpeed ?? 0) > 10)
const tempExtreme = computed(() => {
  const t = weather.value?.temp
  return t != null && (t < -15 || t > 35)
})

const recommendations = computed(() => {
  const data = weather.value
  if (!data) return []
  const temp = data.temp ?? 15
  const wind = data.windSpeed ?? 0
  return [
    {
      key: 'wheat',
      name: 'Пшеница озимая',
      icon: '🌾',
      statusClass: temp >= 0 && temp <= 25 && wind < 10 ? 'ok' : temp < -5 ? 'risk' : 'warn',
      status: temp >= 0 && temp <= 25 && wind < 10 ? 'Комфортно' : temp < -5 ? 'Риск' : 'Ожидание',
      text:
        temp >= 0 && temp <= 25 && wind < 10
          ? 'Температурный режим оптимален. Рекомендуется плановый осмотр всходов.'
          : temp < -5
            ? 'Возможны морозы. Контроль состояния озимых.'
            : 'Температура на границе нормы. Отложите внесение удобрений при ветре >5 м/с.',
    },
    {
      key: 'sunflower',
      name: 'Подсолнечник',
      icon: '🌻',
      statusClass: temp >= 10 && temp <= 28 ? 'ok' : temp < 8 ? 'warn' : 'risk',
      status: temp >= 10 && temp <= 28 ? 'Комфортно' : temp < 8 ? 'Ожидание' : 'Риск заморозков',
      text:
        temp >= 10 && temp <= 28
          ? 'Условия благоприятны для посева и вегетации.'
          : temp < 8
            ? 'Почва недостаточно прогрета. Ожидайте повышения ночных температур.'
            : 'Риск ночных заморозков. Отложите посев.',
    },
    {
      key: 'corn',
      name: 'Кукуруза',
      icon: '🌽',
      statusClass: temp >= 10 && wind < 8 ? 'ok' : temp < 8 ? 'warn' : 'risk',
      status: temp >= 10 && wind < 8 ? 'Подготовка' : temp < 8 ? 'Ожидание' : 'Риск',
      text:
        temp >= 10 && wind < 8
          ? 'Условия благоприятны для подготовки техники к началу посевной кампании.'
          : temp < 8
            ? 'Ожидается ночное понижение температуры. Риск повреждения всходов возвратными заморозками.'
            : 'Сильный ветер. Не рекомендуется опрыскивание.',
    },
  ]
})

const fieldsWithWeather = computed(() => {
  const data = weather.value
  const temp = data?.temp ?? 0
  const wind = data?.windSpeed ?? 0
  const icon = data?.icon ?? '01d'
  const list = [
    { name: 'Поле #5', cropName: 'Пшеница' },
    { name: 'Поле #12', cropName: 'Кукуруза' },
    { name: 'Поле #3', cropName: 'Соя' },
    { name: 'Поле #8', cropName: 'Подсолнечник' },
    { name: 'Поле #21', cropName: 'Пшеница' },
  ]
  return list.map((f, i) => {
    const offset = (i % 3) - 1
    const w = Math.min(15, Math.max(0, wind + (i % 2)))
    return {
      ...f,
      temp: temp + offset,
      wind: w,
      windStrong: w > 5,
      icon,
    }
  })
})
</script>

<template>
  <section class="weather-page">
    <header class="header-area header-weather">
      <div>
        <div class="type-label" style="margin-bottom: 8px">Текущий раздел</div>
        <h1 class="page-title">Погода</h1>
      </div>
      <div class="weather-header-actions">
        <select v-model="cityValue" class="weather-city-select" aria-label="Выбор города" @change="load">
          <option v-for="c in CITIES" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <button type="button" class="btn btn-ghost" aria-label="Обновить" @click="refresh">Обновить</button>
      </div>
    </header>

    <div v-if="loading" class="weather-detail-loading">Загрузка погоды…</div>
    <div v-else-if="error" class="weather-detail-error">Не удалось загрузить погоду</div>
    <template v-else-if="weather">
      <div class="weather-current-block card-rounded">
        <div class="weather-current-main">
          <div class="weather-current-city">{{ weather.cityName }}</div>
          <div class="weather-current-datetime">Данные OpenWeatherMap · Обновлено {{ updatedAt }}</div>
          <div class="weather-current-datetime">{{ dateStr }}, {{ timeStr }}</div>
          <div class="weather-current-temp-wrap">
            <span class="weather-current-temp" :class="{ 'weather-extreme': tempExtreme }">
              {{ weather.temp != null ? weather.temp : '—' }}°C
            </span>
            <img class="weather-current-icon" :src="getWeatherIconUrl(weather.icon)" alt="" />
          </div>
          <div class="weather-current-desc">{{ weather.description }}</div>
          <div class="weather-current-feels">Ощущается как {{ weather.feelsLike ?? '—' }}°C</div>
          <div class="weather-current-extra">
            <span>Давление {{ weather.pressure != null ? weather.pressure + ' гПа' : '—' }}</span>
            <span>Видимость {{ weather.visibility != null ? weather.visibility / 1000 + ' км' : '—' }}</span>
            <span>Облачность {{ weather.clouds != null ? weather.clouds + '%' : '—' }}</span>
          </div>
        </div>
        <div class="weather-current-coords">
          <span class="weather-param-label">Координаты</span>
          <div class="weather-param-value">
            Широта: {{ weather.coord?.lat != null ? weather.coord.lat.toFixed(2) + '°' : '—' }}, Долгота:
            {{ weather.coord?.lon != null ? weather.coord.lon.toFixed(2) + '°' : '—' }}
          </div>
        </div>
      </div>

      <div class="weather-params-grid">
        <div class="weather-param-card">
          <div class="weather-param-label">Ветер</div>
          <div
            class="weather-param-value"
            :class="{ 'weather-extreme': windExtreme, 'weather-wind-warning': windStrong && !windExtreme }"
          >
            {{ weather.windSpeed != null ? weather.windSpeed + ' м/с' : '—' }} {{ weather.windDirection }}
          </div>
        </div>
        <div class="weather-param-card">
          <div class="weather-param-label">Направление ветра</div>
          <div class="weather-param-value">{{ weather.windDeg != null ? weather.windDeg + '°' : '—' }} {{ weather.windDirection }}</div>
        </div>
        <div class="weather-param-card">
          <div class="weather-param-label">Влажность</div>
          <div class="weather-param-value">{{ weather.humidity != null ? weather.humidity + '%' : '—' }}</div>
        </div>
        <div class="weather-param-card">
          <div class="weather-param-label">Давление (уровень моря)</div>
          <div class="weather-param-value">
            {{ weather.seaLevel != null ? weather.seaLevel + ' гПа' : weather.pressure != null ? weather.pressure + ' гПа' : '—' }}
          </div>
        </div>
        <div class="weather-param-card">
          <div class="weather-param-label">Давление (у земли)</div>
          <div class="weather-param-value">{{ weather.grndLevel != null ? weather.grndLevel + ' гПа' : '—' }}</div>
        </div>
        <div class="weather-param-card">
          <div class="weather-param-label">Восход / закат</div>
          <div class="weather-param-value">{{ weather.sunrise }} — {{ weather.sunset }}</div>
        </div>
        <div class="weather-param-card">
          <div class="weather-param-label">Координаты</div>
          <div class="weather-param-value">
            {{ weather.coord?.lat != null ? weather.coord.lat.toFixed(2) + '°' : '—' }}
            {{ weather.coord?.lon != null ? weather.coord.lon.toFixed(2) + '°' : '' }}
          </div>
        </div>
      </div>

      <div class="weather-recommendations card-rounded">
        <h2 class="weather-block-title">Рекомендации по культурам на сегодня</h2>
        <p class="weather-block-subtitle">Анализ текущих погодных условий для основных посевов.</p>
        <div class="weather-crops-list">
          <div v-for="r in recommendations" :key="r.key" class="weather-crop-item">
            <div class="weather-crop-icon" :class="r.key">{{ r.icon }}</div>
            <div>
              <div class="type-value">{{ r.name }}</div>
              <span class="weather-crop-status" :class="r.statusClass">{{ r.status }}</span>
              <p class="weather-crop-desc">{{ r.text }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="weather-fields-block card-rounded">
        <h2 class="weather-block-title">Состояние полей</h2>
        <div class="weather-fields-list">
          <div v-for="f in fieldsWithWeather" :key="f.name" class="weather-field-mini">
            <div>
              <div class="weather-field-mini-name">{{ f.name }}</div>
              <div class="weather-field-mini-crop">{{ f.cropName }}</div>
            </div>
            <div class="weather-field-mini-weather">
              <img :src="getWeatherIconUrl(f.icon)" alt="" width="28" height="28" />
              <span class="weather-field-mini-temp">{{ f.temp }}°C</span>
              <span class="weather-field-mini-wind" :class="{ 'wind-strong': f.windStrong }">Ветер {{ f.wind }} м/с</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.weather-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.header-weather {
  flex-wrap: wrap;
  gap: var(--space-md);
}

.weather-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.weather-city-select {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  font-size: 0.9rem;
  cursor: pointer;
}

.weather-detail-loading,
.weather-detail-error {
  color: var(--text-secondary);
  padding: var(--space-xl);
}

.weather-detail-error {
  color: var(--warning-orange);
}

.card-rounded {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: var(--space-lg);
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.15);
}

.weather-current-block {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-xl);
  align-items: center;
}

.weather-current-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.weather-current-city {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.weather-current-datetime {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.weather-current-temp-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.weather-current-temp {
  font-size: 3rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.weather-current-icon {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

.weather-current-desc {
  font-size: 1rem;
  color: var(--text-secondary);
  text-transform: capitalize;
}

.weather-current-feels {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.weather-current-extra {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.weather-current-coords {
  padding: var(--space-md);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  align-self: start;
}

.weather-params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-md);
}

.weather-param-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: var(--space-md);
}

.weather-param-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.weather-param-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.weather-wind-warning {
  color: var(--warning-orange) !important;
}

.weather-extreme {
  color: var(--danger-red) !important;
}

.weather-block-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--space-sm);
}

.weather-block-subtitle {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0 0 var(--space-md);
}

.weather-crops-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.weather-crop-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md) 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.weather-crop-item:last-child {
  border-bottom: none;
}

.weather-crop-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.weather-crop-icon.wheat {
  background: rgba(232, 197, 71, 0.25);
  color: var(--wheat-gold);
}

.weather-crop-icon.sunflower {
  background: rgba(244, 211, 94, 0.25);
  color: var(--corn-yellow);
}

.weather-crop-icon.corn {
  background: rgba(104, 173, 51, 0.25);
  color: var(--accent-green);
}

.weather-crop-status {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.weather-crop-status.ok {
  background: rgba(104, 173, 51, 0.25);
  color: var(--accent-green);
}

.weather-crop-status.warn {
  background: rgba(211, 130, 60, 0.25);
  color: var(--warning-orange);
}

.weather-crop-status.risk {
  background: rgba(211, 60, 60, 0.2);
  color: var(--danger-red);
}

.weather-crop-desc {
  margin: 8px 0 0 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.weather-fields-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-md);
}

.weather-field-mini {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: var(--space-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.weather-field-mini-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.weather-field-mini-crop {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.weather-field-mini-weather {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.weather-field-mini-temp {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.weather-field-mini-wind {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.weather-field-mini-wind.wind-strong {
  color: var(--warning-orange);
  font-weight: 700;
}

@media (max-width: 1024px) {
  .weather-current-block {
    grid-template-columns: 1fr;
  }

  .weather-params-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .weather-params-grid {
    grid-template-columns: 1fr;
  }

  .weather-fields-list {
    grid-template-columns: 1fr;
  }
}
</style>
