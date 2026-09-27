<script setup lang="ts">
import type { ClientDocument, DocKind } from '~/types/models'
import { DOC_KINDS, DOC_KIND_META } from '~/utils/meta'
import { fmtDate } from '~/utils/format'
import { pickFiles } from '~/composables/useFileUpload'

/**
 * Data Room: файлы по категориям с превью на месте. Один компонент на заявку
 * и на клиента — хранилище у них общее (ClientDocument), и расходиться их
 * интерфейсам незачем.
 *
 * Загрузку наружу отдаём событием: кто владелец файла — заявка или клиент —
 * знает только вызывающая сторона.
 */
const props = withDefaults(defineProps<{
  documents: ClientDocument[]
  /** каких документов не хватает для сделки — подсказка, а не запрет */
  required?: DocKind[]
  /** сузить список категорий: в заявке их меньше, чем в досье клиента */
  kinds?: DocKind[]
  emptyHint?: string
}>(), {
  required: () => ['passport', 'contract'] as DocKind[],
  emptyHint: 'Документов нет — загрузите паспорт или договор',
})

const emit = defineEmits<{
  upload: [{ files: File[]; kind: DocKind }]
  remove: [string]
  'toggle-signed': [string]
  'set-kind': [{ id: string; kind: DocKind }]
}>()

const kinds = computed(() => props.kinds ?? DOC_KINDS)

const preview = ref<ClientDocument | null>(null)
const filter = ref<DocKind | ''>('')
const dropKind = ref<DocKind>('other')
const dragOver = ref(false)

const counts = computed(() => {
  const map = new Map<DocKind, number>()
  for (const d of props.documents) map.set(d.kind, (map.get(d.kind) ?? 0) + 1)
  return map
})

const groups = computed(() => kinds.value
  .filter((k) => !filter.value || filter.value === k)
  .map((kind) => ({ kind, meta: DOC_KIND_META[kind], items: props.documents.filter((d) => d.kind === kind) }))
  .filter((g) => g.items.length || filter.value === g.kind))

const missing = computed(() => props.required.filter((k) => !counts.value.get(k)))
const signedCount = computed(() => props.documents.filter((d) => d.signed).length)

