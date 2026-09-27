<script setup lang="ts">
import type { MediaAsset } from '~/types/models'
import { fileKind, fileToObjectUrl, pickFiles } from '~/composables/useFileUpload'

const props = withDefaults(defineProps<{
  items: MediaAsset[]
  accept?: string
  allowVideo?: boolean
  emptyHint?: string
  addLabel?: string
}>(), { accept: 'image/*', allowVideo: false, addLabel: 'Загрузить' })

const emit = defineEmits<{ add: [{ url: string; name: string; kind: 'photo' | 'video' }]; remove: [string] }>()

async function upload() {
  const accept = props.allowVideo ? 'image/*,video/*' : props.accept
  const files = await pickFiles(accept, true)
  for (const file of files) {
    emit('add', { url: fileToObjectUrl(file), name: file.name, kind: fileKind(file) })
  }
}
</script>

<template>
  <div>
    <div v-if="items.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <div v-for="item in items" :key="item.id" class="group relative aspect-square overflow-hidden rounded-xl2 border border-line bg-soft">
        <video v-if="item.kind === 'video'" :src="item.url" class="h-full w-full object-cover" muted />
        <img v-else :src="item.url" :alt="item.name" class="h-full w-full object-cover">
        <span v-if="item.kind === 'video'" class="absolute bottom-1.5 left-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink/60 text-white">
          <Icon name="ph:play-fill" size="12" />
        </span>
        <button
          type="button" class="focus-ring absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-ink/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
          title="Удалить" @click="emit('remove', item.id)"
        >
          <Icon name="ph:trash" size="14" />
        </button>
      </div>
      <button
        type="button" class="focus-ring flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl2 border border-dashed border-line text-muted hover:border-plum hover:text-plum"
        @click="upload"
      >
        <Icon name="ph:plus" size="20" />
        <span class="text-[11.5px] font-medium">{{ addLabel }}</span>
      </button>
    </div>
    <EmptyState v-else compact icon="ph:image" :title="emptyHint ?? 'Материалы не загружены'">
      <template #action><AppButton size="sm" variant="primary" icon="ph:upload-simple" @click="upload">{{ addLabel }}</AppButton></template>
    </EmptyState>
  </div>
</template>
