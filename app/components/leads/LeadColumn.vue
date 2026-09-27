<script setup lang="ts">
import type { Lead, LeadStage } from '~/types/models'
import { LEAD_STAGE_COLOR, LEAD_STAGE_ICON, LEAD_STAGE_META } from '~/utils/meta'
import { moneyCompact } from '~/utils/format'

const props = defineProps<{
  stage: LeadStage
  leads: Lead[]
  /** конверсия с предыдущего этапа, % */
  conversion?: number | null
}>()
const emit = defineEmits<{ drop: [{ leadId: string; stage: LeadStage }]; open: [string]; add: [LeadStage] }>()

const { draggingId, draggingFrom, overStage, end } = useLeadDnd()

const budget = computed(() => props.leads.reduce((s, l) => s + (l.budget || 0), 0))
const isTarget = computed(() => overStage.value === props.stage && draggingFrom.value !== props.stage)
const canDrop = computed(() => !!draggingId.value && draggingFrom.value !== props.stage)

function onDragOver(e: DragEvent) {
  if (!draggingId.value) return
  e.preventDefault()
  overStage.value = props.stage
}
function onDragLeave(e: DragEvent) {
  // dragleave стреляет и при переходе на дочерний элемент — сверяемся с тем,
  // куда реально ушёл курсор, иначе подсветка мигает на каждой карточке
  const next = e.relatedTarget as Node | null
  if (next && (e.currentTarget as HTMLElement).contains(next)) return
  if (overStage.value === props.stage) overStage.value = null
}
function onDrop() {
  const id = draggingId.value
  if (id && draggingFrom.value !== props.stage) emit('drop', { leadId: id, stage: props.stage })
  end()
}
</script>

<template>
  <section
    class="flex w-[272px] shrink-0 flex-col rounded-card border bg-bg/40 transition-colors"
    :class="isTarget ? 'border-plum bg-plum-soft/40' : canDrop ? 'border-dashed border-line' : 'border-line'"
    @dragover="onDragOver" @dragleave="onDragLeave" @drop.prevent="onDrop"
  >
    <!-- шапка этапа -->
    <header class="sticky top-0 z-10 rounded-t-card border-b border-line bg-panel px-3 py-2.5">
      <div class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ background: LEAD_STAGE_COLOR[stage] }" />
        <Icon :name="LEAD_STAGE_ICON[stage]" size="13" class="shrink-0 text-muted" />
        <h3 class="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{{ LEAD_STAGE_META[stage].label }}</h3>
        <span class="tabular rounded-full bg-soft px-1.5 py-0.5 text-[11px] font-semibold text-muted">{{ leads.length }}</span>
      </div>
      <div class="mt-1.5 flex items-center justify-between gap-2">
        <span class="tabular text-[12px] font-semibold text-ink">{{ budget ? moneyCompact(budget) : '—' }}</span>
        <span v-if="conversion !== null && conversion !== undefined" class="tabular text-[11px] text-muted" title="Конверсия с предыдущего этапа">
          {{ conversion }}%
        </span>
      </div>
      <!-- полоса-акцент этапа -->
      <div class="mt-2 h-[3px] overflow-hidden rounded-full bg-soft">
        <span class="block h-full rounded-full" :style="{ background: LEAD_STAGE_COLOR[stage], width: leads.length ? '100%' : '0%' }" />
      </div>
    </header>

    <!-- карточки -->
    <div class="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
      <LeadCard v-for="lead in leads" :key="lead.id" :lead="lead" @open="emit('open', $event)" />

      <div
        v-if="isTarget"
        class="grid h-16 place-items-center rounded-xl2 border-2 border-dashed border-plum bg-panel/60 text-[12px] font-semibold text-plum"
      >
        Перенести в «{{ LEAD_STAGE_META[stage].label }}»
      </div>

      <p v-else-if="!leads.length" class="grid h-16 place-items-center rounded-xl2 border border-dashed border-line text-[12px] text-muted">
        Пусто
      </p>

      <button
        v-if="stage === 'new'" type="button"
        class="focus-ring flex items-center justify-center gap-1.5 rounded-xl2 border border-dashed border-line py-2 text-[12px] font-medium text-muted transition-colors hover:border-plum hover:text-plum"
        @click="emit('add', stage)"
      >
        <Icon name="ph:plus" size="13" /> Добавить заявку
      </button>
    </div>
  </section>
</template>
