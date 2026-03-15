<script setup lang="ts">
import { computed, ref, onMounted, onActivated } from 'vue'
import { useAuth } from '@/stores/auth'
import {
  isSupabaseConfigured,
  loadProfiles,
  upsertMyProfile,
  loadTasksFromSupabase,
  tasksWithAssignees,
  createTask as createTaskApi,
  updateTask as updateTaskApi,
  deleteTask as deleteTaskApi,
} from '@/lib/tasksSupabase'
import type { Task as TaskType, ProfileRow } from '@/lib/tasksSupabase'

type ViewMode = 'kanban' | 'list'
type FilterKey = 'all' | 'mine' | 'overdue' | 'by_field' | 'by_employee'
type Priority = 'high' | 'medium' | 'low'
type Status = 'todo' | 'in_progress' | 'review' | 'done'

interface AssigneeOption {
  id: string
  name: string
  initials: string
}

type Task = TaskType

const auth = useAuth()
const viewMode = ref<ViewMode>('kanban')
const activeFilter = ref<FilterKey>('all')
const filterEmployeeId = ref<string>('')
const filterStatus = ref<Status | ''>('')
const showCreateModal = ref(false)
const editingTaskId = ref<string | null>(null)
const selectedTaskId = ref<string | null>(null)
const dragTaskId = ref<string | null>(null)
const dragOverColumn = ref<Status | null>(null)
let clickAfterDragGuard = false

const tasksLoading = ref(true)
const tasks = ref<Task[]>([])
const profiles = ref<ProfileRow[]>([])
const assignees = computed<AssigneeOption[]>(() => {
  if (!auth.user.value) return []
  const list = profiles.value.map((p) => ({
    id: p.id,
    name: p.display_name || p.email,
    initials: p.display_name
      ? (p.display_name.trim().split(/\s+/).length >= 2
          ? (p.display_name.trim().split(/\s+/)[0][0] + p.display_name.trim().split(/\s+/)[1][0]).toUpperCase()
          : p.display_name.trim().slice(0, 2).toUpperCase())
      : p.email.slice(0, 2).toUpperCase(),
  }))
  if (!isManager.value) {
    const me = auth.user.value
    const email = me.email ?? ''
    const name = (me.user_metadata?.full_name as string) || email
    return [{ id: me.id, name, initials: name.slice(0, 2).toUpperCase() }]
  }
  return list
})
const currentUserAssignee = computed<AssigneeOption | null>(() => {
  if (!auth.user.value) return null
  const me = auth.user.value
  const email = me.email ?? ''
  const name = (me.user_metadata?.full_name as string) || email
  return { id: me.id, name, initials: name.slice(0, 2).toUpperCase() }
})

const isManager = computed(() => auth.userRole.value === 'manager')

async function loadData() {
  if (!isSupabaseConfigured() || !auth.user.value) {
    tasks.value = []
    tasksLoading.value = false
    return
  }
  tasksLoading.value = true
  try {
    const user = auth.user.value
    await upsertMyProfile(
      user.id,
      user.email ?? '',
      (user.user_metadata?.full_name as string) ?? null,
      (user.user_metadata?.role as string) ?? null,
    )
    const profileList = await loadProfiles()
    profiles.value = profileList
    const onlyMine = auth.userRole.value === 'worker'
    const rows = await loadTasksFromSupabase(onlyMine, user.id)
    tasks.value = tasksWithAssignees(rows, profileList)
  } catch {
    tasks.value = []
  } finally {
    tasksLoading.value = false
  }
}

const fields = [
  'Поле 1', 'Поле 2', 'Поле 3', 'Поле 5', 'Поле 12', 'Поле 15', 'Участок 3',
  'База', 'Гараж', 'Склад', 'Офис', 'Все поля', 'Южный сектор', 'Северный сектор',
]

const workTypes = ['Опрыскивание', 'Осмотр', 'Техника', 'Документы', 'Обслуживание', 'Посев', 'Уборка']

const filters: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Все задачи' },
  { key: 'mine', label: 'На мне' },
  { key: 'overdue', label: 'Просроченные' },
  { key: 'by_field', label: 'По полям' },
  { key: 'by_employee', label: 'По сотрудникам' },
]

const statusColumns: { key: Status; title: string }[] = [
  { key: 'todo', title: 'К выполнению' },
  { key: 'in_progress', title: 'В процессе' },
  { key: 'review', title: 'На проверке' },
  { key: 'done', title: 'Выполнено' },
]

onMounted(loadData)
onActivated(loadData)

const form = ref({
  title: '',
  assigneeId: '',
  field: fields[0],
  priority: 'medium' as Priority,
  dueDate: '',
  workType: workTypes[0],
  description: '',
})

