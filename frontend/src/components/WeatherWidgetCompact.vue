<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchWeather, getWeatherIconUrl, type WeatherData } from '@/lib/weatherApi'

const router = useRouter()
const weather = ref<WeatherData | null>(null)
const loading = ref(true)
const error = ref(false)

async function load() {
  loading.value = true
  error.value = false
  const data = await fetchWeather('Kursk', 'ru')
  weather.value = data
  loading.value = false
  if (!data) error.value = true
}

onMounted(() => {
  load()
})

function goToWeather() {
  router.push('/weather')
}

const windClass = () => {
  const w = weather.value?.windSpeed ?? 0
  if (w > 10) return 'weather-extreme'
  if (w > 5) return 'weather-wind-warning'
  return ''
}

const tempClass = () => {
  const t = weather.value?.temp
  if (t == null) return ''
  if (t < -15 || t > 35) return 'weather-extreme'
  return ''
}
</script>

<template>
  <div class="weather-widget-compact" aria-live="polite">
    <div v-if="loading" class="weather-compact-loading">Загрузка погоды…</div>
    <div v-else-if="error" class="weather-compact-error">Не удалось загрузить погоду</div>
    <div v-else class="weather-compact-content">
      <span class="weather-compact-city">{{ weather?.cityName }}</span>
      <span class="weather-compact-temp" :class="tempClass()">{{ weather?.temp ?? '—' }}°C</span>
      <img
        v-if="weather"
        class="weather-compact-icon"
        :src="getWeatherIconUrl(weather.icon)"
        alt=""
      />
      <div>
        <div class="weather-compact-desc">{{ weather?.description }}</div>
        <div class="weather-compact-feels">Ощущается как {{ weather?.feelsLike ?? '—' }}°C</div>
        <div class="weather-compact-meta">
          <span>Влажность: {{ weather?.humidity != null ? weather.humidity + '%' : '—' }}</span>
          <span :class="windClass()">Ветер: {{ weather?.windSpeed != null ? weather.windSpeed + ' м/с' : '—' }}</span>
        </div>
        <button type="button" class="type-action" style="margin-top: 8px" @click="goToWeather">
          Подробнее о погоде →
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.weather-widget-compact {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: var(--space-lg);
  margin-bottom: var(--space-xl);
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.15);
}

.weather-compact-loading,
.weather-compact-error {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.weather-compact-error {
  color: var(--warning-orange);
}

.weather-compact-content {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-lg);
}

.weather-compact-city {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-right: var(--space-sm);
}

.weather-compact-temp {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.weather-compact-icon {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

.weather-compact-desc {
  color: var(--text-secondary);
  font-size: 0.95rem;
  text-transform: capitalize;
}

.weather-compact-feels {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.weather-compact-meta {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.weather-compact-meta span {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.weather-wind-warning {
  color: var(--warning-orange) !important;
  font-weight: 700;
}

.weather-extreme {
  color: var(--danger-red) !important;
  font-weight: 700;
}
</style>
