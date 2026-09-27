<script setup lang="ts">
// Превью файла прямо в панели: менеджер не должен скачивать паспорт,
// чтобы убедиться, что загрузился нужный разворот.
const props = defineProps<{ url: string; mime: string; name: string; height?: string }>()

const kind = computed(() => {
  if (props.mime.startsWith('image/')) return 'image'
  if (props.mime === 'application/pdf') return 'pdf'
  return 'other'
})
</script>

<template>
  <div class="overflow-hidden rounded-xl2 border border-line bg-soft" :style="{ height: height ?? '420px' }">
    <img v-if="kind === 'image'" :src="url" :alt="name" class="h-full w-full object-contain">
    <object v-else-if="kind === 'pdf'" :data="url" type="application/pdf" class="h-full w-full">
      <div class="grid h-full place-items-center p-6 text-center">
        <div>
          <Icon name="ph:file-pdf" size="32" class="text-muted" />
          <p class="mt-2 text-[12.5px] text-muted">Браузер не показал PDF</p>
          <AppButton size="sm" class="mt-2" icon="ph:download-simple" @click="navigateTo(url, { external: true, open: { target: '_blank' } })">Открыть файл</AppButton>
        </div>
      </div>
    </object>
    <div v-else class="grid h-full place-items-center p-6 text-center">
      <div>
        <Icon name="ph:file" size="32" class="text-muted" />
        <p class="mt-2 text-[12.5px] text-muted">{{ name }}</p>
      </div>
    </div>
  </div>
</template>
