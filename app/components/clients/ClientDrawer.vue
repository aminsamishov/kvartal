<script setup lang="ts">
import type { ClientProfile } from '~/utils/clientProfile'
import { CLIENT_STATUS_META } from '~/utils/clientProfile'
import { fmtDate, fmtPhone, money, moneyCompact } from '~/utils/format'

/**
 * Карточка покупателя. Широкий дровер, а не модал: клиент — это договоры,
 * график и документы, и всё это нужно смотреть рядом, не теряя список.
 */
const props = defineProps<{ profile: ClientProfile | null }>()
const emit = defineEmits<{ close: []; 'open-unit': [string] }>()

const misc = useMiscStore()
const settingsStore = useSettingsStore()
const auth = useAuthStore()
const ui = useUiStore()

const open = computed({ get: () => !!props.profile, set: (v) => { if (!v) emit('close') } })

type Tab = 'overview' | 'units' | 'finance' | 'contracts' | 'docs' | 'history'
const tab = ref<Tab>('overview')
watch(() => props.profile?.client.id, () => { tab.value = 'overview' })

const tabs = computed(() => {
  const p = props.profile
  return [
    { value: 'overview', label: 'Обзор', icon: 'ph:squares-four' },
    { value: 'units', label: 'Объекты', icon: 'ph:door', count: p?.units.length || undefined },
    { value: 'finance', label: 'Финансы', icon: 'ph:wallet' },
    { value: 'contracts', label: 'Договоры', icon: 'ph:file-text', count: p?.contracts.length || undefined },
    { value: 'docs', label: 'Документы', icon: 'ph:folders', count: p?.documents.length || undefined },
    { value: 'history', label: 'История', icon: 'ph:clock-counter-clockwise' },
  ]
})

const client = computed(() => props.profile?.client)
const totals = computed(() => props.profile?.totals)

/* ------------------------------ быстрые действия -------------------------- */

const financeRef = ref<{ openPay: () => void } | null>(null)

function call() {
  if (!client.value?.phone) return
  if (import.meta.client) window.open(`tel:+${client.value.phone}`, '_self')
}
function whatsapp() {
  const number = client.value?.whatsapp || client.value?.phone
  if (!number) return
  if (import.meta.client) window.open(`https://wa.me/${number}`, '_blank')
}
function addPayment() {
  tab.value = 'finance'
  nextTick(() => financeRef.value?.openPay())
}
function openFirstUnit() {
  const unit = props.profile?.units[0]
  if (!unit) { ui.toast('У клиента нет купленных помещений', 'info'); return }
  emit('open-unit', unit.id)
}

/* --------------------------------- документ ------------------------------- */

const docOpen = ref(false)
const templateId = ref('')
const templates = computed(() => settingsStore.docTemplates.filter((t) => t.active))
watchEffect(() => { if (!templateId.value && templates.value[0]) templateId.value = templates.value[0].id })

function createDocument() {
  const template = templates.value.find((t) => t.id === templateId.value)
  if (!template || !props.profile) return
  misc.generateDocument({
    templateName: template.name,
    process: template.process,
    contractNumber: props.profile.contracts[0]?.number,
    clientName: props.profile.client.name,
    createdBy: auth.user?.name ?? 'Система',
  })
  ui.toast(`«${template.name}» сформирован`, 'ok')
  docOpen.value = false
}

/* ----------------------------------- печать -------------------------------- */

const printing = ref(false)

/**
 * Печать досье. Готовим страницу к печати и снимаем подготовку по событию
 * afterprint: оставлять класс на body нельзя — он прячет интерфейс.
 */