function sizeLabel(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} МБ` : `${Math.round(bytes / 1024)} КБ`
}

async function choose(kind: DocKind) {
  const files = await pickFiles('image/*,application/pdf', true)
  if (files.length) emit('upload', { files, kind })
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) emit('upload', { files, kind: dropKind.value })
}
</script>

<template>
  <div>
    <!-- категории -->
    <div class="mb-3 flex flex-wrap gap-1.5">
      <Chip :pressed="filter === ''" @click="filter = ''">
        Все <span class="tabular opacity-70">{{ documents.length }}</span>
      </Chip>
      <Chip
        v-for="k in kinds" :key="k" :pressed="filter === k" :icon="DOC_KIND_META[k].icon"
        @click="filter = filter === k ? '' : k"
      >
        {{ DOC_KIND_META[k].label }}
        <span class="tabular opacity-70">{{ counts.get(k) ?? 0 }}</span>
      </Chip>
      <span class="ml-auto self-center text-[11.5px] text-muted">Подписано {{ signedCount }} из {{ documents.length }}</span>
    </div>

    <!-- зона загрузки -->
    <div
      class="mb-3 rounded-card border-2 border-dashed p-3 transition-colors"
      :class="dragOver ? 'border-plum bg-plum-soft/40' : 'border-line'"
      @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="onDrop"
    >
      <div class="flex flex-wrap items-center gap-2">
        <Icon name="ph:upload-simple" size="16" class="shrink-0 text-muted" />
        <p class="min-w-0 flex-1 text-[12px] text-muted">
          Перетащите файлы сюда — они лягут в категорию
          <select
            v-model="dropKind"
            class="focus-ring rounded-lg border border-line bg-panel px-1.5 py-0.5 text-[12px] font-semibold text-ink"
          >
            <option v-for="k in kinds" :key="k" :value="k">{{ DOC_KIND_META[k].label }}</option>
          </select>
        </p>
        <AppButton size="sm" icon="ph:folder-open" @click="choose(dropKind)">Выбрать файлы</AppButton>
      </div>
      <p v-if="missing.length" class="mt-2 flex items-center gap-1.5 text-[11.5px] text-warn">
        <Icon name="ph:warning-circle" size="13" />
        Для сделки не хватает: {{ missing.map((k) => DOC_KIND_META[k].label.toLowerCase()).join(', ') }}
      </p>
    </div>

    <!-- документы по категориям -->
    <div v-if="documents.length" class="flex flex-col gap-3.5">
      <section v-for="g in groups" :key="g.kind">
        <p class="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
          <Icon :name="g.meta.icon" size="12" /> {{ g.meta.label }}
          <span class="tabular text-muted/70">{{ g.items.length }}</span>
        </p>

        <div v-if="g.items.length" class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <article
            v-for="d in g.items" :key="d.id"
            class="group flex items-center gap-2.5 rounded-xl2 border border-line p-2 transition-colors hover:border-plum/40"
          >
            <button
              type="button" class="focus-ring h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-soft"
              title="Открыть превью" @click="preview = d"
            >
              <img v-if="d.mime.startsWith('image/')" :src="d.url" class="h-full w-full object-cover" :alt="d.name">
              <span v-else class="grid h-full w-full place-items-center text-muted"><Icon name="ph:file-pdf" size="18" /></span>
            </button>

            <div class="min-w-0 flex-1">
              <p class="truncate text-[12.5px] font-medium text-ink">{{ d.name }}</p>
              <p class="truncate text-[11px] text-muted">{{ sizeLabel(d.sizeBytes) }} · {{ fmtDate(d.uploadedAt) }} · {{ d.uploadedBy }}</p>
              <button
                type="button"
                class="focus-ring mt-1 rounded-full px-1.5 py-px text-[10.5px] font-semibold transition-colors"
                :class="d.signed ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'"
                :title="d.signed ? 'Отметить как неподписанный' : 'Отметить подписанным'"
                @click="emit('toggle-signed', d.id)"
              >
                <Icon :name="d.signed ? 'ph:check-circle' : 'ph:clock'" size="10" class="mr-0.5 inline" />
                {{ d.signed ? 'Подписан' : 'Не подписан' }}
              </button>
            </div>

            <div class="flex shrink-0 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <a :href="d.url" :download="d.name" class="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" title="Скачать">
                <Icon name="ph:download-simple" size="14" />
              </a>
              <button class="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-bad" title="Удалить" @click="emit('remove', d.id)">
                <Icon name="ph:trash" size="14" />
              </button>
            </div>
          </article>
        </div>

        <p v-else class="rounded-xl2 border border-dashed border-line px-3 py-2 text-[12px] text-muted">
          В этой категории пусто
        </p>
      </section>
    </div>

    <p v-else class="flex items-center gap-2 rounded-xl2 border border-dashed border-line px-3 py-2.5 text-[12.5px] text-muted">
      <Icon name="ph:paperclip" size="15" /> {{ emptyHint }}
    </p>

    <AppModal :model-value="!!preview" :title="preview?.name" width="xl" @update:model-value="preview = null">
      <FilePreview v-if="preview" :url="preview.url" :mime="preview.mime" :name="preview.name" height="min(72vh, 680px)" />
      <div v-if="preview" class="mt-3 flex flex-wrap items-center gap-2">
        <StatusTag :tone="preview.signed ? 'ok' : 'warn'" size="sm">{{ preview.signed ? 'Подписан' : 'Не подписан' }}</StatusTag>
        <span class="text-[12px] text-muted">{{ DOC_KIND_META[preview.kind].label }} · загрузил {{ preview.uploadedBy }} · {{ fmtDate(preview.uploadedAt) }}</span>
        <div class="ml-auto flex items-center gap-2">
          <select
            class="focus-ring rounded-lg border border-line bg-panel px-2 py-1.5 text-[12.5px] font-medium"
            :value="preview.kind"
            @change="emit('set-kind', { id: preview!.id, kind: ($event.target as HTMLSelectElement).value as DocKind })"
          >
            <option v-for="k in kinds" :key="k" :value="k">{{ DOC_KIND_META[k].label }}</option>
          </select>
          <AppButton size="sm" :icon="preview.signed ? 'ph:clock' : 'ph:check-bold'" @click="emit('toggle-signed', preview!.id)">
            {{ preview.signed ? 'Снять подпись' : 'Подписан' }}
          </AppButton>
          <a :href="preview.url" :download="preview.name"><AppButton size="sm" icon="ph:download-simple">Скачать</AppButton></a>
        </div>
      </div>
    </AppModal>
  </div>
</template>
