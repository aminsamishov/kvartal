<script setup lang="ts">
import type { ExplicationRoom, ImageZone } from '~/types/models'
import { ROOM_GROUPS, ROOM_GROUP_META, ROOM_GROUP_OF, ROOM_KIND_META, explicationTotals, roomColor, roomLabel } from '~/utils/explication'
import { area as fmtArea } from '~/utils/format'
import type { ZoneOption } from '~/components/units/ImageZoneEditor.vue'

// Разметка комнат на изображении планировки. Привязка идёт к строкам
// экспликации, а не к свободному тексту: подпись, тип и площадь области
// берутся из ведомости, поэтому план и таблица не могут разойтись.
const props = withDefaults(defineProps<{
  imageUrl: string
  rooms: ExplicationRoom[]
  zones: ImageZone[]
  readonly?: boolean
}>(), { readonly: false })

const emit = defineEmits<{ 'update:zones': [ImageZone[]] }>()

const options = computed<ZoneOption[]>(() => props.rooms.map((r) => ({
  value: r.id,
  // на плане подпись сразу с площадью — так читают настоящие экспликации
  label: r.area > 0 ? `${roomLabel(r)} · ${fmtArea(r.area)}` : roomLabel(r),
  color: roomColor(r.kind),
  hint: ROOM_KIND_META[r.kind].label,
})))

const marked = computed(() => new Set(props.zones.map((z) => z.refId)))
const totals = computed(() => explicationTotals(props.rooms))
const markedArea = computed(() => explicationTotals(props.rooms.filter((r) => marked.value.has(r.id))).raw)

// какие группы реально есть в этой экспликации — легенду не раздуваем
const usedGroups = computed(() => {
  const used = new Set(props.rooms.map((r) => ROOM_GROUP_OF[r.kind]))
  return ROOM_GROUPS.filter((g) => used.has(g))
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="!rooms.length" class="rounded-xl2 border border-warn bg-warn-bg px-3 py-2.5 text-[12.5px] text-warn">
      <p class="flex items-center gap-1.5 font-semibold"><Icon name="ph:warning" size="14" /> Экспликация пуста</p>
      <p class="mt-0.5">Сначала заполните ведомость комнат — области на плане привязываются к её строкам.</p>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl2 border border-line bg-soft px-3 py-2">
        <p class="text-[12.5px] text-muted">
          Размечено <b class="tabular text-ink">{{ marked.size }}</b> из {{ rooms.length }} комнат ·
          <b class="tabular text-ink">{{ markedArea }}</b> из {{ totals.raw }} м²
        </p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span v-for="g in usedGroups" :key="g" class="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span class="h-2.5 w-2.5 rounded-sm" :style="{ background: ROOM_GROUP_META[g].color }" />
            {{ ROOM_GROUP_META[g].label }}
          </span>
        </div>
      </div>

      <ImageZoneEditor
        :image-url="imageUrl" :zones="zones" :options="options" :readonly="readonly" entity-label="комната"
        empty-options-hint="Все комнаты экспликации размечены — выберите комнату в списке, чтобы перерисовать"
        @update:zones="emit('update:zones', $event)"
      />
    </template>
  </div>
</template>
