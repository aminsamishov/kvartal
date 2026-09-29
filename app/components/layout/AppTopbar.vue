<script setup lang="ts">
import { fmtDateTime } from '~/utils/format'

const route = useRoute()
const ui = useUiStore()
const auth = useAuthStore()
const misc = useMiscStore()
const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const dealsStore = useDealsStore()

const breadcrumb = computed(() => (route.meta.breadcrumb as { label: string; to?: string }[]) ?? [{ label: 'Дашборд' }])

const searchOpen = ref(false)
const searchQuery = ref('')
const searchRef = ref<HTMLElement | null>(null)
onClickOutside(searchRef, () => (searchOpen.value = false))

const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (q.length < 1) return { units: [], clients: [], contracts: [] }
  return {
    units: unitsStore.units.filter((u) => u.number.toLowerCase().includes(q)).slice(0, 5),
    clients: salesStore.clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 5),
    contracts: dealsStore.contracts.filter((c) => c.number.toLowerCase().includes(q)).slice(0, 5),
  }
})

const notifOpen = ref(false)
const notifRef = ref<HTMLElement | null>(null)
onClickOutside(notifRef, () => (notifOpen.value = false))

const userOpen = ref(false)
const userRef = ref<HTMLElement | null>(null)
onClickOutside(userRef, () => (userOpen.value = false))

const theme = useState<'light' | 'dark' | 'system'>('theme', () => 'system')
function setTheme(t: 'light' | 'dark' | 'system') {
  theme.value = t
  if (import.meta.client) {
    document.documentElement.dataset.theme = t === 'system' ? '' : t
    localStorage.setItem('inhouse.theme', t)
  }
}

function logout() {
  auth.logout()
  navigateTo('/login')
}
</script>

