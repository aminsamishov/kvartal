<script setup lang="ts">
const props = defineProps<{ error: { statusCode?: number; message?: string } }>()
</script>

<template>
  <div class="grid min-h-screen place-items-center bg-bg px-4">
    <div class="text-center">
      <p class="text-[64px] font-bold tracking-[-0.04em] text-plum">{{ props.error.statusCode ?? 500 }}</p>
      <p class="mt-2 text-[15px] text-muted">{{ props.error.message ?? 'Что-то пошло не так' }}</p>
      <AppButton class="mt-5" variant="primary" @click="clearError({ redirect: '/' })">На главную</AppButton>
    </div>
  </div>
</template>
