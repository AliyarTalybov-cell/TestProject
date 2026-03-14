<script setup lang="ts">
import { computed, ref, onMounted, onActivated } from 'vue'
import type { StoredDowntime, DowntimeCategory } from '@/lib/downtimeStorage'
import { loadEvents } from '@/lib/downtimeStorage'
import { loadOperations } from '@/lib/operationStorage'
import { useSupabaseCheck } from '@/composables/useSupabaseCheck'

const { status: supabaseStatus, errorMessage: supabaseError, check: checkSupabase } = useSupabaseCheck()

const events = ref<StoredDowntime[]>(loadEvents())
const operations = ref(loadOperations())
const showAllDowntimes = ref(false)
const showAllOperations = ref(false)

const ROW_LIMIT = 5
const hoveredCategory = ref<DowntimeCategory | null>(null)
const animateProgress = ref(0)
onMounted(() => {
  const duration = 700
  const start = performance.now()
  const tick = (now: number) => {
    const elapsed = now - start
    animateProgress.value = Math.min(1, elapsed / duration)
    if (animateProgress.value < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})

onActivated(() => {
  events.value = loadEvents()
  operations.value = loadOperations()
})

const hasEvents = computed(() => events.value.length > 0)

const sortedEvents = computed(() =>
  [...events.value].sort(
    (a, b) => new Date(b.startISO).getTime() - new Date(a.startISO).getTime(),
  ),
)

const sortedOperations = computed(() =>
  [...operations.value].sort(
    (a, b) => new Date(b.startISO).getTime() - new Date(a.startISO).getTime(),
  ),
)

const visibleDowntimes = computed(() =>
  showAllDowntimes.value ? sortedEvents.value : sortedEvents.value.slice(0, ROW_LIMIT),
)
const visibleOperations = computed(() =>
  showAllOperations.value ? sortedOperations.value : sortedOperations.value.slice(0, ROW_LIMIT),
)
const hasMoreDowntimes = computed(() => sortedEvents.value.length > ROW_LIMIT)
const hasMoreOperations = computed(() => sortedOperations.value.length > ROW_LIMIT)

const totalMinutes = computed(() =>
  events.value.reduce((sum, e) => sum + e.durationMinutes, 0),
)

const totalHoursLabel = computed(() => {
  if (!totalMinutes.value) return '0 ч'
  const hours = totalMinutes.value / 60
  return `${hours.toFixed(1)} ч`
})

const totalOpsMinutes = computed(() =>
  operations.value.reduce((sum, o) => sum + o.durationMinutes, 0),
)
const totalOpsHoursLabel = computed(() => {
  if (!totalOpsMinutes.value) return '0 ч'
  return `${(totalOpsMinutes.value / 60).toFixed(1)} ч`
})
const hasOperations = computed(() => operations.value.length > 0)

const categoriesMeta: Record<
  DowntimeCategory,
  { label: string; colorClass: string }
> = {
  breakdown: { label: 'Поломка техники', colorClass: 'legend-breakdown' },
  rain: { label: 'Дождь / погода', colorClass: 'legend-rain' },
  fuel: { label: 'Нет топлива', colorClass: 'legend-fuel' },
  waiting: { label: 'Ожидание задания', colorClass: 'legend-waiting' },
}
const categoryKeys = ['breakdown', 'rain', 'fuel', 'waiting'] as const

const minutesByCategory = computed(() => {
  const base: Record<DowntimeCategory, number> = {
    breakdown: 0,
    rain: 0,
    fuel: 0,
    waiting: 0,
  }
  events.value.forEach((e) => {
    base[e.category] += e.durationMinutes
  })
  return base
})

const percentsByCategory = computed(() => {
  const total = Object.values(minutesByCategory.value).reduce(
    (sum, m) => sum + m,
    0,
  )
  if (!total) {
    return {
      breakdown: 0,
      rain: 0,
      fuel: 0,
      waiting: 0,
    }
  }
  return {
    breakdown: (minutesByCategory.value.breakdown / total) * 100,
    rain: (minutesByCategory.value.rain / total) * 100,
    fuel: (minutesByCategory.value.fuel / total) * 100,
    waiting: (minutesByCategory.value.waiting / total) * 100,
  }
})

const donutStyle = computed(() => {
  const b = percentsByCategory.value.breakdown
  const r = percentsByCategory.value.rain
  const f = percentsByCategory.value.fuel
  const w = percentsByCategory.value.waiting

  if (!(b + r + f + w)) {
    return { background: 'var(--donut-inner-bg)' }
  }

  const s1 = b
  const s2 = b + r
  const s3 = b + r + f

  return {
    background: `conic-gradient(
      var(--danger-red) 0 ${s1}%,
      #3c91d3 ${s1}% ${s2}%,
      var(--warning-orange) ${s2}% ${s3}%,
      #9ca3af ${s3}% 100%
    )`,
  }
})

const topEmployees = computed(() => {
  const map = new Map<string, number>()
  events.value.forEach((e) => {
    map.set(e.employee, (map.get(e.employee) ?? 0) + e.durationMinutes)
  })
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
})

const OPERATION_COLORS = ['#2e7d32', '#1565c0', '#6a1b9a', '#c62828', '#ef6c00', '#00838f', '#558b2f', '#9e9e9e']

const operationMinutes = computed(() => {
  const map = new Map<string, number>()
  operations.value.forEach((o) => {
    const name = o.operation?.trim() || '—'
    map.set(name, (map.get(name) ?? 0) + o.durationMinutes)
  })
  return map
})

const operationPercents = computed(() => {
  const total = totalOpsMinutes.value
  if (!total) return [] as { name: string; percent: number; minutes: number }[]
  return Array.from(operationMinutes.value.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, minutes]) => ({
      name,
      percent: (minutes / total) * 100,
      minutes,
    }))
})

