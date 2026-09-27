<script setup lang="ts">
import type { Unit } from '~/types/models'
import { UNIT_STATUS_META, RESERVATION_KIND_META, PAYMENT_KIND_META } from '~/utils/meta'
import { fmtDateTime, money } from '~/utils/format'

/**
 * Активность помещения: цена, статусы, брони, договор и платежи одной лентой.
 * Раньше ответ на «что вообще с этой квартирой происходило» собирался по трём
 * экранам, а спрашивают его при каждом споре с клиентом.
 */
const props = defineProps<{ unit: Unit }>()

const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const dealsStore = useDealsStore()

interface Row {
  id: string
  at: string
  icon: string
  title: string
  detail?: string
  author?: string
  tone: 'ok' | 'warn' | 'bad' | 'neutral'
}

const rows = computed<Row[]>(() => {
  const out: Row[] = []

  for (const h of unitsStore.historyFor(props.unit.id)) {
    if (h.kind === 'price') {
      out.push({
        id: h.id, at: h.at, icon: 'ph:tag', tone: Number(h.to) > Number(h.from) ? 'warn' : 'ok',
        title: `Цена: ${money(Number(h.from ?? 0))} → ${money(Number(h.to ?? 0))}`,
        detail: h.note, author: h.author,
      })
      continue
    }
    if (h.kind === 'status') {
      const to = h.to as keyof typeof UNIT_STATUS_META | undefined
      out.push({
        id: h.id, at: h.at, icon: 'ph:flag', tone: 'neutral',
        title: `Статус: ${to ? UNIT_STATUS_META[to]?.label ?? to : '—'}`,
        detail: h.note, author: h.author,
      })
      continue
    }
    out.push({ id: h.id, at: h.at, icon: 'ph:clock-counter-clockwise', tone: 'neutral', title: h.note ?? h.kind, author: h.author })
  }

  for (const r of salesStore.reservations.filter((x) => x.unitId === props.unit.id)) {
    const client = salesStore.client(r.clientId)
    out.push({
      id: `res-${r.id}`, at: r.createdAt, icon: 'ph:bookmark-simple',
      tone: r.status === 'converted' ? 'ok' : r.status === 'active' ? 'warn' : 'bad',
      title: `Бронь · ${RESERVATION_KIND_META[r.kind].label}`,
      detail: `${client?.name ?? 'клиент'}${r.deposit ? ` · задаток ${money(r.deposit, 'KGS')}` : ''}`,
      author: r.createdBy,
    })
    if (r.status === 'expired') {
      out.push({ id: `res-exp-${r.id}`, at: r.expiresAt, icon: 'ph:hourglass', tone: 'bad', title: 'Бронь истекла', detail: client?.name })
    }
  }

  const contract = props.unit.contractId ? dealsStore.contract(props.unit.contractId) : undefined
  if (contract) {
    out.push({
      id: `ct-${contract.id}`, at: contract.signedAt ?? contract.createdAt, icon: 'ph:file-text', tone: 'ok',
      title: `Договор ${contract.number}`,
      detail: `${salesStore.client(contract.clientId)?.name ?? ''} · ${money(contract.price, contract.currency)}`,
    })
    for (const p of dealsStore.payments.filter((x) => x.contractId === contract.id)) {
      out.push({
        id: `pay-${p.id}`, at: p.date, icon: 'ph:hand-coins',
        tone: p.status === 'confirmed' ? 'ok' : p.status === 'pending' ? 'warn' : 'bad',
        title: `Платёж ${money(p.amount, p.currency)}`,
        detail: PAYMENT_KIND_META[p.kind],
      })
    }
  }

  return out.sort((a, b) => b.at.localeCompare(a.at))
})

const TONE: Record<Row['tone'], string> = {
  ok: 'bg-ok-bg text-ok', warn: 'bg-warn-bg text-warn', bad: 'bg-bad-bg text-bad', neutral: 'bg-soft text-muted',
}
</script>

<template>
  <div v-if="rows.length" class="flex flex-col">
    <div v-for="r in rows" :key="r.id" class="flex items-start gap-2.5 border-b border-line py-2.5 last:border-0">
      <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg" :class="TONE[r.tone]">
        <Icon :name="r.icon" size="14" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-[12.5px] font-medium leading-snug text-ink">{{ r.title }}</p>
        <p v-if="r.detail" class="truncate text-[11.5px] text-muted">{{ r.detail }}</p>
      </div>
      <div class="shrink-0 text-right">
        <p class="tabular text-[11.5px] text-muted">{{ fmtDateTime(r.at) }}</p>
        <p v-if="r.author" class="truncate text-[11px] text-muted">{{ r.author }}</p>
      </div>
    </div>
  </div>
  <EmptyState v-else compact icon="ph:clock-counter-clockwise" title="История пуста" text="Здесь появятся смены цены, статуса, брони и платежи" />
</template>
