<script setup lang="ts">
/**
 * Каркас страницы на время первой загрузки данных. Повторяет типовую
 * раскладку разделов: шапка, полоса показателей, широкий блок и боковая
 * колонка — поэтому переход к настоящему содержимому не смещает взгляд.
 */
withDefaults(defineProps<{ kind?: 'dashboard' | 'board' | 'list' }>(), { kind: 'dashboard' })
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- шапка -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex flex-col gap-2">
        <AppSkeleton variant="title" width="220px" />
        <AppSkeleton width="320px" />
      </div>
      <div class="flex gap-2">
        <AppSkeleton height="40px" width="128px" rounded="rounded-xl2" />
        <AppSkeleton height="40px" width="150px" rounded="rounded-xl2" />
      </div>
    </div>

    <!-- показатели -->
    <div v-if="kind !== 'list'" class="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-5">
      <div v-for="i in 5" :key="i" class="flex flex-col gap-2.5 bg-panel p-4">
        <AppSkeleton width="90px" />
        <AppSkeleton variant="title" width="120px" />
        <AppSkeleton height="22px" />
      </div>
    </div>

    <!-- шахматка -->
    <template v-if="kind === 'board'">
      <div class="flex flex-wrap gap-2">
        <AppSkeleton height="34px" width="190px" rounded="rounded-xl2" />
        <AppSkeleton height="34px" width="110px" rounded="rounded-lg" />
        <AppSkeleton height="34px" width="110px" rounded="rounded-lg" />
        <AppSkeleton height="34px" width="110px" rounded="rounded-lg" />
      </div>
      <div class="rounded-card border border-line bg-panel p-4 shadow-card">
        <div class="flex gap-6">
          <div v-for="s in 2" :key="s" class="flex flex-col gap-1.5">
            <AppSkeleton height="34px" width="140px" />
            <div v-for="row in 8" :key="row" class="flex gap-1.5">
              <AppSkeleton v-for="c in 4" :key="c" height="58px" width="66px" rounded="rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- список -->
    <div v-else-if="kind === 'list'" class="overflow-hidden rounded-card border border-line bg-panel">
      <div v-for="i in 8" :key="i" class="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-0">
        <AppSkeleton variant="circle" />
        <AppSkeleton width="180px" />
        <AppSkeleton width="120px" />
        <AppSkeleton width="90px" class="ml-auto" />
      </div>
    </div>

    <!-- дашборд -->
    <template v-else>
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div class="rounded-card border border-line bg-panel p-5 shadow-card xl:col-span-2">
          <AppSkeleton variant="title" width="200px" />
          <div class="mt-4 flex items-end gap-2" style="height: 196px">
            <AppSkeleton
              v-for="i in 12" :key="i" class="flex-1" rounded="rounded-t-md"
              :height="`${30 + ((i * 37) % 60)}%`"
            />
          </div>
        </div>
        <div class="flex flex-col gap-3 rounded-card border border-line bg-panel p-5 shadow-card">
          <AppSkeleton variant="title" width="160px" />
          <div v-for="i in 5" :key="i" class="flex items-center gap-3">
            <AppSkeleton variant="circle" width="32px" height="32px" rounded="rounded-xl2" />
            <AppSkeleton />
            <AppSkeleton width="28px" />
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div v-for="i in 3" :key="i" class="flex flex-col gap-3 rounded-card border border-line bg-panel p-5 shadow-card">
          <AppSkeleton variant="title" width="150px" />
          <AppSkeleton v-for="r in 4" :key="r" height="18px" />
        </div>
      </div>
    </template>
  </div>
</template>