const donutStyleOps = computed(() => {
  const entries = operationPercents.value
  if (!entries.length) return { background: 'var(--donut-inner-bg)' }
  let acc = 0
  const parts = entries.map((e, i) => {
    const start = acc
    acc += e.percent
    return `${OPERATION_COLORS[i % OPERATION_COLORS.length]} ${start}% ${acc}%`
  })
  return {
    background: `conic-gradient(${parts.join(', ')})`,
  }
})

const hoveredOperation = ref<string | null>(null)

const topEmployeesOps = computed(() => {
  const map = new Map<string, number>()
  operations.value.forEach((o) => {
    map.set(o.employee, (map.get(o.employee) ?? 0) + o.durationMinutes)
  })
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
})

const displayedOpsTotalHoursLabel = computed(() => {
  if (!totalOpsMinutes.value) return '0 ч'
  const hours = (animateProgress.value * totalOpsMinutes.value) / 60
  return `${hours.toFixed(1)} ч`
})

const WEEKDAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const
const dynamicsMetric = ref<'hours' | 'percent'>('hours')

type DayData = { label: string; workMinutes: number; waitingMinutes: number; downtimeMinutes: number }

function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

const dynamicsLast7Days = computed((): DayData[] => {
  const result: DayData[] = []
  const now = new Date()
  const dayKeys = new Map<string, { work: number; downtime: number }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dayKeys.set(toDayKey(d), { work: 0, downtime: 0 })
  }
  operations.value.forEach((o) => {
    const start = new Date(o.startISO)
    const key = toDayKey(start)
    const day = dayKeys.get(key)
    if (day) day.work += o.durationMinutes
  })
  events.value.forEach((e) => {
    const start = new Date(e.startISO)
    const key = toDayKey(start)
    const day = dayKeys.get(key)
    if (day) day.downtime += e.durationMinutes
  })
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = toDayKey(d)
    const day = dayKeys.get(key) ?? { work: 0, downtime: 0 }
    result.push({
      label: WEEKDAY_LABELS[d.getDay()],
      workMinutes: day.work,
      waitingMinutes: 0,
      downtimeMinutes: day.downtime,
    })
  }
  return result
})

const dynamicsMaxMinutes = computed(() => {
  let max = 0
  dynamicsLast7Days.value.forEach((day) => {
    const total = day.workMinutes + day.waitingMinutes + day.downtimeMinutes
    if (total > max) max = total
  })
  return Math.max(max, 60)
})

