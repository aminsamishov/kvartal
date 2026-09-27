<script setup lang="ts">
const unitsStore = useUnitsStore()
const ui = useUiStore()

const open = ref(false)
const ref_ = ref<HTMLElement | null>(null)
onClickOutside(ref_, () => (open.value = false))

const current = computed(() => unitsStore.project(ui.currentProjectId))

function select(id: string) {
  ui.setProject(id)
  open.value = false
}
</script>

<template>
  <div v-if="unitsStore.projects.length" ref="ref_" class="relative shrink-0">
    <button
      type="button"
      class="focus-ring flex items-center gap-2 rounded-xl2 border border-line bg-panel py-1.5 pl-2.5 pr-2 text-[13px] font-semibold"
      @click="open = !open"
    >
      <span class="h-2 w-2 rounded-full" :style="{ background: current?.accent }" />
      <span class="max-w-[140px] truncate">{{ current?.name ?? 'Проект' }}</span>
      <Icon name="ph:caret-down" size="13" class="text-muted" />
    </button>
    <div v-if="open" class="absolute left-0 top-10 w-[220px] overflow-hidden rounded-card border border-line bg-panel py-1.5 shadow-panel">
      <button
        v-for="p in unitsStore.projects" :key="p.id" type="button"
        class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-soft"
        @click="select(p.id)"
      >
        <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: p.accent }" />
        <span class="min-w-0 flex-1 truncate">{{ p.name }}</span>
        <Icon v-if="p.id === ui.currentProjectId" name="ph:check-bold" size="14" class="text-ok" />
      </button>
    </div>
  </div>
</template>
