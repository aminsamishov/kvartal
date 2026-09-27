<script setup lang="ts">
import type { Unit } from '~/types/models'
import { fmtDate, fmtPhone } from '~/utils/format'

/**
 * Очередь интересантов на занятый объект. Без неё «занято» означает потерянный
 * спрос: квартиру хотели трое, бронь снялась, и об остальных никто не вспомнил.
 * Первый в очереди получает короткую бронь автоматически, как только объект
 * освобождается.
 */
const props = defineProps<{ unit: Unit }>()

const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const ui = useUiStore()

const queue = computed(() => unitsStore.queueFor(props.unit.id))
const autoTransfer = computed(() => settingsStore.reservationSettings.autoQueueTransfer)

// кто ещё смотрит эту квартиру, но в очереди не стоит — их и предлагаем добавить
const interested = computed(() => salesStore.leadsInterestedInUnit(props.unit.id)
  .filter((l) => l.stage !== 'lost' && !queue.value.some((q) => q.clientId === l.clientId))
  .map((l) => ({ lead: l, client: salesStore.client(l.clientId) }))
  .filter((x) => x.client))

const adding = ref(false)
const form = reactive({ name: '', phone: '' })

async function add() {
  if (!form.name.trim()) { ui.toast('Укажите имя', 'warn'); return }
  const phone = form.phone.replace(/\D/g, '')
  const client = salesStore.clients.find((c) => c.phone === phone)
  await unitsStore.addToQueue(props.unit.id, form.name.trim(), phone, client?.id ?? '')
  ui.toast('Добавлено в очередь', 'ok')
  form.name = ''
  form.phone = ''
  adding.value = false
}

async function addFromLead(clientId: string, name: string, phone: string) {
  await unitsStore.addToQueue(props.unit.id, name, phone, clientId)
  ui.toast(`${name} в очереди`, 'ok')
}

const author = computed(() => auth.user?.name ?? 'Система')

/**
 * Передать объект следующему вручную. Делает ровно то же, что автоматика при
 * истечении брони: оформляет короткую бронь без задатка, чтобы объект не
 * «повис» ни на ком.
 */
function offerNext() {
  const next = salesStore.offerUnitToQueue(props.unit.id, author.value)
  if (!next) { ui.toast('Очередь пуста', 'info'); return }
  ui.toast(next.clientId
    ? `№ ${props.unit.number} передана: ${next.name}, бронь на сутки`
    : `Предложено: ${next.name} — позвоните и оформите бронь`, 'ok')
}

/** Сколько человек ждёт и сколько дней ждёт первый — это и есть давление спроса. */
function waitingDays(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
}
</script>

<template>
  <div class="rounded-card border border-line p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
        <Icon name="ph:users-three" size="14" class="text-muted" />
        Очередь интересантов
        <StatusTag v-if="queue.length" tone="warn" size="sm">{{ queue.length }}</StatusTag>
      </p>
      <AppButton size="sm" :icon="adding ? 'ph:x' : 'ph:plus'" @click="adding = !adding">
        {{ adding ? 'Отмена' : 'Добавить' }}
      </AppButton>
    </div>

    <p class="mt-1.5 text-[11.5px] text-muted">
      <template v-if="autoTransfer">
        Как только бронь снимут или она истечёт, объект автоматически уйдёт первому в очереди на сутки.
      </template>
      <template v-else>
        Автопередача очереди выключена в настройках — предложить следующему нужно вручную.
      </template>
    </p>

    <div v-if="adding" class="mt-2.5 flex flex-col gap-2 rounded-xl2 border border-plum bg-plum-soft/40 p-2.5">
      <div class="grid grid-cols-2 gap-2">
        <AppInput v-model="form.name" label="Имя" placeholder="Имя Фамилия" />
        <AppInput v-model="form.phone" label="Телефон" placeholder="+996 700 000 000" />
      </div>
      <AppButton size="sm" variant="primary" icon="ph:check-bold" @click="add">В очередь</AppButton>

      <template v-if="interested.length">
        <p class="mt-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">Уже смотрят эту квартиру</p>
        <div class="flex flex-wrap gap-1.5">
          <Chip
            v-for="x in interested" :key="x.lead.id" icon="ph:user-plus"
            @click="addFromLead(x.client!.id, x.client!.name, x.client!.phone)"
          >{{ x.client!.name }}</Chip>
        </div>
      </template>
    </div>

    <ol v-if="queue.length" class="mt-2.5 flex flex-col gap-1.5">
      <li
        v-for="(q, i) in queue" :key="`${q.unitId}-${q.clientId}-${i}`"
        class="flex items-center gap-2 rounded-xl2 bg-soft px-2.5 py-1.5 text-[12.5px]"
      >
        <span
          class="tabular grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold"
          :class="i === 0 ? 'bg-fill-plum text-white' : 'bg-panel text-muted'"
        >{{ i + 1 }}</span>
        <span class="min-w-0 flex-1 truncate">
          {{ q.name }}
          <span class="text-muted">{{ q.phone ? fmtPhone(q.phone) : '' }}</span>
        </span>
        <span class="shrink-0 text-[11px] text-muted" :title="`В очереди с ${fmtDate(q.addedAt)}`">
          {{ waitingDays(q.addedAt) ? `ждёт ${waitingDays(q.addedAt)} дн.` : 'сегодня' }}
        </span>
        <a
          v-if="q.phone" :href="`tel:+${q.phone}`" class="shrink-0 text-muted hover:text-plum" title="Позвонить"
          @click.stop
        ><Icon name="ph:phone" size="13" /></a>
        <button class="shrink-0 text-muted hover:text-bad" title="Убрать из очереди" @click="unitsStore.removeFromQueue(unit.id, i)">
          <Icon name="ph:x" size="13" />
        </button>
      </li>
    </ol>

    <p v-else class="mt-2.5 text-[12px] text-muted">В очереди никого</p>

    <AppButton
      v-if="queue.length && unit.status !== 'free'" size="sm" icon="ph:hand-arrow-down" class="mt-2.5"
      @click="offerNext"
    >Предложить следующему сейчас</AppButton>
  </div>
</template>