<template>
  <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur lg:px-7">
    <button class="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-xl2 border border-line bg-panel lg:hidden" @click="ui.mobileNavOpen = true">
      <Icon name="ph:list" size="18" />
    </button>

    <Breadcrumbs :items="breadcrumb" class="min-w-0 flex-1" />

    <ProjectSwitcher />

    <div ref="searchRef" class="relative hidden sm:block">
      <span class="relative flex items-center">
        <Icon name="ph:magnifying-glass" size="15" class="pointer-events-none absolute left-3 text-muted" />
        <input
          v-model="searchQuery"
          placeholder="Поиск: объект, клиент, договор…"
          class="focus-ring h-9 w-[240px] rounded-xl2 border border-line bg-panel pl-8 pr-3 text-[13px] transition-[width] focus:w-[320px]"
          @focus="searchOpen = true"
        >
      </span>
      <div
        v-if="searchOpen && searchQuery"
        class="absolute right-0 top-11 max-h-[70vh] w-[340px] overflow-auto rounded-card border border-line bg-panel py-2 shadow-panel"
      >
        <template v-if="searchResults.units.length || searchResults.clients.length || searchResults.contracts.length">
          <div v-if="searchResults.units.length">
            <p class="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted">Объекты</p>
            <NuxtLink v-for="u in searchResults.units" :key="u.id" :to="`/board?unit=${u.id}`" class="block px-3 py-2 text-[13px] hover:bg-soft" @click="searchOpen = false">
              № {{ u.number }} <span class="text-muted">· {{ u.area }} м²</span>
            </NuxtLink>
          </div>
          <div v-if="searchResults.clients.length">
            <p class="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted">Клиенты</p>
            <NuxtLink v-for="c in searchResults.clients" :key="c.id" to="/clients" class="block px-3 py-2 text-[13px] hover:bg-soft" @click="searchOpen = false">
              {{ c.name }} <span class="text-muted">· {{ c.phone }}</span>
            </NuxtLink>
          </div>
          <div v-if="searchResults.contracts.length">
            <p class="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted">Договоры</p>
            <NuxtLink v-for="c in searchResults.contracts" :key="c.id" :to="`/contracts/${c.id}`" class="block px-3 py-2 text-[13px] hover:bg-soft" @click="searchOpen = false">
              {{ c.number }}
            </NuxtLink>
          </div>
        </template>
        <p v-else class="px-3 py-4 text-center text-[13px] text-muted">Ничего не найдено</p>
      </div>
    </div>

    <div ref="notifRef" class="relative">
      <button class="focus-ring relative grid h-9 w-9 place-items-center rounded-xl2 border border-line bg-panel" @click="notifOpen = !notifOpen">
        <Icon name="ph:bell" size="17" />
        <span v-if="misc.unreadCount" class="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-fill-bad px-1 text-[9.5px] font-bold text-white">{{ misc.unreadCount }}</span>
      </button>
      <div v-if="notifOpen" class="absolute right-0 top-11 max-h-[70vh] w-[340px] overflow-auto rounded-card border border-line bg-panel shadow-panel">
        <div class="flex items-center justify-between border-b border-line px-3.5 py-2.5">
          <p class="text-[13px] font-semibold">Уведомления</p>
          <button class="text-[12px] font-medium text-plum hover:underline" @click="misc.markAllRead">Прочитать все</button>
        </div>
        <EmptyState v-if="!misc.notifications.length" compact icon="ph:bell-slash" title="Пока пусто" class="m-2" />
        <button
          v-for="n in misc.notifications" :key="n.id" type="button"
          class="flex w-full items-start gap-2.5 border-b border-line px-3.5 py-2.5 text-left last:border-0 hover:bg-soft"
          @click="misc.markRead(n.id)"
        >
          <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" :class="n.read ? 'bg-transparent' : 'bg-plum'" />
          <span class="min-w-0">
            <span class="block text-[13px] leading-snug" :class="n.read ? 'text-muted' : 'text-ink'">{{ n.text }}</span>
            <span class="mt-0.5 block text-[11.5px] text-muted">{{ fmtDateTime(n.at) }}</span>
          </span>
        </button>
      </div>
    </div>

    <button class="focus-ring grid h-9 w-9 place-items-center rounded-xl2 border border-line bg-panel" title="Тема" @click="setTheme(theme === 'dark' ? 'light' : 'dark')">
      <Icon :name="theme === 'dark' ? 'ph:moon-stars' : 'ph:sun'" size="17" />
    </button>

    <div ref="userRef" class="relative">
      <button class="focus-ring flex items-center gap-2 rounded-xl2 border border-line bg-panel py-1 pl-1 pr-2.5" @click="userOpen = !userOpen">
        <AppAvatar v-if="auth.user" :name="auth.user.name" :color="auth.user.avatarColor" size="sm" />
        <span class="hidden text-left leading-tight sm:block">
          <span class="block text-[12.5px] font-semibold">{{ auth.user?.name }}</span>
          <span class="block text-[11px] text-muted">{{ auth.roleLabel }}</span>
        </span>
        <Icon name="ph:caret-down" size="13" class="hidden text-muted sm:block" />
      </button>
      <div v-if="userOpen" class="absolute right-0 top-11 w-[220px] overflow-hidden rounded-card border border-line bg-panel py-1.5 shadow-panel">
        <NuxtLink to="/settings/account" class="flex items-center gap-2 px-3.5 py-2 text-[13px] hover:bg-soft" @click="userOpen = false">
          <Icon name="ph:gear-six" size="16" /> Настройки аккаунта
        </NuxtLink>
        <NuxtLink to="/users" class="flex items-center gap-2 px-3.5 py-2 text-[13px] hover:bg-soft" @click="userOpen = false">
          <Icon name="ph:users-three" size="16" /> Пользователи
        </NuxtLink>
        <button class="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] text-bad hover:bg-bad-bg" @click="logout">
          <Icon name="ph:sign-out" size="16" /> Выйти
        </button>
      </div>
    </div>
  </header>
</template>
