<script setup lang="ts">
import type { Building, FacadeTag, FacadeView } from '~/types/models'
import { fileToObjectUrl, pickFiles } from '~/composables/useFileUpload'
import { FACADE_TAGS, FACADE_TAG_META } from '~/utils/meta'
import { zonePointsAttr } from '~/utils/zones'

const props = defineProps<{ building: Building }>()
const unitsStore = useUnitsStore()
const ui = useUiStore()

const MAX_MB = 5

async function pickImage(): Promise<string | null> {
  const [file] = await pickFiles('image/png,image/jpeg')
  if (!file) return null
  if (file.size > MAX_MB * 1024 * 1024) {
    ui.toast(`Файл больше ${MAX_MB} МБ — сожмите изображение`, 'warn')
    return null
  }
  return fileToObjectUrl(file)
}

async function addFacade() {
  const url = await pickImage()
  if (!url) return
  const view = unitsStore.addFacade(props.building.id, { name: `Ракурс ${props.building.facades.length + 1}`, imageUrl: url })
  ui.toast('Ракурс добавлен — осталось разметить этажи', 'ok')
  if (view) navigateTo(`/facades/${props.building.id}/${view.id}`)
}

function addEmpty() {
  unitsStore.addFacade(props.building.id, { name: `Ракурс ${props.building.facades.length + 1}` })
}

async function replaceImage(view: FacadeView) {
  const url = await pickImage()
  if (!url) return
  unitsStore.updateFacade(props.building.id, view.id, { imageUrl: url })
  ui.toast('Изображение обновлено', 'ok')
}

function removeImage(view: FacadeView) {
  unitsStore.updateFacade(props.building.id, view.id, { imageUrl: null })
}

function rename(view: FacadeView, name: string) {
  unitsStore.updateFacade(props.building.id, view.id, { name: name.trim() || view.name })
}

function setTag(view: FacadeView, tag: FacadeTag) {
  unitsStore.setFacadeTag(props.building.id, view.id, tag)
}

function togglePublish(view: FacadeView) {
  if (!view.imageUrl) {
    ui.toast('Нельзя опубликовать ракурс без изображения', 'warn')
    return
  }
  unitsStore.toggleFacadePublished(props.building.id, view.id)
  ui.toast(view.published ? 'Ракурс снят с публикации' : 'Ракурс опубликован', 'info')
}

const confirmRemove = ref<FacadeView | null>(null)
function doRemove() {
  if (!confirmRemove.value) return
  unitsStore.removeFacade(props.building.id, confirmRemove.value.id)
  ui.toast('Ракурс удалён', 'info')
  confirmRemove.value = null
}

