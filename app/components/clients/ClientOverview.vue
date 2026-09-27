<script setup lang="ts">
import type { ClientProfile } from '~/utils/clientProfile'
import { buildClientSummary } from '~/utils/clientProfile'
import { CLIENT_ORIGIN_META, MARITAL_STATUS_META } from '~/utils/meta'
import { area as fmtArea, fmtDate, fmtPhone, money, moneyCompact, pluralRu } from '~/utils/format'

/**
 * Обзор клиента: слева досье, справа деньги. Руководителю нужно за пять
 * секунд понять, кто это и в каком он состоянии, — поэтому цифры и резюме
 * стоят выше любых списков.
 */
const props = defineProps<{ profile: ClientProfile }>()

const summary = computed(() => buildClientSummary(props.profile))
const c = computed(() => props.profile.client)
const t = computed(() => props.profile.totals)

const dossier = computed(() => {
  const client = c.value
  const p = props.profile
  return [
    ['Телефон', client.phone ? fmtPhone(client.phone) : '—'],
    ['WhatsApp', client.whatsapp ? fmtPhone(client.whatsapp) : '—'],
    ['Почта', client.email ?? '—'],
    [client.kind === 'company' ? 'ИНН организации' : 'ИНН', client.inn ?? '—'],
    ['Паспорт', client.passportMasked ?? '—'],
    ['Дата рождения', client.birthDate ? fmtDate(client.birthDate) : '—'],
    ['Адрес', client.address ?? '—'],
    ['Семейное положение', client.maritalStatus ? MARITAL_STATUS_META[client.maritalStatus] : '—'],
    ['Источник', client.source ?? '—'],
    ['Тип клиента', client.kind === 'company' ? 'Юридическое лицо' : 'Физическое лицо'],
    ['Менеджер', p.manager?.name ?? '—'],
    ['Первая заявка', p.firstLeadAt ? fmtDate(p.firstLeadAt) : '—'],
    ['Дата покупки', p.purchaseAt ? fmtDate(p.purchaseAt) : '—'],
  ] as [string, string][]
})

const analytics = computed(() => {
  const p = props.profile
  return [
    { label: 'Lifetime Value', value: money(p.totals.purchases), hint: `${p.contracts.length} ${pluralRu(p.contracts.length, 'договор', 'договора', 'договоров')}` },
    { label: 'Средний чек', value: money(p.totals.avgCheck), hint: 'на договор' },
    { label: 'Объектов', value: String(p.totals.unitsCount), hint: p.totals.area ? fmtArea(p.totals.area) : '—' },
    { label: 'Скидка за всё время', value: p.totals.discount ? money(p.totals.discount) : '—', hint: p.totals.purchases ? `${Math.round((p.totals.discount / (p.totals.purchases + p.totals.discount)) * 100)}% от суммы` : '' },
    { label: 'Просрочек за всё время', value: String(p.totals.overdueCount), hint: p.totals.overdueCount ? 'платежей мимо срока' : 'платит в срок' },
    { label: 'Последний контакт', value: p.lastActivityAt ? fmtDate(p.lastActivityAt) : '—', hint: p.lastActivityLabel },
  ]
})
</script>