async function printDossier() {
  if (!import.meta.client || !props.profile) return
  printing.value = true
  await nextTick()
  const done = () => {
    printing.value = false
    document.body.classList.remove('print-host')
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  document.body.classList.add('print-host')
  window.print()
  // Safari и часть браузеров не шлют afterprint — подстраховываемся таймером
  setTimeout(() => { if (printing.value) done() }, 4000)
}

onBeforeUnmount(() => document.body.classList.remove('print-host'))
</script>

<template>
  <AppDrawer v-model="open" width="min(1200px, 100vw)">
    <template v-if="profile && client && totals">
      <!-- шапка: кто это, сколько денег и что можно сделать -->
      <div class="sticky -top-4 z-20 -mx-5 -mt-4 mb-4 bg-panel">
        <header class="border-b border-line px-5 pb-3 pt-4">
          <div class="flex flex-wrap items-start gap-3">
            <AppAvatar :name="client.name" size="lg" :color="profile.manager?.avatarColor" />

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">{{ client.name }}</h2>
                <StatusTag :tone="CLIENT_STATUS_META[profile.status].tone" size="sm" dot>
                  {{ CLIENT_STATUS_META[profile.status].label }}
                </StatusTag>
                <StatusTag v-if="client.vip" tone="warn" size="sm" icon="ph:star-fill">VIP</StatusTag>
                <StatusTag v-if="totals.overdueAmount" tone="bad" size="sm" icon="ph:warning-circle">
                  Просрочка {{ totals.overdueDays }} дн.
                </StatusTag>
              </div>

              <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted">
                <a v-if="client.phone" :href="`tel:+${client.phone}`" class="flex items-center gap-1 hover:text-plum">
                  <Icon name="ph:phone" size="12" /> {{ fmtPhone(client.phone) }}
                </a>
                <a v-if="client.email" :href="`mailto:${client.email}`" class="flex items-center gap-1 hover:text-plum">
                  <Icon name="ph:envelope-simple" size="12" /> {{ client.email }}
                </a>
                <span v-if="profile.manager" class="flex items-center gap-1">
                  <Icon name="ph:user" size="12" /> {{ profile.manager.name }}
                </span>
                <span v-if="profile.purchaseAt" class="flex items-center gap-1">
                  <Icon name="ph:calendar-check" size="12" /> покупка {{ fmtDate(profile.purchaseAt) }}
                </span>
              </div>
            </div>

            <!-- деньги в шапке: главный вопрос про клиента -->
            <div class="flex shrink-0 gap-px overflow-hidden rounded-xl2 border border-line bg-line">
              <div class="bg-panel px-3 py-1.5 text-right">
                <p class="tabular text-[15px] font-semibold leading-none text-ink">{{ moneyCompact(totals.purchases) }}</p>
                <p class="text-[10.5px] text-muted">куплено</p>
              </div>
              <div class="bg-panel px-3 py-1.5 text-right">
                <p class="tabular text-[15px] font-semibold leading-none text-ok">{{ moneyCompact(totals.paid) }}</p>
                <p class="text-[10.5px] text-muted">оплачено</p>
              </div>
              <div class="bg-panel px-3 py-1.5 text-right">
                <p class="tabular text-[15px] font-semibold leading-none" :class="totals.overdueAmount ? 'text-bad' : 'text-ink'">
                  {{ totals.remaining ? moneyCompact(totals.remaining) : '—' }}
                </p>
                <p class="text-[10.5px] text-muted">остаток</p>
              </div>
            </div>
          </div>

          <!-- быстрые действия -->
          <div class="mt-3 flex flex-wrap gap-1.5">
            <AppButton size="sm" icon="ph:phone" :disabled="!client.phone" @click="call">Позвонить</AppButton>
            <AppButton size="sm" icon="ph:whatsapp-logo" :disabled="!client.phone && !client.whatsapp" @click="whatsapp">WhatsApp</AppButton>
            <AppButton size="sm" icon="ph:file-plus" @click="docOpen = true">Создать документ</AppButton>
            <AppButton size="sm" icon="ph:hand-coins" :disabled="!profile.contracts.length" @click="addPayment">Добавить оплату</AppButton>
            <AppButton size="sm" icon="ph:door-open" :disabled="!profile.units.length" @click="openFirstUnit">Открыть квартиру</AppButton>
            <AppButton size="sm" icon="ph:printer" :loading="printing" @click="printDossier">Досье PDF</AppButton>
          </div>
        </header>

        <div class="px-5">
          <Tabs :model-value="tab" :tabs="tabs" @update:model-value="tab = $event as Tab" />
        </div>
      </div>

      <ClientOverview v-if="tab === 'overview'" :profile="profile" />
      <ClientUnits v-else-if="tab === 'units'" :profile="profile" @open="emit('open-unit', $event)" />
      <ClientFinance v-else-if="tab === 'finance'" ref="financeRef" :profile="profile" />
      <ClientContracts v-else-if="tab === 'contracts'" :profile="profile" />
      <ClientDocuments v-else-if="tab === 'docs'" :profile="profile" />
      <ClientTimeline v-else :profile="profile" />

      <!-- формирование документа из шаблона -->
      <AppModal v-model="docOpen" title="Создать документ" width="sm">
        <div class="flex flex-col gap-3.5">
          <AppSelect
            v-model="templateId" label="Шаблон"
            :options="templates.map((t) => ({ value: t.id, label: `${t.name} · ${t.process}` }))"
          />
          <p class="rounded-xl2 bg-soft px-3 py-2 text-[11.5px] text-muted">
            Документ соберётся по данным клиента и его договора
            <template v-if="profile.contracts[0]"> ({{ profile.contracts[0].number }})</template>
            и попадёт в раздел «Сформированные документы».
          </p>
          <div class="flex gap-2">
            <AppButton block @click="docOpen = false">Отмена</AppButton>
            <AppButton block variant="primary" icon="ph:check-bold" :disabled="!templates.length" @click="createDocument">Сформировать</AppButton>
          </div>
        </div>
      </AppModal>

      <!-- печатная версия: в обычном режиме скрыта стилями -->
      <Teleport to="body">
        <div v-if="printing" id="print-portal">
          <ClientDossier :profile="profile" />
        </div>
      </Teleport>
    </template>
  </AppDrawer>
</template>
