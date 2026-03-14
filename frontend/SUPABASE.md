# Подключение Supabase к проекту

## 1. Создать проект на Supabase

1. Зайди на [supabase.com](https://supabase.com) и войди в аккаунт.
2. **New Project** → укажи имя, пароль БД, регион.
3. Дождись создания проекта.

## 2. Создать таблицы

1. В дашборде Supabase открой **SQL Editor**.
2. Нажми **New query**.
3. Скопируй содержимое файла `supabase/schema.sql` из корня репозитория и вставь в редактор.
4. Нажми **Run** — создадутся таблицы `downtimes` и `operations` и политики доступа.

## 3. Взять ключи API

1. В дашборде: **Project Settings** (иконка шестерёнки) → **API**.
2. Скопируй:
   - **Project URL** (например `https://xxxx.supabase.co`);
   - **anon public** ключ (длинная строка `eyJ...`).

## 4. Настроить фронтенд

1. В папке `frontend` создай файл `.env.local` (он не попадёт в git).
2. Добавь строки (подставь свои значения):

```
VITE_SUPABASE_URL=https://твой-проект.supabase.co
VITE_SUPABASE_ANON_KEY=твой_anon_ключ
```

3. Перезапусти dev-сервер (`npm run dev`).

## 5. Использование в коде

Клиент уже подключён в `src/lib/supabase.ts`:

- `supabase` — клиент (будет `null`, если переменные не заданы).
- `isSupabaseConfigured()` — проверка, настроен ли Supabase.

Пример запроса:

```ts
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

if (isSupabaseConfigured() && supabase) {
  const { data } = await supabase.from('downtimes').select('*').order('start_iso', { ascending: false })
  console.log(data)
}
```

Дальше можно постепенно переводить данные с localStorage на Supabase (отчёты, простои, операции).