const filteredTasks = computed(() => {
  let list = tasks.value
  if (activeFilter.value === 'overdue') {
    list = list.filter((t) => t.description === 'Просрочено')
  }
  if (activeFilter.value === 'mine' && auth.user.value) {
    const myId = auth.user.value.id
    list = list.filter((t) => (t.assignee as { id?: string }).id === myId)
  }
  if (filterEmployeeId.value) {
    list = list.filter((t) => (t.assignee as { id?: string }).id === filterEmployeeId.value)
  }
  if (filterStatus.value) {
    list = list.filter((t) => t.status === filterStatus.value)
  }
  return list
})

const tasksByStatus = computed(() => {
  const byStatus: Record<Status, Task[]> = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  }
  filteredTasks.value.forEach((t) => byStatus[t.status].push(t))
  return byStatus
})

const countByStatus = (status: Status) => tasksByStatus.value[status].length

const selectedTask = computed(() =>
  selectedTaskId.value
    ? (tasks.value.find((t) => t.id === selectedTaskId.value) ?? null)
    : null
)

function openCreate() {
  editingTaskId.value = null
  const d = new Date()
  const defaultAssigneeId = !isManager.value && currentUserAssignee.value
    ? currentUserAssignee.value.id
    : (assignees.value[0]?.id ?? '')
  form.value = {
    title: '',
    assigneeId: defaultAssigneeId,
    field: fields[0],
    priority: 'medium',
    dueDate: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.'),
    workType: workTypes[0],
    description: '',
  }
  showCreateModal.value = true
}

function openEdit() {
  const task = selectedTask.value
  if (!task) return
  const assigneeId = (task.assignee as { id?: string }).id ?? assignees.value[0]?.id ?? ''
  form.value = {
    title: task.title,
    assigneeId,
    field: task.field,
    priority: task.priority,
    dueDate: task.dueDate === '—' ? '' : task.dueDate,
    workType: task.workType ?? workTypes[0],
    description: task.description ?? '',
  }
  editingTaskId.value = task.id
  showCreateModal.value = true
  closeTask()
}

function closeCreate() {
  showCreateModal.value = false
  editingTaskId.value = null
}

async function createTask() {
  const title = form.value.title.trim()
  if (!title) return
  const assignee = assignees.value.find((a) => a.id === form.value.assigneeId) ?? assignees.value[0]
  if (!assignee) return
  if (editingTaskId.value) {
    if (!isSupabaseConfigured()) return
    try {
      const payload: Parameters<typeof updateTaskApi>[1] = {
        title,
        priority: form.value.priority,
        field: form.value.field,
        due_date: form.value.dueDate || '—',
        work_type: form.value.workType,
        description: form.value.description.trim() || undefined,
      }
      if (isManager.value && assignee.id) payload.assignee_id = assignee.id
      await updateTaskApi(editingTaskId.value, payload)
      await loadData()
    } catch {
      // fallback: update local
      const t = tasks.value.find((x) => x.id === editingTaskId.value)
      if (t) {
        t.title = title
        t.assignee = { id: assignee.id, name: assignee.name, initials: assignee.initials }
        t.priority = form.value.priority
        t.field = form.value.field
        t.dueDate = form.value.dueDate || '—'
        t.workType = form.value.workType || undefined
        t.description = form.value.description.trim() || undefined
      }
    }
  } else {
    if (!isSupabaseConfigured() || !auth.user.value) return
    try {
      await createTaskApi(
        {
          title,
          priority: form.value.priority,
          field: form.value.field,
          due_date: form.value.dueDate || '—',
          status: 'todo',
          work_type: form.value.workType,
          description: form.value.description.trim() || undefined,
        },
        assignee.id,
        auth.user.value.id,
      )
      await loadData()
    } catch {
      // skip if no Supabase
    }
  }
  closeCreate()
}

function openTask(id: string) {
  if (clickAfterDragGuard) return
  selectedTaskId.value = id
}
function closeTask() {
  selectedTaskId.value = null
}

async function updateTaskStatus(taskId: string, newStatus: Status) {
  const t = tasks.value.find((x) => x.id === taskId)
  if (t) t.status = newStatus
  if (isSupabaseConfigured()) {
    try {
      await updateTaskApi(taskId, { status: newStatus })
    } catch {
      if (t) t.status = t.status
    }
  }
}

async function deleteTask() {
  if (!selectedTaskId.value) return
  if (!confirm('Удалить эту задачу?')) return
  if (isSupabaseConfigured()) {
    try {
      await deleteTaskApi(selectedTaskId.value)
      await loadData()
    } catch {
      tasks.value = tasks.value.filter((t) => t.id !== selectedTaskId.value)
    }
  } else {
    tasks.value = tasks.value.filter((t) => t.id !== selectedTaskId.value)
  }
  closeTask()
}