<template>
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
    <!-- досье -->
    <div class="flex min-w-0 flex-col gap-4">
      <AppCard :padded="false">
        <div class="flex items-center justify-between gap-3 px-4 pt-4">
          <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Досье</h3>
          <StatusTag :tone="CLIENT_ORIGIN_META[c.origin].tone" size="sm">{{ CLIENT_ORIGIN_META[c.origin].label }}</StatusTag>
        </div>
        <div class="p-4">
          <dl class="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <div v-for="[label, value] in dossier" :key="label" class="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
              <dt class="shrink-0 text-[12px] text-muted">{{ label }}</dt>
              <dd class="truncate text-right text-[12.5px] font-medium text-ink" :title="value">{{ value }}</dd>
            </div>
          </dl>
          <p v-if="c.note" class="mt-3 rounded-xl2 bg-soft px-3 py-2 text-[12.5px] leading-snug text-ink">
            <Icon name="ph:note" size="13" class="mr-1 text-muted" />{{ c.note }}
          </p>
        </div>
      </AppCard>

      <!-- аналитика руководителя -->
      <AppCard title="Аналитика клиента" subtitle="Ценность за всё время работы">
        <div class="grid grid-cols-2 gap-px overflow-hidden rounded-xl2 border border-line bg-line sm:grid-cols-3">
          <div v-for="a in analytics" :key="a.label" class="bg-panel px-3 py-2.5">
            <p class="text-[11px] text-muted">{{ a.label }}</p>
            <p class="tabular mt-0.5 truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{{ a.value }}</p>
            <p v-if="a.hint" class="truncate text-[11px] text-muted">{{ a.hint }}</p>
          </div>
        </div>
      </AppCard>
    </div>

    <!-- деньги -->
    <div class="flex min-w-0 flex-col gap-4">
      <AppCard :padded="false">
        <div class="flex items-center justify-between gap-3 px-4 pt-4">
          <h3 class="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
            <Icon name="ph:sparkle" size="14" class="text-plum" /> Резюме
          </h3>
        </div>
        <div class="p-4">
          <p class="text-[13.5px] leading-relaxed text-ink">{{ summary }}</p>
        </div>
      </AppCard>

      <AppCard
        title="Деньги"
        :subtitle="`${profile.contracts.length} ${pluralRu(profile.contracts.length, 'договор', 'договора', 'договоров')} · ${t.unitsCount} ${pluralRu(t.unitsCount, 'объект', 'объекта', 'объектов')}`"
      >
        <p class="tabular text-[26px] font-semibold leading-none tracking-[-0.03em] text-ink">{{ money(t.purchases) }}</p>
        <p class="mt-1 text-[12px] text-muted">общий объём покупок</p>

        <div class="mt-3">
          <div class="flex items-center justify-between text-[11.5px] text-muted">
            <span>Оплачено {{ money(t.paid) }}</span>
            <span class="tabular font-semibold text-ink">{{ t.paidPct }}%</span>
          </div>
          <ProgressBar :percent="t.paidPct" tone="ok" :show-label="false" class="mt-1" />
        </div>

        <dl class="mt-3">
          <div v-for="row in [
            ['Оплачено', money(t.paid)],
            ['Остаток', t.remaining ? money(t.remaining) : '—'],
            ['Объектов', `${t.unitsCount}${t.area ? ` · ${fmtArea(t.area)}` : ''}`],
          ]" :key="row[0]" class="flex items-baseline justify-between gap-3 border-b border-line py-1.5"
          >
            <dt class="text-[12px] text-muted">{{ row[0] }}</dt>
            <dd class="tabular text-[13px] font-semibold text-ink">{{ row[1] }}</dd>
          </div>
        </dl>

        <p v-if="t.overdueAmount" class="mt-3 flex items-center gap-1.5 rounded-xl2 bg-bad-bg px-2.5 py-2 text-[12px] font-medium text-bad">
          <Icon name="ph:warning-circle" size="14" /> Просрочка {{ money(t.overdueAmount) }} · {{ t.overdueDays }} дн.
        </p>
        <p v-else-if="t.nextDue" class="mt-3 flex items-center gap-1.5 rounded-xl2 bg-soft px-2.5 py-2 text-[12px] text-muted">
          <Icon name="ph:calendar-dot" size="14" />
          Ближайший платёж {{ fmtDate(t.nextDue.dueDate) }} — <b class="tabular text-ink">{{ money(t.nextDue.remaining) }}</b>
        </p>
        <p v-else-if="profile.contracts.length" class="mt-3 flex items-center gap-1.5 rounded-xl2 bg-ok-bg px-2.5 py-2 text-[12px] font-medium text-ok">
          <Icon name="ph:check-circle" size="14" /> Все платежи по графику закрыты
        </p>
      </AppCard>

      <AppCard
        v-if="profile.projects.length" title="Где купил"
        :subtitle="`${profile.projects.length} ${pluralRu(profile.projects.length, 'проект', 'проекта', 'проектов')}`"
      >
        <div class="flex flex-col gap-2">
          <div v-for="pr in profile.projects" :key="pr.id" class="flex items-center gap-2.5">
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: pr.accent }" />
            <span class="min-w-0 flex-1 truncate text-[12.5px] text-ink">{{ pr.name }}</span>
            <span class="tabular shrink-0 text-[12px] text-muted">
              {{ profile.units.filter((u) => u.projectId === pr.id).length }} об. ·
              {{ moneyCompact(profile.units.filter((u) => u.projectId === pr.id).reduce((s, u) => s + u.price, 0)) }}
            </span>
          </div>
        </div>
      </AppCard>
    </div>
  </div>
</template>
