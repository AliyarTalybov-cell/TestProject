import { createRouter, createWebHistory } from 'vue-router'

import DashboardPage from '@/pages/DashboardPage.vue'
import FieldDetailsPage from '@/pages/FieldDetailsPage.vue'
import FieldsPage from '@/pages/FieldsPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import ReportsPage from '@/pages/ReportsPage.vue'
import TasksPage from '@/pages/TasksPage.vue'
import MechanicPage from '@/pages/MechanicPage.vue'
import WeatherPage from '@/pages/WeatherPage.vue'

export const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', name: 'login', component: LoginPage, meta: { title: 'Вход' } },
  { path: '/dashboard', name: 'dashboard', component: DashboardPage, meta: { title: 'Обзор' } },
  { path: '/weather', name: 'weather', component: WeatherPage, meta: { title: 'Погода и условия' } },
  { path: '/fields', name: 'fields', component: FieldsPage, meta: { title: 'Поля' } },
  { path: '/fields/:id', name: 'field-details', component: FieldDetailsPage, props: true, meta: { title: 'Поле' } },
  { path: '/tasks', name: 'tasks', component: TasksPage, meta: { title: 'Календарь' } },
  { path: '/mechanic', name: 'mechanic', component: MechanicPage, meta: { title: 'Экран оператора' } },
  { path: '/reports', name: 'reports', component: ReportsPage, meta: { title: 'Отчеты' } },
] as const

export const router = createRouter({
  history: createWebHistory(),
  routes: routes as unknown as any,
})

