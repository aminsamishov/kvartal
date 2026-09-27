<script setup lang="ts">
// Воронка: этапы упорядочены, поэтому цвет — порядковая шкала одного тона
// (чем ближе к сделке, тем темнее), а не набор произвольных оттенков.
// Между этапами показываем конверсию — то, ради чего воронку и смотрят.
// Ждём на входе накопительные значения («дошли до этапа»): по числу заявок,
// стоящих на этапе прямо сейчас, конверсия не считается — она вышла бы больше
// 100%, потому что снимок не обязан убывать.
export interface FunnelStage {
  key: string
  label: string
  count: number
}

const props = defineProps<{ stages: FunnelStage[]; to?: string }>()

const STEPS = ['var(--c-step-1)', 'var(--c-step-2)', 'var(--c-step-3)', 'var(--c-step-4)', 'var(--c-step-5)']
const max = computed(() => Math.max(1, ...props.stages.map((s) => s.count)))

function color(i: number) {
  // шкала из 5 шагов растягивается на фактическое число этапов
  const idx = props.stages.length <= 1 ? STEPS.length - 1 : Math.round((i / (props.stages.length - 1)) * (STEPS.length - 1))
  return STEPS[idx]
}
function conv(i: number) {
  const prev = props.stages[i - 1]?.count ?? 0
  const cur = props.stages[i]?.count ?? 0
  if (!prev) return null
  return Math.min(100, Math.round((cur / prev) * 100))
}
</script>

<template>
  <div class="flex flex-col">
    <div v-for="(s, i) in stages" :key="s.key">
      <!-- конверсия к предыдущему этапу -->
      <div v-if="i > 0" class="flex items-center gap-1.5 py-1 pl-[124px] text-[10.5px] text-muted">
        <Icon name="ph:arrow-down-right" size="11" />
        <span class="tabular">{{ conv(i) }}%</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="w-[112px] shrink-0 truncate text-[12.5px] font-medium text-muted">{{ s.label }}</span>
        <div class="min-w-0 flex-1">
          <span
            class="block h-5 rounded-r transition-[width]"
            :style="{ width: `${Math.max(s.count ? 3 : 0, (s.count / max) * 100)}%`, background: color(i) }"
          />
        </div>
        <span class="tabular w-8 shrink-0 text-right text-[13.5px] font-semibold text-ink">{{ s.count }}</span>
      </div>
    </div>
  </div>
</template>