function onDragStart(e: DragEvent, taskId: string) {
  dragTaskId.value = taskId
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', taskId)
  if (e.target instanceof HTMLElement) e.target.classList.add('task-card--dragging')
}
function onDragEnd(e: DragEvent) {
  dragTaskId.value = null
  dragOverColumn.value = null
  clickAfterDragGuard = true
  setTimeout(() => { clickAfterDragGuard = false }, 150)
  if (e.target instanceof HTMLElement) e.target.classList.remove('task-card--dragging')
}
function onDragOver(e: DragEvent, status: Status) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragOverColumn.value = status
}
function onDragLeave() {
  dragOverColumn.value = null
}
function onDrop(e: DragEvent, newStatus: Status) {
  e.preventDefault()
  dragOverColumn.value = null
  const taskId = e.dataTransfer?.getData('text/plain')
  if (taskId) updateTaskStatus(taskId, newStatus)
}

function priorityClass(p: Priority) {
  return { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' }[p]
}
function statusClass(s: Status) {
  return {
    todo: 'status-todo',
    in_progress: 'status-in-progress',
    review: 'status-review',
    done: 'status-done',
  }[s]
}
</script>

<template>
  <section class="task-management-page page-enter-item">
    <header class="task-header">
      <div class="task-header-left">
        <div class="task-filter-tabs">
          <button
            v-for="f in filters"
            :key="f.key"
            type="button"
            class="task-filter-tab"
            :class="{ 'task-filter-tab--active': activeFilter === f.key }"
            @click="activeFilter = f.key"
          >
            {{ f.label }}
          </button>
        </div>
        <div class="task-filter-selects">
          <label v-if="isManager" class="task-filter-select-wrap">
            <span class="task-filter-select-label">Сотрудник</span>
            <select
              v-model="filterEmployeeId"
              class="task-filter-select"
              :disabled="!assignees.length"
            >
              <option value="">Все сотрудники</option>
              <option
                v-for="a in assignees"
                :key="a.id"
                :value="a.id"
              >
                {{ a.name }}
              </option>
            </select>
          </label>
          <label class="task-filter-select-wrap">
            <span class="task-filter-select-label">Статус</span>
            <select
              v-model="filterStatus"
              class="task-filter-select"
            >
              <option value="">Все статусы</option>
              <option
                v-for="col in statusColumns"
                :key="col.key"
                :value="col.key"
              >
                {{ col.title }}
              </option>
            </select>
          </label>
        </div>
        <div class="task-view-toggle">
          <button
            type="button"
            class="task-view-btn"
            :class="{ 'task-view-btn--active': viewMode === 'kanban' }"
            aria-label="Канбан"
            @click="viewMode = 'kanban'"
          >
            <svg class="task-header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="7" height="7" x="3" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="14" rx="1"/>
              <rect width="7" height="7" x="3" y="14" rx="1"/>
            </svg>
            Канбан
          </button>
          <button
            type="button"
            class="task-view-btn"
            :class="{ 'task-view-btn--active': viewMode === 'list' }"
            aria-label="Список"
            @click="viewMode = 'list'"
          >
            <svg class="task-header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" x2="21" y1="6" y2="6"/>
              <line x1="8" x2="21" y1="12" y2="12"/>
              <line x1="8" x2="21" y1="18" y2="18"/>
              <line x1="3" x2="3.01" y1="6" y2="6"/>
              <line x1="3" x2="3.01" y1="12" y2="12"/>
              <line x1="3" x2="3.01" y1="18" y2="18"/>
            </svg>
            Список
          </button>
        </div>
      </div>
      <button type="button" class="task-btn-create" @click="openCreate">
        <svg class="task-header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
        Создать задачу
      </button>
    </header>

    <p v-if="tasksLoading" class="task-loading-hint">Загрузка задач…</p>
    <!-- Kanban -->
    <div v-show="viewMode === 'kanban' && !tasksLoading" class="task-kanban">
      <div
        v-for="col in statusColumns"
        :key="col.key"
        class="task-kanban-column"
        :class="{ 'task-kanban-column--drag-over': dragOverColumn === col.key }"
        @dragover="(e) => onDragOver(e, col.key)"
        @dragleave="onDragLeave"
        @drop="(e) => onDrop(e, col.key)"
      >
        <h3 class="task-column-title">
          {{ col.title }} {{ countByStatus(col.key) }}
        </h3>
        <div class="task-column-underline" aria-hidden="true"></div>
        <div class="task-column-cards">
          <article
            v-for="task in tasksByStatus[col.key]"
            :key="task.id"
            class="task-card"
            draggable="true"
            tabindex="0"
            @click="openTask(task.id)"
            @keydown.enter="openTask(task.id)"
            @dragstart="(e) => onDragStart(e, task.id)"
            @dragend="onDragEnd"
          >
            <div class="task-card-head">
              <span class="task-card-title">{{ task.title }}</span>
              <span class="task-card-avatar">{{ task.assignee.initials }}</span>
            </div>
            <div class="task-card-meta">
              <span class="task-pill" :class="priorityClass(task.priority)">
                {{ task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий' }}
              </span>
              <span class="task-pill task-pill-field">{{ task.field }}</span>
            </div>
            <div v-if="task.workType" class="task-card-type">
              {{ task.workType }}
            </div>
            <div class="task-card-due">
              <template v-if="task.description === 'Просрочено'">
                <span class="task-overdue">Просрочено</span>
              </template>
              <template v-else>
                до {{ task.dueDate }}
              </template>
            </div>
          </article>
          <div v-if="!tasksByStatus[col.key].length" class="task-column-empty">
            <div class="task-empty-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
            </div>
            <p class="task-empty-title">Задач пока нет</p>
            <p class="task-empty-desc">В этой колонке сейчас пусто. Самое время запланировать новые работы.</p>
            <button type="button" class="task-empty-btn" @click="openCreate">Создать первую задачу</button>
          </div>
        </div>
      </div>
    </div>

    <!-- List -->
    <div v-show="viewMode === 'list' && !tasksLoading" class="task-list-wrap">
      <div class="task-list-table-wrapper">
        <table class="task-list-table">
          <thead>
            <tr>
              <th>Название задачи</th>
              <th>Исполнитель</th>
              <th>Приоритет</th>
              <th>Объект / поле</th>
              <th>Срок</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="task in filteredTasks"
              :key="task.id"
              class="task-list-row"
              @click="openTask(task.id)"
            >
              <td class="task-list-cell-title">{{ task.title }}</td>
              <td class="task-list-cell-assignee">
                <span class="task-list-avatar">{{ task.assignee.initials }}</span>
                {{ task.assignee.name }}
              </td>
              <td>
                <span class="task-pill" :class="priorityClass(task.priority)">
                  {{ task.priority === 'high' ? 'Высокий' : task.priority === 'medium' ? 'Средний' : 'Низкий' }}
                </span>
              </td>
              <td>
                <span class="task-pill task-pill-field">{{ task.field }}</span>
              </td>
              <td :class="{ 'task-cell-overdue': task.description === 'Просрочено' }">
                <template v-if="task.description === 'Просрочено'">
                  <span class="task-overdue-icon" aria-hidden="true">△</span>
                  {{ task.dueDate }}
                </template>
                <template v-else>{{ task.dueDate }}</template>
              </td>
              <td>
                <span class="task-status-dot" :class="statusClass(task.status)" aria-hidden="true"></span>
                {{ statusColumns.find((c) => c.key === task.status)?.title }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: New Task -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="task-modal-backdrop" @click.self="closeCreate">
        <div class="task-modal task-modal--create" role="dialog" aria-labelledby="task-modal-title">
          <button type="button" class="task-modal-close" aria-label="Закрыть" @click="closeCreate">×</button>
          <h2 id="task-modal-title" class="task-modal-title">{{ editingTaskId ? 'Редактировать задачу' : 'Новая задача' }}</h2>
          <form class="task-form task-form--compact" @submit.prevent="createTask">
            <div class="task-form-row">
              <label class="task-form-label">Название задачи</label>
              <input v-model="form.title" type="text" class="task-form-input" placeholder="Введите название..." />
            </div>
            <div class="task-form-row task-form-row--two">
              <div class="task-form-field">
                <label class="task-form-label">Исполнитель</label>
                <div v-if="isManager" class="task-form-select-wrap">
                  <span class="task-form-avatar">{{ (assignees.find(a => a.id === form.assigneeId) ?? assignees[0])?.initials ?? '—' }}</span>
                  <select v-model="form.assigneeId" class="task-form-select">
                    <option v-for="a in assignees" :key="a.id" :value="a.id">{{ a.name }}</option>
                  </select>
                </div>
                <div v-else class="task-form-static-assignee">Назначить себе</div>
              </div>
              <div class="task-form-field">
                <label class="task-form-label">Объект / поле</label>
                <select v-model="form.field" class="task-form-select">
                  <option v-for="f in fields" :key="f" :value="f">{{ f }}</option>
                </select>
              </div>
            </div>
            <div class="task-form-row">
              <label class="task-form-label">Приоритет</label>
              <div class="task-form-priority">
                <button type="button" class="task-form-priority-btn" :class="{ 'task-form-priority-btn--active': form.priority === 'high' }" @click="form.priority = 'high'">высокий</button>
                <button type="button" class="task-form-priority-btn" :class="{ 'task-form-priority-btn--active': form.priority === 'medium' }" @click="form.priority = 'medium'">Средний</button>
                <button type="button" class="task-form-priority-btn" :class="{ 'task-form-priority-btn--active': form.priority === 'low' }" @click="form.priority = 'low'">низкий</button>
              </div>
            </div>
            <div class="task-form-row task-form-row--two">
              <div class="task-form-field">
                <label class="task-form-label">Срок выполнения</label>
                <input v-model="form.dueDate" type="text" class="task-form-input task-form-input--date" placeholder="ДД.ММ.ГГГГ" />
              </div>
              <div class="task-form-field">
                <label class="task-form-label">Тип работ</label>
                <select v-model="form.workType" class="task-form-select">
                  <option v-for="w in workTypes" :key="w" :value="w">{{ w }}</option>
                </select>
              </div>
            </div>
            <div class="task-form-row">
              <label class="task-form-label">Описание и инструкции</label>
              <textarea v-model="form.description" class="task-form-textarea" placeholder="Добавьте подробности для исполнителя..." rows="3"></textarea>
            </div>
            <div class="task-form-actions">
              <button type="button" class="task-form-cancel" @click="closeCreate">Отмена</button>
              <button type="submit" class="task-form-submit">{{ editingTaskId ? 'Сохранить' : 'Создать задачу' }}</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Modal: Task detail -->
    <Teleport to="body">
      <div v-if="selectedTask" class="task-modal-backdrop" @click.self="closeTask">
        <div class="task-modal task-modal--detail" role="dialog" aria-labelledby="task-detail-title">
          <button type="button" class="task-modal-close" aria-label="Закрыть" @click="closeTask">×</button>
          <div class="task-detail-badges">
            <span class="task-pill task-pill-status" :class="selectedTask ? statusClass(selectedTask.status) : ''">{{ statusColumns.find((c) => c.key === selectedTask?.status)?.title }}</span>
            <span class="task-pill" :class="priorityClass(selectedTask.priority)">
              {{ selectedTask.priority === 'high' ? 'Высокий приоритет' : selectedTask.priority === 'medium' ? 'Средний' : 'Низкий' }}
            </span>
          </div>
          <h2 id="task-detail-title" class="task-detail-title">{{ selectedTask.title }}</h2>
          <dl class="task-detail-list">
            <div class="task-detail-item">
              <dt class="task-detail-label">Исполнитель</dt>
              <dd class="task-detail-value">
                <span class="task-detail-avatar">{{ selectedTask.assignee.initials }}</span>
                {{ selectedTask.assignee.name }}
              </dd>
            </div>
            <div class="task-detail-item">
              <dt class="task-detail-label">Статус</dt>
              <dd class="task-detail-value">
                <select
                  :value="selectedTask.status"
                  class="task-detail-status-select"
                  @change="(e) => selectedTask && updateTaskStatus(selectedTask.id, (e.target as HTMLSelectElement).value as Status)"
                >
                  <option v-for="col in statusColumns" :key="col.key" :value="col.key">{{ col.title }}</option>
                </select>
              </dd>
            </div>
            <div class="task-detail-item">
              <dt class="task-detail-label">Срок выполнения</dt>
              <dd class="task-detail-value" :class="{ 'task-detail-overdue': selectedTask.description === 'Просрочено' }">
                до {{ selectedTask.dueDate }}
                <span v-if="selectedTask.description === 'Просрочено'" class="task-overdue"> (Просрочено)</span>
              </dd>
            </div>
            <div class="task-detail-item">
              <dt class="task-detail-label">Локация</dt>
              <dd><span class="task-pill task-pill-field">{{ selectedTask.field }}</span></dd>
            </div>
          </dl>
          <div v-if="selectedTask.description" class="task-detail-desc-wrap">
            <span class="task-detail-label">Описание задачи</span>
            <div class="task-detail-desc">{{ selectedTask.description }}</div>
          </div>
          <div class="task-detail-actions">
            <button type="button" class="task-detail-btn task-detail-btn--edit" @click="openEdit">Редактировать</button>
            <button type="button" class="task-detail-btn task-detail-btn--delete" @click="deleteTask">Удалить</button>
            <button type="button" class="task-detail-btn task-detail-btn--close" @click="closeTask">Закрыть</button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.task-management-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.task-loading-hint {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.task-form-static-assignee {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--chip-bg);
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* Единая высота и стиль элементов шапки задач */
.task-header {
  --task-control-h: 38px;
  --task-control-radius: 10px;
  --task-control-fs: 0.875rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

.task-header-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-lg);
}

.task-header-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.task-filter-selects {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
}

.task-filter-select-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-filter-select-label {
  font-size: var(--task-control-fs);
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

.task-filter-select {
  height: var(--task-control-h);
  min-width: 140px;
  padding: 0 12px;
  border-radius: var(--task-control-radius);
  border: 1px solid var(--border-color);
  background: var(--bg-panel);
  color: var(--text-primary);
  font-size: var(--task-control-fs);
  font-weight: 500;
  cursor: pointer;
}

.task-filter-select:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.task-filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.task-filter-tab {
  height: var(--task-control-h);
  display: inline-flex;
  align-items: center;
  padding: 0 14px;
  border-radius: var(--task-control-radius);
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--task-control-fs);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.task-filter-tab--active {
  background: var(--accent-green);
  border-color: var(--accent-green);
  color: #fff;
}

[data-theme='dark'] .task-filter-tab--active {
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
}

.task-view-toggle {
  display: flex;
  height: var(--task-control-h);
  border-radius: var(--task-control-radius);
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: var(--bg-panel);
}

.task-view-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--task-control-fs);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.task-view-btn:first-child {
  border-right: 1px solid var(--border-color);
}

.task-view-btn--active {
  background: var(--accent-green);
  border-color: var(--accent-green);
  color: #fff;
}

[data-theme='dark'] .task-view-btn--active {
  background: var(--accent-green);
  color: #fff;
}

.task-btn-create {
  height: var(--task-control-h);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  border-radius: var(--task-control-radius);
  border: none;
  background: var(--accent-green);
  color: #fff;
  font-size: var(--task-control-fs);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}

.task-btn-create:hover {
  background: var(--accent-green-hover);
}

/* Kanban */
.task-kanban {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-lg);
  min-height: 400px;
}

.task-kanban-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}

.task-column-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-primary);
}

