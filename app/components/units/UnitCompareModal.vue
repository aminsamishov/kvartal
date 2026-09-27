<script setup lang="ts">
import type { MatchedUnit } from '~/composables/useLeadMatching'

/**
 * Сравнение во весь экран. Быстрый взгляд живёт в панели снизу, а сюда
 * приходят, когда нужно разложить планировки крупно и обсудить их с клиентом.
 */
defineProps<{
  modelValue: boolean
  unitIds: string[]
  leadId?: string
  scores?: Map<string, MatchedUnit>
}>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; reserve: [string]; open: [string] }>()
</script>

<template>
  <AppModal :model-value="modelValue" title="Сравнение квартир" width="xl" @update:model-value="emit('update:modelValue', $event)">
    <UnitCompareTable
      :unit-ids="unitIds" :lead-id="leadId" :scores="scores"
      @open="emit('open', $event)"
      @reserve="emit('reserve', $event); emit('update:modelValue', false)"
    />
  </AppModal>
</template>
