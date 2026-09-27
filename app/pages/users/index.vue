<script setup lang="ts">
import { ROLE_LABELS } from '~/data/catalog'
import type { UserRole } from '~/types/models'
import { fmtPhone } from '~/utils/format'

definePageMeta({ breadcrumb: [{ label: 'Пользователи' }, { label: 'Права доступа' }] })

const settingsStore = useSettingsStore()
const ui = useUiStore()

const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

const showCreate = ref(false)
const form = reactive({ name: '', phone: '', email: '', role: 'manager' as UserRole })
function createUser() {
  if (!form.name.trim()) return
  settingsStore.addUser({ name: form.name, phone: form.phone.replace(/\D/g, ''), email: form.email, role: form.role, projectIds: [], active: true })
  ui.toast('Пользователь добавлен', 'ok')
  showCreate.value = false
  form.name = ''; form.phone = ''; form.email = ''
}

const matrix = [
  { action: 'Шахматка, витрина', director: 'да', manager: 'да', accountant: 'да', lawyer: 'да', agent: 'без покупателей' },
  { action: 'Заявки', director: 'все', manager: 'свои и общие', accountant: 'нет', lawyer: 'нет', agent: 'только свои' },
  { action: 'Бронь', director: 'да', manager: 'да', accountant: 'нет', lawyer: 'нет', agent: 'да' },
  { action: 'Договор, КП', director: 'да', manager: 'да', accountant: 'нет', lawyer: 'нет', agent: 'нет' },
  { action: 'Скидка', director: 'без лимита', manager: 'до лимита', accountant: 'нет', lawyer: 'нет', agent: 'нет' },
  { action: 'Провести платёж', director: 'да', manager: 'на подтверждение', accountant: 'да', lawyer: 'нет', agent: 'нет' },
  { action: 'Реструктуризация', director: 'да', manager: 'нет', accountant: 'нет', lawyer: 'нет', agent: 'нет' },
  { action: 'Прайс, акции', director: 'да', manager: 'нет', accountant: 'нет', lawyer: 'нет', agent: 'нет' },
  { action: 'Паспорт открыто', director: 'да', manager: 'маска', accountant: 'да', lawyer: 'да', agent: 'нет' },
  { action: 'Журнал действий', director: 'да', manager: 'нет', accountant: 'да', lawyer: 'да', agent: 'нет' },
]
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-[22px] font-semibold tracking-[-0.025em]">Пользователи и права</h1>
        <p class="mt-1 text-[13px] text-muted">Права проверяет сервер при каждом запросе; доступ ограничен ещё и проектами</p>
      </div>
      <AppButton variant="primary" icon="ph:user-plus" @click="showCreate = true">Пригласить пользователя</AppButton>
    </div>

    <div class="overflow-x-auto rounded-card border border-line">
      <table class="data-table">
        <thead><tr><th>Сотрудник</th><th>Роль</th><th>Телефон</th><th>Email</th><th>Статус</th></tr></thead>
        <tbody>
          <tr v-for="u in settingsStore.users" :key="u.id">
            <td class="flex items-center gap-2 font-medium"><AppAvatar :name="u.name" :color="u.avatarColor" size="sm" /> {{ u.name }}</td>
            <td>{{ ROLE_LABELS[u.role] }}</td>
            <td class="tabular">{{ fmtPhone(u.phone) }}</td>
            <td class="text-muted">{{ u.email }}</td>
            <td>
              <button class="focus-ring" @click="settingsStore.toggleUserActive(u.id)">
                <StatusTag :tone="u.active ? 'ok' : 'neutral'" size="sm" dot>{{ u.active ? 'Активен' : 'Отключён' }}</StatusTag>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AppCard title="Матрица прав по ролям" subtitle="Справочно — для настройки под вашу структуру обратитесь к администратору">
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead><tr><th>Действие</th><th>Директор</th><th>Менеджер</th><th>Бухгалтер</th><th>Юрист</th><th>Агент</th></tr></thead>
          <tbody>
            <tr v-for="row in matrix" :key="row.action">
              <td class="font-medium">{{ row.action }}</td>
              <td class="text-muted">{{ row.director }}</td>
              <td class="text-muted">{{ row.manager }}</td>
              <td class="text-muted">{{ row.accountant }}</td>
              <td class="text-muted">{{ row.lawyer }}</td>
              <td class="text-muted">{{ row.agent }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>

    <AppModal v-model="showCreate" title="Новый пользователь">
      <div class="flex flex-col gap-3.5">
        <AppInput v-model="form.name" label="Имя Фамилия" />
        <AppInput v-model="form.phone" label="Телефон" placeholder="+996 700 000 000" />
        <AppInput v-model="form.email" label="Email" />
        <AppSelect v-model="form.role" label="Роль" :options="roleOptions" />
        <AppButton variant="primary" block @click="createUser">Пригласить</AppButton>
      </div>
    </AppModal>
  </div>
</template>