function dynamicsBarHeight(minutes: number, day?: DayData): string {
  if (dynamicsMetric.value === 'percent' && day) {
    const total = day.workMinutes + day.waitingMinutes + day.downtimeMinutes
    if (!total) return '0%'
    return `${(minutes / total) * 100}%`
  }
  if (!dynamicsMaxMinutes.value) return '0%'
  const pct = (minutes / dynamicsMaxMinutes.value) * 100
  return `${Math.min(100, pct)}%`
}

const displayedTotalHoursLabel = computed(() => {
  if (!totalMinutes.value) return '0 ч'
  const hours = (animateProgress.value * totalMinutes.value) / 60
  return `${hours.toFixed(1)} ч`
})
const displayedPercent = (key: DowntimeCategory) =>
  Math.round(animateProgress.value * (percentsByCategory.value[key] ?? 0))
const displayedMinutes = (key: DowntimeCategory) =>
  Math.round(animateProgress.value * (minutesByCategory.value[key] ?? 0))

function formatDuration(minutes: number): string {
  if (!minutes) return '0 мин'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} мин`
  if (!m) return `${h} ч`
  return `${h} ч ${m} мин`
}

function formatClock(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  })
}
</script>

<template>
  <section class="reports-page">
    <header class="header-area reports-header page-enter-item">
      <div>
        <div class="type-label">Сводка</div>
        <h1 class="page-title">Аналитика</h1>
      </div>
      <div class="reports-header-meta">
        <div class="summary-item">
          <div class="type-label">Простои: записей</div>
          <div class="type-value">{{ events.length }}</div>
        </div>
        <div class="summary-item">
          <div class="type-label">Простои: время</div>
          <div class="type-value">{{ totalHoursLabel }}</div>
        </div>
        <div class="summary-item">
          <div class="type-label">Операции: записей</div>
          <div class="type-value">{{ operations.length }}</div>
        </div>
        <div class="summary-item">
          <div class="type-label">Операции: время</div>
          <div class="type-value">{{ totalOpsHoursLabel }}</div>
        </div>
      </div>
    </header>

    <div v-if="supabaseStatus !== 'idle'" class="supabase-status page-enter-item">
      <template v-if="supabaseStatus === 'checking'">
        <span class="supabase-status-dot supabase-status-dot--loading" />
        Проверка подключения к базе данных...
      </template>
      <template v-else-if="supabaseStatus === 'ok'">
        <span class="supabase-status-dot supabase-status-dot--ok" />
        База данных Supabase: подключено
      </template>
      <template v-else-if="supabaseStatus === 'error'">
        <span class="supabase-status-dot supabase-status-dot--error" />
        Ошибка подключения: {{ supabaseError }}
        <button type="button" class="supabase-status-retry" @click="checkSupabase">Повторить</button>
      </template>
    </div>

    <section class="analytics-dynamics page-enter-item" style="--enter-delay: 40ms">
      <div class="type-label analytics-dynamics-section-label">Дополнительная аналитика</div>
      <div class="panel analytics-dynamics-card">
        <div class="analytics-dynamics-header">
          <div>
            <div class="type-label analytics-dynamics-sublabel">ДИНАМИКА</div>
            <h2 class="analytics-dynamics-title">Активность за 7 дней</h2>
          </div>
          <div class="analytics-dynamics-select-wrap">
            <select v-model="dynamicsMetric" class="analytics-dynamics-select" aria-label="Единица измерения">
              <option value="hours">Часы работы</option>
              <option value="percent">Процент</option>
            </select>
          </div>
        </div>
        <div class="analytics-dynamics-chart">
          <div
            v-for="(day, idx) in dynamicsLast7Days"
            :key="idx"
            class="dynamics-bar-col"
          >
            <div class="dynamics-bar-stack">
              <div
                v-if="day.workMinutes > 0"
                class="dynamics-bar dynamics-bar--work"
                :style="{ height: dynamicsBarHeight(day.workMinutes, day) }"
                :title="`В работе: ${(day.workMinutes / 60).toFixed(1)} ч`"
              />
              <div
                v-if="day.waitingMinutes > 0"
                class="dynamics-bar dynamics-bar--waiting"
                :style="{ height: dynamicsBarHeight(day.waitingMinutes, day) }"
                :title="`Ожидание: ${(day.waitingMinutes / 60).toFixed(1)} ч`"
              />
              <div
                v-if="day.downtimeMinutes > 0"
                class="dynamics-bar dynamics-bar--downtime"
                :style="{ height: dynamicsBarHeight(day.downtimeMinutes, day) }"
                :title="`Простой: ${(day.downtimeMinutes / 60).toFixed(1)} ч`"
              />
            </div>
            <span class="dynamics-day-label">{{ day.label }}</span>
          </div>
        </div>
        <div class="analytics-dynamics-legend">
          <span class="dynamics-legend-item dynamics-legend-item--work">В работе</span>
          <span class="dynamics-legend-item dynamics-legend-item--waiting">Ожидание</span>
          <span class="dynamics-legend-item dynamics-legend-item--downtime">Простой</span>
        </div>
      </div>
    </section>

    <div class="reports-grid">
      <section class="panel panel-table page-enter-item" style="--enter-delay: 80ms">
        <div class="panel-header">
          <div>
            <div class="type-label">Журнал</div>
            <div class="panel-title">Простои техники</div>
          </div>
        </div>

        <div v-if="!hasEvents" class="empty-state">
          <p class="placeholder-text">
            Пока нет записей о простоях. Как только пользователь начнёт и завершит простой на экране оператора, запись появится в этом журнале.
          </p>
        </div>

        <div v-else>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Поле / операция</th>
                  <th>Причина</th>
                  <th>Дата</th>
                  <th>Время</th>
                  <th class="text-right">Длительность</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="event in visibleDowntimes" :key="event.id">
                  <td class="cell-employee">
                    {{ event.employee }}
                  </td>
                  <td class="cell-field">
                    <template v-if="event.fieldName || event.operation">
                      <div v-if="event.fieldName" class="cell-field-main">
                        {{ event.fieldName }}
                      </div>
                      <div v-if="event.operation" class="cell-field-sub">
                        {{ event.operation }}
                      </div>
                    </template>
                    <span v-else class="cell-field-empty">—</span>
                  </td>
                  <td class="cell-reason">
                    <span
                      class="reason-dot"
                      :class="`reason-dot-${event.category}`"
                    />
                    <span>{{ event.reason }}</span>
                  </td>
                  <td class="cell-date">
                    {{ formatDate(event.startISO) }}
                  </td>
                  <td class="cell-time">
                    {{ formatClock(event.startISO) }}–{{ formatClock(event.endISO) }}
                  </td>
                  <td class="cell-duration text-right">
                    {{ formatDuration(event.durationMinutes) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button
            v-if="hasMoreDowntimes"
            type="button"
            class="show-all-btn"
            @click="showAllDowntimes = !showAllDowntimes"
          >
            {{ showAllDowntimes ? 'Свернуть' : 'Показать все' }}
            ({{ sortedEvents.length }})
          </button>
        </div>
      </section>

      <section class="panel panel-chart page-enter-item" style="--enter-delay: 140ms">
        <div class="panel-header">
          <div>
            <div class="type-label">Структура простоев</div>
            <div class="panel-title">По причинам и сотрудникам</div>
          </div>
        </div>

        <div v-if="hasEvents" class="chart-layout">
          <div
            class="donut-wrapper chart-wrapper-interactive"
            :data-hover="hoveredCategory ?? ''"
          >
            <div class="donut-chart reports-donut" :style="donutStyle">
              <div class="donut-inner">
                <div class="donut-total">
                  {{ displayedTotalHoursLabel }}
                </div>
                <div class="donut-label">Всего простоя</div>
              </div>
            </div>
          </div>

          <div class="chart-side">
            <ul class="legend">
              <li
                v-for="(key, idx) in categoryKeys"
                :key="key"
                class="legend-item legend-item-reveal"
                :class="{ 'legend-item-active': hoveredCategory === key }"
                :style="{ '--legend-delay': 0.35 + idx * 0.08 + 's' }"
                @mouseenter="hoveredCategory = key"
                @mouseleave="hoveredCategory = null"
              >
                <div class="legend-label">
                  <span class="legend-color" :class="categoriesMeta[key].colorClass" />
                  <span>{{ categoriesMeta[key].label }}</span>
                </div>
                <span class="legend-value">
                  {{ displayedPercent(key) }}% ·
                  {{ formatDuration(displayedMinutes(key)) }}
                </span>
              </li>
            </ul>

            <div class="top-employees">
              <div class="type-label">Топ по времени простоя</div>
              <ul class="top-list">
                <li
                  v-for="([name, minutes], idx) in topEmployees"
                  :key="name"
                  class="top-item top-item-reveal"
                  :style="{ '--top-delay': 0.6 + idx * 0.06 + 's' }"
                >
                  <span class="top-name">{{ name }}</span>
                  <span class="top-value">{{ formatDuration(minutes) }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <p class="placeholder-text">
            Как только появятся данные о простоях, мы покажем распределение по причинам и сотрудникам.
          </p>
        </div>
      </section>

      <section class="panel panel-table page-enter-item" style="--enter-delay: 180ms">
        <div class="panel-header">
          <div>
            <div class="type-label">Журнал</div>
            <div class="panel-title">Операции</div>
          </div>
        </div>

        <div v-if="!operations.length" class="empty-state">
          <p class="placeholder-text">
            Завершённые операции появятся здесь после нажатия «Остановить операцию» на экране оператора.
          </p>
        </div>

        <div v-else>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Поле / операция</th>
                  <th>Дата</th>
                  <th>Время</th>
                  <th class="text-right">Длительность</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="op in visibleOperations" :key="op.id">
                  <td class="cell-employee">{{ op.employee }}</td>
                  <td class="cell-field">
                    <template v-if="op.fieldName || op.operation">
                      <div v-if="op.fieldName" class="cell-field-main">{{ op.fieldName }}</div>
                      <div v-if="op.operation" class="cell-field-sub">{{ op.operation }}</div>
                    </template>
                    <span v-else class="cell-field-empty">—</span>
                  </td>
                  <td class="cell-date">{{ formatDate(op.startISO) }}</td>
                  <td class="cell-time">
                    {{ formatClock(op.startISO) }}–{{ formatClock(op.endISO) }}
                  </td>
                  <td class="cell-duration text-right">
                    {{ formatDuration(op.durationMinutes) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button
            v-if="hasMoreOperations"
            type="button"
            class="show-all-btn"
            @click="showAllOperations = !showAllOperations"
          >
            {{ showAllOperations ? 'Свернуть' : 'Показать все' }}
            ({{ sortedOperations.length }})
          </button>
        </div>
      </section>

      <section class="panel panel-chart page-enter-item operations-chart-panel" style="--enter-delay: 220ms">
        <div class="panel-header">
          <div>
            <div class="type-label">Структура операций</div>
            <div class="panel-title">По типам операций и сотрудникам</div>
          </div>
        </div>

        <div v-if="hasOperations" class="chart-layout">
          <div
            class="donut-wrapper chart-wrapper-interactive chart-wrapper-ops"
            :data-hover="hoveredOperation ?? ''"
          >
            <div class="donut-chart reports-donut reports-donut-ops" :style="donutStyleOps">
              <div class="donut-inner">
                <div class="donut-total">{{ displayedOpsTotalHoursLabel }}</div>
                <div class="donut-label">Всего работ</div>
              </div>
            </div>
          </div>

          <div class="chart-side">
            <ul class="legend">
              <li
                v-for="(entry, idx) in operationPercents"
                :key="entry.name"
                class="legend-item legend-item-reveal"
                :class="{ 'legend-item-active': hoveredOperation === entry.name }"
                :style="{ '--legend-delay': 0.35 + idx * 0.08 + 's' }"
                @mouseenter="hoveredOperation = entry.name"
                @mouseleave="hoveredOperation = null"
              >
                <div class="legend-label">
                  <span
                    class="legend-color legend-color-ops"
                    :style="{ backgroundColor: OPERATION_COLORS[idx % OPERATION_COLORS.length] }"
                  />
                  <span>{{ entry.name }}</span>
                </div>
                <span class="legend-value">
                  {{ Math.round(animateProgress * entry.percent) }}% ·
                  {{ formatDuration(entry.minutes) }}
                </span>
              </li>
            </ul>

            <div class="top-employees">
              <div class="type-label">Топ по времени работ</div>
              <ul class="top-list">
                <li
                  v-for="([name, minutes], idx) in topEmployeesOps"
                  :key="name"
                  class="top-item top-item-reveal"
                  :style="{ '--top-delay': 0.6 + idx * 0.06 + 's' }"
                >
                  <span class="top-name">{{ name }}</span>
                  <span class="top-value">{{ formatDuration(minutes) }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <p class="placeholder-text">
            Как только появятся данные об операциях, здесь будет распределение по типам и сотрудникам.
          </p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.reports-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.analytics-dynamics {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.analytics-dynamics-section-label {
  color: var(--text-secondary);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.analytics-dynamics-card {
  border-radius: 12px;
  padding: var(--space-lg);
}

.analytics-dynamics-sublabel {
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 4px;
}

.analytics-dynamics-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.analytics-dynamics-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-lg);
}

.analytics-dynamics-select-wrap {
  flex-shrink: 0;
}

.analytics-dynamics-select {
  padding: 8px 28px 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--chip-bg);
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.analytics-dynamics-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  min-height: 140px;
  padding: 0 4px;
}

.dynamics-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.dynamics-bar-stack {
  width: 100%;
  max-width: 36px;
  height: 100px;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  border-radius: 6px 6px 0 0;
  overflow: hidden;
  background: var(--chip-bg);
}

.dynamics-bar {
  width: 100%;
  min-height: 2px;
  border-radius: 0;
  transition: height 0.3s ease;
}

.dynamics-bar--work {
  background: var(--accent-green);
}

.dynamics-bar--waiting {
  background: var(--text-secondary);
  opacity: 0.6;
}

.dynamics-bar--downtime {
  background: var(--danger-red);
}

.dynamics-day-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.analytics-dynamics-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border-color);
}

.dynamics-legend-item {
  font-size: 0.8rem;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.dynamics-legend-item::before {
  content: '';
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.dynamics-legend-item--work::before {
  background: var(--accent-green);
}

.dynamics-legend-item--waiting::before {
  background: var(--text-secondary);
  opacity: 0.6;
}

.dynamics-legend-item--downtime::before {
  background: var(--danger-red);
}

.reports-header {
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--border-color);
}

.supabase-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: var(--space-md);
  border-radius: 10px;
  font-size: 0.9rem;
  background: var(--chip-bg);
  border: 1px solid var(--border-color);
}
.supabase-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.supabase-status-dot--ok {
  background: var(--accent-green);
}
.supabase-status-dot--error {
  background: var(--danger-red);
}
.supabase-status-dot--loading {
  background: var(--warning-orange);
  animation: supabase-pulse 1s ease-in-out infinite;
}
@keyframes supabase-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.supabase-status-retry {
  margin-left: auto;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-panel);
  font-size: 0.85rem;
  cursor: pointer;
}
.supabase-status-retry:hover {
  background: var(--row-hover-bg);
}

.reports-header-meta {
  display: flex;
  gap: var(--space-lg);
  align-items: flex-end;
}

.summary-item .type-value {
  font-size: 1.1rem;
}

.reports-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: var(--space-md);
}

.panel {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  padding: var(--space-lg);
  backdrop-filter: blur(10px);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.panel-title {
  margin-top: 4px;
  font-size: 1.05rem;
  font-weight: 500;
}

.panel-table .table-wrapper {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th,
td {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.85rem;
}

th {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover td {
  background: var(--row-hover-bg);
}

.cell-employee {
  font-weight: 500;
}

.cell-reason {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.cell-field-main {
  font-weight: 500;
}

.cell-field-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.cell-field-empty {
  color: var(--text-secondary);
}

.cell-time,
.cell-date {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.cell-duration {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.reason-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.reason-dot-breakdown {
  background: var(--danger-red);
}

.reason-dot-rain {
  background: #3c91d3;
}

.reason-dot-fuel {
  background: var(--warning-orange);
}

.reason-dot-waiting {
  background: #9ca3af;
}

.panel-chart {
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.25s ease;
}
.panel-chart:hover {
  box-shadow: 0 8px 28px -6px rgba(0, 0, 0, 0.1);
}

.chart-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.6fr);
  gap: var(--space-lg);
  align-items: stretch;
}

.donut-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.donut-chart {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  position: relative;
  box-shadow: var(--donut-ring-shadow);
  opacity: 0;
  transform: scale(0.7);
  animation: donutReveal 0.6s ease-out 0.2s forwards;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

.reports-donut {
  position: relative;
}

.chart-wrapper-interactive[data-hover="breakdown"] .reports-donut {
  box-shadow: 0 0 0 4px rgba(211, 60, 60, 0.35);
  transform: scale(1.03);
}
.chart-wrapper-interactive[data-hover="rain"] .reports-donut {
  box-shadow: 0 0 0 4px rgba(60, 145, 211, 0.35);
  transform: scale(1.03);
}
.chart-wrapper-interactive[data-hover="fuel"] .reports-donut {
  box-shadow: 0 0 0 4px rgba(211, 130, 60, 0.35);
  transform: scale(1.03);
}
.chart-wrapper-interactive[data-hover="waiting"] .reports-donut {
  box-shadow: 0 0 0 4px rgba(156, 163, 175, 0.4);
  transform: scale(1.03);
}

@keyframes donutReveal {
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.donut-inner {
  position: absolute;
  inset: 32px;
  border-radius: 50%;
  background: var(--donut-inner-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.donut-total {
  font-size: 1.3rem;
  font-weight: 600;
}

.donut-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.chart-side {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  justify-content: space-between;
}

.legend {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
  transition: background 0.2s ease, transform 0.2s ease;
  border-radius: 8px;
  padding: 6px 10px;
  margin: 0 -10px;
  cursor: default;
}
.legend-item-active {
  background: var(--row-hover-bg);
  transform: scale(1.02);
}
.legend-item-reveal {
  opacity: 0;
  transform: translateY(8px);
  animation: legendReveal 0.4s ease-out var(--legend-delay, 0.35s) forwards;
}
.legend-item-reveal.legend-item-active {
  transform: scale(1.02) translateY(0);
}
@keyframes legendReveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.legend-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.legend-breakdown {
  background: var(--danger-red);
}

.legend-rain {
  background: #3c91d3;
}

.legend-fuel {
  background: var(--warning-orange);
}

.legend-waiting {
  background: #9ca3af;
}

.legend-value {
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.top-employees {
  border-top: 1px solid var(--border-color);
  padding-top: var(--space-md);
}

.top-list {
  list-style: none;
  padding: 0;
  margin: var(--space-sm) 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.top-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
  transition: background 0.2s ease;
  border-radius: 6px;
  padding: 4px 0;
}
.top-item:hover {
  background: var(--row-hover-bg);
}
.top-item-reveal {
  opacity: 0;
  transform: translateX(-8px);
  animation: topReveal 0.35s ease-out var(--top-delay, 0.6s) forwards;
}
@keyframes topReveal {
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.top-name {
  color: var(--text-secondary);
}

.top-value {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.show-all-btn {
  margin-top: var(--space-md);
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--chip-bg);
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.show-all-btn:hover {
  background: var(--row-hover-bg);
  border-color: var(--agri-primary);
}

.legend-color-ops {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.chart-wrapper-ops[data-hover] .reports-donut-ops {
  transform: scale(1.03);
}

.empty-state {
  padding: var(--space-md) 0;
}

.text-right {
  text-align: right;
}

@media (max-width: 1100px) {
  .reports-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .chart-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .reports-header-meta {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

