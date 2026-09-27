<script setup lang="ts">
import type { Lead, PaymentPlanKind } from '~/types/models'
import { PAYMENT_PLANS, PAYMENT_PLAN_META } from '~/utils/meta'
import { money } from '~/utils/format'

// Запрос клиента структурой, а не текстом — из этих полей собирается подбор.
const props = defineProps<{ lead: Lead }>()
const emit = defineEmits<{ match: [] }>()

const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const auth = useAuthStore()
const ui = useUiStore()

const editing = ref(false)
const form = reactive({
  projectIds: [] as string[],
  buildingIds: [] as string[],
  roomsMin: '' as string | number,
  roomsMax: '' as string | number,
  areaMin: '' as string | number,
  areaMax: '' as string | number,
  floorMin: '' as string | number,
  floorMax: '' as string | number,
  budgetMin: '' as string | number,
  budgetMax: '' as string | number,
  paymentMethod: 'installment' as PaymentPlanKind,
  comment: '',
})

function load() {
  const i = props.lead.interest
  Object.assign(form, {
    projectIds: [...i.projectIds], buildingIds: [...i.buildingIds],
    roomsMin: i.roomsMin ?? '', roomsMax: i.roomsMax ?? '',
    areaMin: i.areaMin ?? '', areaMax: i.areaMax ?? '',
    floorMin: i.floorMin ?? '', floorMax: i.floorMax ?? '',
    budgetMin: i.budgetMin ?? '', budgetMax: i.budgetMax ?? '',
    paymentMethod: i.paymentMethod ?? 'installment', comment: i.comment ?? '',
  })
}
watch(() => [props.lead.id, editing.value], () => { if (editing.value) load() })

const projects = computed(() => unitsStore.projects.filter((p) => !p.archived))
const buildings = computed(() => unitsStore.buildings.filter((b) => !b.archived
  && (!form.projectIds.length || form.projectIds.includes(b.projectId))))

function num(v: string | number) {
  const n = Number(v)
  return v === '' || !Number.isFinite(n) ? undefined : n
}

function save() {
  salesStore.setLeadInterest(props.lead.id, {
    projectIds: [...form.projectIds],
    buildingIds: form.buildingIds.filter((id) => buildings.value.some((b) => b.id === id)),
    roomsMin: num(form.roomsMin), roomsMax: num(form.roomsMax),
    areaMin: num(form.areaMin), areaMax: num(form.areaMax),
    floorMin: num(form.floorMin), floorMax: num(form.floorMax),
    budgetMin: num(form.budgetMin), budgetMax: num(form.budgetMax),
    paymentMethod: form.paymentMethod,
    comment: form.comment.trim() || undefined,
  }, auth.user?.name ?? 'Система')
  ui.toast('Запрос клиента обновлён', 'ok')
  editing.value = false
}

function toggle(list: 'projectIds' | 'buildingIds', id: string) {
  form[list] = form[list].includes(id) ? form[list].filter((x) => x !== id) : [...form[list], id]
}

/* --------------------------- отображение --------------------------------- */

const i = computed(() => props.lead.interest)
const projectNames = computed(() => (i.value.projectIds.length
  ? i.value.projectIds.map((id) => unitsStore.project(id)?.name ?? '—').join(', ')
  : 'любой'))
const buildingNames = computed(() => (i.value.buildingIds.length
  ? i.value.buildingIds.map((id) => unitsStore.building(id)?.name ?? '—').join(', ')
  : 'любой'))

function range(min?: number, max?: number, unit = '') {
  if (min === undefined && max === undefined) return 'не важно'
  if (min !== undefined && max !== undefined) return min === max ? `${min}${unit}` : `${min}–${max}${unit}`
  if (min !== undefined) return `от ${min}${unit}`
  return `до ${max}${unit}`
}

const rows = computed(() => [
  ['ЖК', projectNames.value],
  ['Корпус', buildingNames.value],
  ['Комнат', range(i.value.roomsMin, i.value.roomsMax)],
  ['Площадь', range(i.value.areaMin, i.value.areaMax, ' м²')],
  ['Этаж', range(i.value.floorMin, i.value.floorMax)],
  ['Бюджет', i.value.budgetMin || i.value.budgetMax
    ? `${i.value.budgetMin ? money(i.value.budgetMin) : '—'} – ${i.value.budgetMax ? money(i.value.budgetMax) : '—'}`
    : 'не указан'],
  ['Оплата', i.value.paymentMethod ? PAYMENT_PLAN_META[i.value.paymentMethod].label : 'не выбрана'],
] as [string, string][])
</script>