.task-column-underline {
  height: 2px;
  background: var(--agri-primary);
  opacity: 0.6;
  border-radius: 1px;
  margin-bottom: 4px;
}

.task-column-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  flex: 1;
  min-height: 120px;
}

.task-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: var(--space-md);
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  text-align: left;
}

.task-card:hover {
  box-shadow: var(--shadow-card);
  border-color: var(--agri-primary);
}

.task-card--dragging {
  opacity: 0.6;
  cursor: grabbing;
}

.task-kanban-column--drag-over .task-column-cards {
  background: var(--agri-light);
  border-radius: 12px;
  outline: 2px dashed var(--accent-green);
  outline-offset: 2px;
}

.task-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.task-card-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
}

.task-card-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--chip-bg);
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.task-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.task-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.task-pill-field {
  background: #5a7c5e;
  color: #fff;
}

.priority-high {
  background: #b85450;
  color: #fff;
}

.priority-medium {
  background: #b87a50;
  color: #fff;
}

.priority-low {
  background: #5a8a85;
  color: #fff;
}

.task-card-type {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.task-card-due {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.task-overdue {
  color: #b85450;
  font-weight: 600;
}

.task-column-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
  border: 2px dashed var(--border-color);
  border-radius: 12px;
  background: var(--bg-panel-hover);
  min-height: 200px;
}

.task-empty-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--chip-bg);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-md);
}

