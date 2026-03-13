<script setup lang="ts">
defineProps<{ id: string }>()
</script>

<template>
  <div>
    <h1 class="page-title">Детали поля</h1>
    <div class="card" style="display: grid; gap: 10px">
      <div><b>ID поля:</b> {{ id }}</div>
      <div style="color: var(--muted)">
        Заглушка: культура, история работ, задачи по полю, заметки и показатели (площадь/влажность/урожайность).
      </div>
    </div>
  </div>
</template>