<template>
  <AppCard :padded="false">
    <div class="flex items-center justify-between gap-3 px-4 pt-4">
      <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Интерес клиента</h3>
      <AppButton size="sm" :icon="editing ? 'ph:x' : 'ph:pencil-simple'" @click="editing = !editing">
        {{ editing ? 'Отмена' : 'Изменить' }}
      </AppButton>
    </div>

    <div class="p-4">
      <!-- просмотр -->
      <template v-if="!editing">
        <dl class="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <div v-for="[label, value] in rows" :key="label" class="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
            <dt class="shrink-0 text-[12px] text-muted">{{ label }}</dt>
            <dd class="truncate text-right text-[12.5px] font-medium text-ink">{{ value }}</dd>
          </div>
        </dl>
        <p v-if="i.comment" class="mt-3 rounded-xl2 bg-soft px-3 py-2 text-[12.5px] leading-snug text-ink">
          <Icon name="ph:quotes" size="13" class="mr-1 text-muted" />{{ i.comment }}
        </p>
        <AppButton variant="primary" icon="ph:magnifying-glass" block class="mt-3.5" @click="emit('match')">
          Подобрать квартиры
        </AppButton>
      </template>

      <!-- правка -->
      <template v-else>
        <div class="flex flex-col gap-3">
          <div>
            <p class="mb-1.5 text-[11.5px] font-medium text-muted">ЖК</p>
            <div class="flex flex-wrap gap-1.5">
              <Chip v-for="p in projects" :key="p.id" :pressed="form.projectIds.includes(p.id)" @click="toggle('projectIds', p.id)">{{ p.name }}</Chip>
            </div>
          </div>
          <div v-if="buildings.length">
            <p class="mb-1.5 text-[11.5px] font-medium text-muted">Корпус</p>
            <div class="flex flex-wrap gap-1.5">
              <Chip v-for="b in buildings" :key="b.id" :pressed="form.buildingIds.includes(b.id)" @click="toggle('buildingIds', b.id)">{{ b.name }}</Chip>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex items-end gap-2">
              <AppInput v-model="form.roomsMin" type="number" label="Комнат от" />
              <AppInput v-model="form.roomsMax" type="number" label="до" />
            </div>
            <div class="flex items-end gap-2">
              <AppInput v-model="form.areaMin" type="number" label="Площадь от" />
              <AppInput v-model="form.areaMax" type="number" label="до" />
            </div>
            <div class="flex items-end gap-2">
              <AppInput v-model="form.floorMin" type="number" label="Этаж от" />
              <AppInput v-model="form.floorMax" type="number" label="до" />
            </div>
            <div class="flex items-end gap-2">
              <AppInput v-model="form.budgetMin" type="number" label="Бюджет от" />
              <AppInput v-model="form.budgetMax" type="number" label="до" />
            </div>
          </div>
          <div>
            <p class="mb-1.5 text-[11.5px] font-medium text-muted">Способ оплаты</p>
            <div class="flex flex-wrap gap-1.5">
              <Chip v-for="pm in PAYMENT_PLANS" :key="pm" :pressed="form.paymentMethod === pm" :icon="PAYMENT_PLAN_META[pm].icon" @click="form.paymentMethod = pm">
                {{ PAYMENT_PLAN_META[pm].label }}
              </Chip>
            </div>
          </div>
          <label class="flex flex-col gap-1.5 text-[12.5px] font-medium text-muted">
            Комментарий менеджера
            <textarea
              v-model="form.comment" rows="2" placeholder="Что важно клиенту"
              class="focus-ring resize-y rounded-xl2 border border-line bg-panel px-3 py-2 text-[13px] font-normal text-ink placeholder:text-muted/70"
            />
          </label>
          <div class="flex gap-2">
            <AppButton block @click="editing = false">Отмена</AppButton>
            <AppButton block variant="primary" icon="ph:check-bold" @click="save">Сохранить</AppButton>
          </div>
        </div>
      </template>
    </div>
  </AppCard>
</template>
