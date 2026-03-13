<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const operatorId = ref('AGRO-01')
const passcode = ref('')
const error = ref<string | null>(null)

function submit() {
  error.value = null
  if (!operatorId.value.trim() || !passcode.value.trim()) {
    error.value = 'Введите идентификатор и код доступа'
    return
  }
  router.push('/dashboard')
}
</script>

<template>
  <div style="min-height: 100vh; display: grid; place-items: center; padding: 24px">
    <div class="card" style="max-width: 420px; width: 100%">
      <h1 class="page-title" style="margin-bottom: 12px">Вход в систему</h1>
      <div style="display: grid; gap: 10px">
        <label style="display: grid; gap: 6px">
          <span style="color: var(--muted); font-size: 13px">Идентификатор оператора</span>
          <input v-model="operatorId" type="text" style="padding: 10px; border: 1px solid var(--border); border-radius: 10px" />
        </label>
        <label style="display: grid; gap: 6px">
          <span style="color: var(--muted); font-size: 13px">Код доступа</span>
          <input
            v-model="passcode"
            type="password"
            placeholder="Введите код"
            style="padding: 10px; border: 1px solid var(--border); border-radius: 10px"
          />
        </label>
        <div v-if="error" style="color: #9a3b3b; font-size: 13px">
          {{ error }}
        </div>
        <button
          type="button"
          @click="submit"
          style="padding: 10px 12px; background: var(--brand); color: white; border: 0; border-radius: 10px; cursor: pointer"
        >
          Войти
        </button>
      </div>
    </div>
  </div>
</template>