const floorsMarked = (view: FacadeView) => new Set(view.zones.filter((z) => z.refId.startsWith('floor:')).map((z) => z.refId)).size
const unitsMarked = (view: FacadeView) => view.zones.filter((z) => z.refId.startsWith('unit:')).length
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-3 rounded-card border border-line bg-soft p-4">
      <div class="flex gap-3">
        <Icon name="ph:info" size="18" class="mt-0.5 shrink-0 text-muted" />
        <div class="text-[12.5px] leading-relaxed text-muted">
          <p>Оптимальный размер изображения <b class="text-ink">2200×1000</b> px, минимальный — 1100×900 px. Чтобы края не размывались, рекомендуем 2600×1000 px.</p>
          <p>Максимальный размер файла {{ MAX_MB }} МБ. Допустимые форматы — PNG, JPEG.</p>
        </div>
      </div>
      <div class="flex shrink-0 gap-2">
        <AppButton size="sm" icon="ph:plus" @click="addEmpty">Пустой ракурс</AppButton>
        <AppButton size="sm" variant="primary" icon="ph:upload-simple" @click="addFacade">Загрузить изображение</AppButton>
      </div>
    </div>

    <div v-if="building.facades.length" class="flex flex-col gap-3">
      <article
        v-for="(view, i) in building.facades" :key="view.id"
        class="flex flex-col gap-4 rounded-card border border-line bg-panel p-4 shadow-card transition-shadow hover:shadow-rise lg:flex-row"
      >
        <!-- превью с миниатюрной разметкой -->
        <div class="group relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-xl2 border border-line bg-soft lg:w-[260px]">
          <template v-if="view.imageUrl">
            <img :src="view.imageUrl" class="h-full w-full object-cover" :alt="view.name">
            <svg class="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">
              <polygon
                v-for="z in view.zones" :key="z.id" :points="zonePointsAttr(z)"
                vector-effect="non-scaling-stroke" :style="{ fill: z.color, fillOpacity: 0.34, stroke: z.color, strokeWidth: 1 }"
              />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center gap-1.5 bg-ink/55 opacity-0 transition-opacity group-hover:opacity-100">
              <AppButton size="sm" variant="primary" icon="ph:polygon" @click="navigateTo(`/facades/${building.id}/${view.id}`)">Разметка</AppButton>
              <button class="grid h-8 w-8 place-items-center rounded-lg bg-panel/90 text-ink" title="Заменить файл" @click="replaceImage(view)"><Icon name="ph:arrow-clockwise" size="15" /></button>
              <button class="grid h-8 w-8 place-items-center rounded-lg bg-panel/90 text-bad" title="Убрать изображение" @click="removeImage(view)"><Icon name="ph:x" size="15" /></button>
            </div>
          </template>
          <button v-else type="button" class="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted hover:text-plum" @click="replaceImage(view)">
            <Icon name="ph:image-square" size="24" />
            <span class="text-[12px] font-medium">Загрузить изображение</span>
          </button>
        </div>

        <!-- параметры -->
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <input
              :value="view.name"
              class="focus-ring min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[15px] font-medium tracking-[-0.015em] hover:border-line focus:border-line"
              placeholder="Название ракурса" @change="rename(view, ($event.target as HTMLInputElement).value)"
            >
            <StatusTag :tone="view.published ? 'ok' : 'neutral'" size="sm" dot>{{ view.published ? 'Опубликован' : 'Не опубликован' }}</StatusTag>
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
            <span class="flex items-center gap-1"><Icon name="ph:stack" size="14" /> Этажей размечено: <b class="tabular text-ink">{{ floorsMarked(view) }}</b> из {{ building.floors }}</span>
            <span class="flex items-center gap-1"><Icon name="ph:door" size="14" /> Помещений на фасаде: <b class="tabular text-ink">{{ unitsMarked(view) }}</b></span>
          </div>

          <p class="mt-3 text-[11px] font-semibold uppercase tracking-[0.03em] text-muted">Тэг</p>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <button
              v-for="t in FACADE_TAGS" :key="t" type="button"
              class="focus-ring flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors"
              :class="view.tag === t ? 'border-plum bg-plum-soft text-plum' : 'border-line text-muted hover:bg-soft hover:text-ink'"
              @click="setTag(view, t)"
            >
              <Icon :name="FACADE_TAG_META[t].icon" size="12" /> {{ FACADE_TAG_META[t].label }}
            </button>
          </div>
        </div>

        <!-- действия -->
        <div class="flex shrink-0 flex-col gap-2 border-t border-line pt-3 lg:w-[190px] lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <AppButton size="sm" variant="primary" icon="ph:polygon" :disabled="!view.imageUrl" @click="navigateTo(`/facades/${building.id}/${view.id}`)">Разметить области</AppButton>
          <div class="rounded-xl2 border border-line px-2.5 py-1.5">
            <AppSwitch :model-value="view.published" label="Публикация" @update:model-value="togglePublish(view)" />
          </div>
          <div class="flex gap-1.5">
            <button class="focus-ring flex-1 rounded-lg border border-line py-1.5 text-muted hover:text-ink disabled:opacity-40" :disabled="i === 0" title="Выше" @click="unitsStore.moveFacade(building.id, view.id, -1)"><Icon name="ph:arrow-up" size="13" /></button>
            <button class="focus-ring flex-1 rounded-lg border border-line py-1.5 text-muted hover:text-ink disabled:opacity-40" :disabled="i === building.facades.length - 1" title="Ниже" @click="unitsStore.moveFacade(building.id, view.id, 1)"><Icon name="ph:arrow-down" size="13" /></button>
            <button class="focus-ring flex-1 rounded-lg border border-line py-1.5 text-muted hover:text-bad" title="Удалить ракурс" @click="confirmRemove = view"><Icon name="ph:trash" size="13" /></button>
          </div>
        </div>
      </article>
    </div>

    <EmptyState v-else icon="ph:buildings" title="Ракурсы фасада не добавлены" text="Загрузите виды дома с разных сторон — покупатель выбирает квартиру, глядя на фасад, а не на таблицу">
      <template #action><AppButton size="sm" variant="primary" icon="ph:upload-simple" @click="addFacade">Загрузить изображение</AppButton></template>
    </EmptyState>

    <AppModal :model-value="!!confirmRemove" title="Удалить ракурс?" width="sm" @update:model-value="confirmRemove = null">
      <p class="text-[13px] text-muted">
        Ракурс «{{ confirmRemove?.name }}» и вся его разметка ({{ confirmRemove?.zones.length }} обл.) будут удалены. Это действие нельзя отменить.
      </p>
      <div class="mt-4 flex gap-2">
        <AppButton block @click="confirmRemove = null">Отмена</AppButton>
        <AppButton block variant="danger" icon="ph:trash" @click="doRemove">Удалить</AppButton>
      </div>
    </AppModal>
  </div>
</template>

