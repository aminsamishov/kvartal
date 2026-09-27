<script setup lang="ts">
import { fmtDateTime } from '~/utils/format'

// Обратный отсчёт брони. Пересчитывается раз в минуту — секундная точность
// здесь не нужна, а таймер на каждую карточку греет вкладку.
const props = defineProps<{ until: string; from?: string }>()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => (now.value = Date.now()), 60_000) })
onBeforeUnmount(() => clearInterval(timer))

const msLeft = computed(() => new Date(props.until).getTime() - now.value)
const expired = computed(() => msLeft.value <= 0)

const label = computed(() => {
  if (expired.value) return 'Срок истёк'
  const total = Math.floor(msLeft.value / 60000)
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const mins = total % 60
  if (days) return `${days} дн ${hours} ч`
  if (hours) return `${hours} ч ${mins} мин`
  return `${mins} мин`
})

const tone = computed(() => {
  if (expired.value) return 'bad'
  const hours = msLeft.value / 3600000
  return hours < 24 ? 'warn' : 'ok'
})

const percent = computed(() => {
  if (!props.from) return null
  const start = new Date(props.from).getTime()
  const end = new Date(props.until).getTime()
  if (end <= start) return 100
  return Math.min(100, Math.max(0, ((now.value - start) / (end - start)) * 100))
})

const TONE = {
  ok: { text: 'text-ok', bar: 'bg-fill-ok' },
  warn: { text: 'text-warn', bar: 'bg-board-warn' },
  bad: { text: 'text-bad', bar: 'bg-fill-bad' },
} as const
</script>

<template>
  <div>
    <p class="flex items-center gap-1.5 text-[12.5px] font-semibold" :class="TONE[tone].text">
      <Icon :name="expired ? 'ph:warning-circle' : 'ph:hourglass-medium'" size="14" />
      {{ expired ? label : `Осталось ${label}` }}
      <span class="ml-auto font-normal text-muted">до {{ fmtDateTime(until) }}</span>
    </p>
    <div v-if="percent !== null" class="mt-1.5 h-[5px] overflow-hidden rounded-full bg-soft">
      <span class="block h-full rounded-full transition-[width]" :class="TONE[tone].bar" :style="{ width: `${percent}%` }" />
    </div>
  </div>
</template>