.task-empty-icon svg {
  width: 24px;
  height: 24px;
}

.task-empty-title {
  margin: 0 0 4px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.task-empty-desc {
  margin: 0 0 var(--space-md);
  font-size: 0.8125rem;
  color: var(--text-secondary);
  text-align: center;
  max-width: 220px;
}

.task-empty-btn {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid var(--accent-green);
  background: var(--bg-panel);
  color: var(--accent-green);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.task-empty-btn:hover {
  background: var(--agri-light);
  color: var(--accent-green-hover);
}

/* List */
.task-list-wrap {
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.task-list-table-wrapper {
  overflow-x: auto;
}

.task-list-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.task-list-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.task-list-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.task-list-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.task-list-row:hover td {
  background: var(--row-hover-bg);
}

.task-list-cell-title {
  font-weight: 500;
}

.task-list-cell-assignee {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-list-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--chip-bg);
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.task-cell-overdue {
  color: #b85450;
  font-weight: 500;
}

.task-overdue-icon {
  margin-right: 4px;
}

.task-status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.status-todo { background: #9ca3af; }
.status-in-progress { background: #3b82f6; }
.status-review { background: #b87a50; }
.status-done { background: #5a7c5e; }

/* Modals */
.task-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
  animation: taskFadeIn 0.2s ease;
}

@keyframes taskFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.task-modal {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
  max-width: 520px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  padding: var(--space-lg);
  border: 1px solid var(--border-color);
  animation: taskModalIn 0.25s ease;
}

@keyframes taskModalIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.task-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s ease, color 0.2s ease;
}

.task-modal-close:hover {
  background: var(--chip-bg);
  color: var(--text-primary);
}

.task-modal-title {
  margin: 0 0 var(--space-md);
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.task-form--compact .task-form-label {
  font-size: 0.6rem;
}

.task-form--compact .task-form-row > .task-form-label {
  margin-bottom: 4px;
}

.task-form--compact .task-form-field .task-form-label {
  margin-bottom: 0;
}

.task-form--compact .task-form-field {
  gap: 4px;
}

.task-form--compact .task-form-input,
.task-form--compact .task-form-select,
.task-form--compact .task-form-textarea {
  font-size: 0.8125rem;
  padding: 6px 10px;
  min-height: 32px;
}

.task-form--compact .task-form-select-wrap {
  min-height: 32px;
}

.task-form--compact .task-form-textarea {
  min-height: 60px;
}

.task-form--compact .task-form-row {
  margin-bottom: var(--space-sm);
}

.task-form--compact .task-form-row--two {
  gap: 16px;
}

.task-form--compact .task-form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.task-form--compact .task-form-priority-btn {
  font-size: 0.7rem;
  padding: 6px 8px;
}

.task-form-field {
  min-width: 0;
}

.task-form-row {
  margin-bottom: var(--space-md);
}

.task-form-row:last-of-type {
  margin-bottom: 0;
}

.task-form {
  width: 100%;
  box-sizing: border-box;
}

.task-form-row--two {
  display: grid;
  grid-template-columns: calc((100% - 16px) / 2) calc((100% - 16px) / 2);
  gap: 16px;
  width: 100%;
  box-sizing: border-box;
}

.task-form-row--two .task-form-field {
  min-width: 0;
  overflow: hidden;
  width: 100%;
}

.task-form-row--two .task-form-field .task-form-select,
.task-form-row--two .task-form-field .task-form-input {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  box-sizing: border-box;
}

.task-form-row--two .task-form-select-wrap {
  width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box;
}

.task-form-row--two .task-form-select-wrap .task-form-select {
  flex: 1 1 0%;
  min-width: 0;
}

.task-form-row--two .task-form-label {
  font-size: 0.6rem;
  min-height: 1.35em;
  line-height: 1.35;
  display: flex;
  align-items: flex-end;
}

.task-form-row--two .task-form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
}

.task-form-row--two .task-form-input,
.task-form-row--two .task-form-select {
  font-size: 0.8125rem;
  min-height: 32px;
  height: 32px;
  padding: 6px 10px;
  box-sizing: border-box;
}

.task-form-row--two .task-form-select-wrap {
  min-height: 32px;
  height: 32px;
  box-sizing: border-box;
}

.task-form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.task-form-field .task-form-label {
  margin-bottom: 0;
}

.task-form-label {
  display: block;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  margin-bottom: 4px;
  line-height: 1.3;
}

.task-form-input,
.task-form-select,
.task-form-textarea {
  width: 100%;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--chip-bg);
  color: var(--text-primary);
  font-size: 0.8125rem;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
  min-height: 32px;
}

.task-form-select {
  min-height: 32px;
}

.task-form-textarea {
  min-height: 64px;
  font-size: 0.8125rem;
}

.task-form-input--date {
  color: #4a6b4e;
}

.task-form-select-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.task-form-select-wrap .task-form-select {
  flex: 1;
  min-width: 0;
}

.task-form-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #5a7c5e;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.task-form-priority {
  display: flex;
  gap: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #b87a50;
}

.task-form-priority-btn {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background: var(--bg-panel);
  color: var(--text-primary);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.task-form-priority-btn--active {
  background: #b87a50;
  color: #fff;
}

.task-form-textarea {
  resize: vertical;
}

.task-form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  margin-top: var(--space-xl);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border-color);
}

.task-form-cancel {
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s ease;
}

.task-form-cancel:hover {
  color: var(--text-primary);
}

.task-form-submit {
  padding: 10px 20px;
  border-radius: 10px;
  border: none;
  background: var(--accent-green);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.task-form-submit:hover {
  background: var(--accent-green-hover);
}

.task-form-delete {
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--danger-red);
  font-size: 0.9375rem;
  cursor: pointer;
}

.task-form-actions--detail {
  justify-content: flex-start;
  gap: var(--space-sm);
}

.task-form-actions--detail .task-form-submit {
  margin-left: auto;
}

.task-detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-top: var(--space-lg);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border-color);
}

