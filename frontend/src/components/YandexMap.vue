<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = withDefaults(defineProps<{
  lat?: number
  lon?: number
  zoom?: number
  /** false — только просмотр: без поиска и клика, сразу метка в центре */
  interactive?: boolean
  /** Текст подсказки/балуна у метки (например адрес поля) */
  markerHint?: string
}>(), {
  lat: 55.7558,
  lon: 37.6176,
  zoom: 10,
  interactive: true,
  markerHint: '',
})

const emit = defineEmits<{
  (e: 'pick', coords: { lat: number; lon: number }): void
}>()

const mapEl = ref<HTMLDivElement | null>(null)
let mapInstance: any = null
let placemark: any = null
let ymaps: any = null

async function initMap() {
  if (!mapEl.value) return

  try {
    ymaps = (window as any).ymaps
    if (!ymaps) {
      console.error('ymaps не найден')
      return
    }

    // v2.1: ymaps.ready() — возвращает Promise
    await new Promise<void>((resolve) => ymaps.ready(resolve))

    // v2.1: center это [lat, lon] (не lon, lat как в v3!)
    mapInstance = new ymaps.Map(mapEl.value, {
      center: [props.lat, props.lon],
      zoom: props.zoom,
      controls: ['zoomControl', 'fullscreenControl'],
    })

    if (props.interactive) {
      // Поиск по адресу
      const searchControl = new ymaps.control.SearchControl({
        options: {
          provider: 'yandex#search',
          noPlacemark: true // Мы сами ставим свой красный маркер
        }
      })
      mapInstance.controls.add(searchControl)

      // Обработка выбора из поиска
      searchControl.events.add('resultselect', (e: any) => {
        const index = e.get('index')
        searchControl.getResult(index).then((res: any) => {
          const coords = res.geometry.getCoordinates()
          const [lat, lon] = coords as [number, number]
          console.log('Search result selected:', { lat, lon })
          emit('pick', { lat, lon })
          placeMark(lat, lon)
        })
      })

      // Клик по карте
      mapInstance.events.add('click', (e: any) => {
        const coords: [number, number] = e.get('coords')
        const [lat, lon] = coords
        console.log('Yandex Maps click:', { lat, lon })
        emit('pick', { lat, lon })
        placeMark(lat, lon)
      })
    } else {
      placeMark(props.lat, props.lon)
    }
  } catch (err) {
    console.error('YandexMap init error:', err)
  }
}

function placeMark(lat: number, lon: number) {
  if (!mapInstance || !ymaps) return

  if (placemark) {
    mapInstance.geoObjects.remove(placemark)
    placemark = null
  }

  const hint = props.markerHint?.trim()
  placemark = new ymaps.Placemark(
    [lat, lon],
    hint ? { hintContent: hint, balloonContent: hint } : {},
    {
      preset: 'islands#redDotIcon',
      draggable: false,
    },
  )

  mapInstance.geoObjects.add(placemark)
}

watch(
  [() => props.lat, () => props.lon, () => props.markerHint, () => props.interactive],
  () => {
    if (!mapInstance) return
    const { lat, lon } = props
    mapInstance.setCenter([lat, lon], props.zoom, { duration: 500 })
    if (!props.interactive) {
      placeMark(lat, lon)
    }
  },
)

onMounted(() => { void initMap() })

onBeforeUnmount(() => {
  if (mapInstance) {
    try { mapInstance.destroy() } catch {}
    mapInstance = null
    placemark = null
  }
})
</script>

<template>
  <div class="ymap-wrapper">
    <div ref="mapEl" class="ymap-container" />
    <div v-if="interactive" class="ymap-hint">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
      </svg>
      Нажмите на карту, чтобы выбрать точку наблюдения
    </div>
  </div>
</template>

<style scoped>
.ymap-wrapper {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 12px -4px rgba(0, 0, 0, 0.18);
  position: relative;
  background: #e8edf2;
}

.ymap-container {
  width: 100%;
  height: 400px;
}

.ymap-hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.78rem;
  padding: 6px 14px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  white-space: nowrap;
  backdrop-filter: blur(4px);
  z-index: 10;
}
</style>
