<script setup lang="ts">
/**
 * Отказ с причиной. Отдельный компонент, потому что в «Отказ» заявку уводят из
 * трёх мест — с доски перетаскиванием, из карточки и из повестки дня, — а
 * причина обязательна везде: без неё аналитика потерь пустая.
 */
const props = defineProps<{ leadId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const salesStore = useSalesStore()
const misc = useMiscStore()
const auth = useAuthStore()
const ui = useUiStore()

const REASONS = ['Не подошла цена', 'Купил в другом ЖК', 'Не одобрили ипотеку', 'Взял паузу', 'Не отвечает', 'Не устроили сроки']

const reason = ref('')
watch(() => props.leadId, () => { reason.value = '' })

function confirm() {
  if (!props.leadId) return
  const author = auth.user?.name ?? 'Система'
  salesStore.moveLead(props.leadId, 'lost', author, { lostReason: reason.value })
  misc.log('Заявки', `Отказ: ${reason.value || 'без причины'}`, author)
  ui.toast('Заявка переведена в «Отказ»', 'info')
  emit('close')
}
</script>

<template>
  <AppModal :model-value="!!leadId" title="Причина отказа" width="sm" @update:model-value="emit('close')">
    <p class="text-[12.5px] text-muted">Причина попадает в аналитику — по ней видно, что именно теряет продажи.</p>
    <div class="mt-3 flex flex-wrap gap-1.5">
      <button
        v-for="r in REASONS" :key="r" type="button"
        class="focus-ring rounded-full border px-2.5 py-1.5 text-[12px] font-medium transition-colors"
        :class="reason === r ? 'border-bad bg-bad-bg text-bad' : 'border-line text-muted hover:bg-soft hover:text-ink'"
        @click="reason = r"
      >{{ r }}</button>
    </div>
    <AppInput v-model="reason" class="mt-3" label="Или своя формулировка" placeholder="Например, переехал в другой город" />
    <div class="mt-4 flex gap-2">
      <AppButton block @click="emit('close')">Отмена</AppButton>
      <AppButton block variant="danger" icon="ph:prohibit" @click="confirm">В «Отказ»</AppButton>
    </div>
  </AppModal>
</template>