.task-detail-btn {
  padding: 10px 18px;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.task-detail-btn--edit {
  border: 1px solid var(--border-color);
  background: var(--chip-bg);
  color: var(--text-primary);
}

.task-detail-btn--edit:hover {
  background: var(--bg-panel-hover);
}

.task-detail-btn--delete {
  border: none;
  background: transparent;
  color: var(--danger-red);
}

.task-detail-btn--delete:hover {
  background: rgba(211, 60, 60, 0.1);
}

.task-detail-btn--close {
  border: none;
  background: var(--accent-green);
  color: #fff;
  margin-left: auto;
}

.task-detail-btn--close:hover {
  background: var(--accent-green-hover);
}

/* Detail modal */
.task-detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: var(--space-md);
}

.task-pill-status {
  color: #fff;
}

.task-pill-status.status-todo { background: #9ca3af; }
.task-pill-status.status-in-progress { background: #3b82f6; }
.task-pill-status.status-review { background: #b87a50; }
.task-pill-status.status-done { background: #5a7c5e; }

.task-detail-title {
  margin: 0 0 var(--space-md);
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.task-detail-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0 0 var(--space-md);
}

.task-detail-list dd {
  margin: 0;
  padding-left: 0;
}

.task-detail-item {
  margin: 0;
}

.task-detail-label {
  display: block;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.task-detail-value {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.task-detail-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #5a7c5e;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.task-detail-status-select {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--chip-bg);
  color: var(--text-primary);
  font-size: 0.8125rem;
  min-width: 160px;
  cursor: pointer;
}

.task-detail-overdue {
  color: #b85450;
}

.task-detail-desc-wrap {
  margin-bottom: var(--space-md);
}

.task-detail-desc-wrap .task-detail-label {
  margin-bottom: 6px;
}

.task-detail-desc {
  padding: var(--space-sm) var(--space-md);
  border-radius: 8px;
  background: var(--chip-bg);
  font-size: 0.8125rem;
  color: var(--text-primary);
  line-height: 1.4;
}

/* ——— Тёмная тема (Context7: опора на CSS-переменные и контраст) ——— */
[data-theme='dark'] .task-management-page {
  --task-input-bg: rgba(0, 0, 0, 0.35);
  --task-input-border: rgba(255, 255, 255, 0.2);
  --task-placeholder: rgba(255, 255, 255, 0.45);
}

[data-theme='dark'] .task-modal {
  background: #121f14;
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
}

[data-theme='dark'] .task-form-input,
[data-theme='dark'] .task-form-select,
[data-theme='dark'] .task-form-textarea,
[data-theme='dark'] .task-detail-status-select {
  background: var(--task-input-bg, var(--chip-bg));
  border-color: var(--task-input-border, var(--border-color));
  color: var(--text-primary);
}

[data-theme='dark'] .task-form-input::placeholder,
[data-theme='dark'] .task-form-textarea::placeholder {
  color: var(--task-placeholder, var(--text-secondary));
}

[data-theme='dark'] .task-form-input--date {
  color: #7aad7e;
}

[data-theme='dark'] .task-form-priority {
  border-color: var(--warning-orange);
}

[data-theme='dark'] .task-form-priority-btn {
  background: rgba(0, 0, 0, 0.25);
  color: var(--text-primary);
}

[data-theme='dark'] .task-form-priority-btn--active {
  background: #b87a50;
  color: #fff;
}

[data-theme='dark'] .task-filter-tab {
  color: rgba(255, 255, 255, 0.7);
}

[data-theme='dark'] .task-filter-tab:hover {
  color: var(--text-primary);
}

[data-theme='dark'] .task-view-toggle {
  background: rgba(0, 0, 0, 0.2);
  border-color: var(--border-color);
}

[data-theme='dark'] .task-view-btn {
  color: rgba(255, 255, 255, 0.65);
}

[data-theme='dark'] .task-view-btn--active {
  background: var(--accent-green);
  color: #fff;
}

[data-theme='dark'] .task-card {
  background: rgba(22, 38, 28, 0.7);
  border-color: rgba(255, 255, 255, 0.1);
}

[data-theme='dark'] .task-card:hover {
  border-color: var(--accent-green);
}

[data-theme='dark'] .task-card-avatar {
  background: rgba(104, 173, 51, 0.3);
  color: rgba(255, 255, 255, 0.9);
}

[data-theme='dark'] .task-column-empty {
  background: rgba(0, 0, 0, 0.2);
  border-color: var(--border-color);
}

[data-theme='dark'] .task-empty-btn {
  background: transparent;
  border-color: var(--accent-green);
  color: var(--accent-green);
}

[data-theme='dark'] .task-empty-btn:hover {
  background: rgba(104, 173, 51, 0.2);
  color: var(--accent-green-hover);
}

[data-theme='dark'] .task-list-wrap {
  background: rgba(22, 38, 28, 0.6);
  border-color: rgba(255, 255, 255, 0.1);
}

[data-theme='dark'] .task-list-avatar {
  background: rgba(104, 173, 51, 0.3);
  color: rgba(255, 255, 255, 0.9);
}

[data-theme='dark'] .task-kanban-column--drag-over .task-column-cards {
  background: rgba(104, 173, 51, 0.15);
  outline-color: var(--accent-green);
}

[data-theme='dark'] .task-modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

[data-theme='dark'] .task-form-cancel:hover,
[data-theme='dark'] .task-form-delete:hover {
  color: var(--text-primary);
}

[data-theme='dark'] .task-form-delete:hover {
  color: var(--danger-red);
}

[data-theme='dark'] .task-detail-btn--edit {
  background: rgba(0, 0, 0, 0.35);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text-primary);
}

[data-theme='dark'] .task-detail-btn--edit:hover {
  background: rgba(255, 255, 255, 0.1);
}

@media (max-width: 1200px) {
  .task-kanban {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .task-kanban {
    grid-template-columns: 1fr;
  }

  .task-form-row--two {
    grid-template-columns: 1fr;
  }

  .task-header {
    flex-direction: column;
    align-items: stretch;
  }

  .task-header-left {
    flex-direction: column;
  }

  .task-filter-tabs {
    justify-content: stretch;
  }
}
</style>
