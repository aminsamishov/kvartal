<script setup lang="ts">
import { area as fmtArea, fmtDate, fmtPhone, money } from '~/utils/format'
import { UNIT_KIND_META } from '~/utils/meta'
import type { DealType } from '~/types/models'

definePageMeta({ breadcrumb: [{ label: 'Продажи' }, { label: 'Мастер сделок' }] })

const route = useRoute()
const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const settingsStore = useSettingsStore()
const dealsStore = useDealsStore()
const misc = useMiscStore()
const auth = useAuthStore()
const ui = useUiStore()

const steps = ['Объект', 'Клиент', 'Условия', 'Договор']
const step = ref(0)

// шаг 1 — объект
const unitSearch = ref('')
const selectedUnitId = ref<string>((route.query.unit as string) || '')
// заявка, из которой пришли: связь обязана дойти до договора, иначе источник
// продажи теряется и аналитика по каналам пустая
const fromLeadId = computed(() => (route.query.lead as string) || '')
const fromLead = computed(() => (fromLeadId.value ? salesStore.lead(fromLeadId.value) : undefined))
const selectedUnit = computed(() => unitsStore.unit(selectedUnitId.value))
const pickableUnits = computed(() => unitsStore.units.filter((u) =>
  (u.status === 'free' || u.status === 'reserved') && (!unitSearch.value || u.number.toLowerCase().includes(unitSearch.value.toLowerCase())),
).slice(0, 40))

// шаг 2 — клиент
const clientMode = ref<'existing' | 'new'>('existing')
const clientSearch = ref('')
const selectedClientId = ref('')
watchEffect(() => {
  if (fromLead.value && !selectedClientId.value) {
    selectedClientId.value = fromLead.value.clientId
    clientMode.value = 'existing'
  }
})
const newClient = reactive({ name: '', phone: '' })
const matchingClients = computed(() => (clientSearch.value.length < 2 ? [] : salesStore.clients.filter((c) => c.name.toLowerCase().includes(clientSearch.value.toLowerCase()) || c.phone.includes(clientSearch.value)).slice(0, 8)))
const selectedClient = computed(() => salesStore.clients.find((c) => c.id === selectedClientId.value))

// шаг 3 — условия
const paymentMethodId = ref('')
const dealType = ref<DealType>('regular')
const discount = ref(0)
const months = ref(24)
const downPct = ref(20)
const route_ = ref<'company' | 'notary' | 'state_registry'>('company')

const activeMethods = computed(() => settingsStore.paymentMethods.filter((m) => m.active))
const selectedMethod = computed(() => activeMethods.value.find((m) => m.id === paymentMethodId.value))
const isFull = computed(() => selectedMethod.value?.kind === 'full')
const basePrice = computed(() => selectedUnit.value?.price ?? 0)
const finalPrice = computed(() => Math.round(basePrice.value * (1 - discount.value / 100)))
const needsApproval = computed(() => discount.value > 5 || dealType.value === 'barter' || dealType.value === 'pledge')

const createdContract = ref<Awaited<ReturnType<typeof dealsStore.createContract>> | null>(null)

function next() {
  if (step.value === 0 && !selectedUnitId.value) { ui.toast('Выберите объект', 'warn'); return }
  if (step.value === 1) {
    if (clientMode.value === 'existing' && !selectedClientId.value) { ui.toast('Выберите клиента', 'warn'); return }
    if (clientMode.value === 'new' && (!newClient.name.trim() || !newClient.phone.trim())) { ui.toast('Заполните имя и телефон', 'warn'); return }
  }
  if (step.value === 2 && !paymentMethodId.value) { ui.toast('Выберите способ оплаты', 'warn'); return }
  step.value++
}

async function finalize() {
  if (!selectedUnit.value) return
  let clientId = selectedClientId.value
  if (clientMode.value === 'new') {
    const c = await salesStore.addClient({ kind: 'person', name: newClient.name, phone: newClient.phone.replace(/\D/g, ''), origin: 'own' })
    clientId = c.id
  }
  const contract = await dealsStore.createContract({
    projectId: selectedUnit.value.projectId, clientId, unitIds: [selectedUnit.value.id], dealType: dealType.value,
    price: finalPrice.value, discount: discount.value, currency: 'USD', months: isFull.value ? 1 : months.value,
    downPct: downPct.value, route: route_.value, needsApproval: needsApproval.value,
    leadId: fromLeadId.value || undefined,
  })
  misc.log('Договоры', `Договор ${contract.number} создан (${needsApproval.value ? 'на согласовании' : 'активен'})`, auth.user?.name ?? '')
  createdContract.value = contract
  step.value = 3
}

function reset() {
  step.value = 0
  selectedUnitId.value = ''
  selectedClientId.value = ''
  clientMode.value = 'existing'
  newClient.name = ''; newClient.phone = ''
  discount.value = 0
  createdContract.value = null
}
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-6">
    <div>
      <h1 class="text-[22px] font-semibold tracking-[-0.025em]">Мастер сделок</h1>
      <p class="mt-1 text-[13px] text-muted">От выбора объекта до договора и графика — в одной транзакции</p>
    </div>

    <StepsHeader :steps="steps" :current="step" />

    <!-- Шаг 1: объект -->
    <AppCard v-if="step === 0" title="Выберите объект">
      <AppInput v-model="unitSearch" placeholder="Поиск по номеру" icon="ph:magnifying-glass" class="mb-3.5" />
      <div class="max-h-[380px] overflow-y-auto rounded-xl2 border border-line">
        <button
          v-for="u in pickableUnits" :key="u.id" type="button"
          class="flex w-full items-center justify-between border-b border-line px-3.5 py-2.5 text-left last:border-0 hover:bg-soft"
          :class="selectedUnitId === u.id ? 'bg-plum-soft' : ''"
          @click="selectedUnitId = u.id"
        >
          <span class="flex items-center gap-2.5">
            <Icon :name="UNIT_KIND_META[u.kind].icon" size="16" class="text-muted" />
            <span class="text-[13.5px] font-semibold">№ {{ u.number }}</span>
            <span class="text-[12.5px] text-muted">{{ fmtArea(u.area) }} · {{ u.rooms || '—' }} комн.</span>
          </span>
          <span class="flex items-center gap-2">
            <StatusTag v-if="u.status === 'reserved'" tone="warn" size="sm">Бронь</StatusTag>
            <span class="tabular text-[13px] font-semibold">{{ money(u.price) }}</span>
          </span>
        </button>
        <EmptyState v-if="!pickableUnits.length" compact icon="ph:magnifying-glass" title="Не найдено" />
      </div>
      <div class="mt-4 flex justify-end"><AppButton variant="primary" icon-right="ph:arrow-right" @click="next">Далее</AppButton></div>
    </AppCard>

    <!-- Шаг 2: клиент -->
    <AppCard v-else-if="step === 1" title="Клиент">
      <SegmentedControl v-model="clientMode" :options="[{ value: 'existing', label: 'Существующий' }, { value: 'new', label: 'Новый клиент' }]" class="mb-3.5" />
      <template v-if="clientMode === 'existing'">
        <AppInput v-model="clientSearch" placeholder="Имя или телефон" icon="ph:magnifying-glass" />
        <div v-if="matchingClients.length" class="mt-2 max-h-[260px] overflow-y-auto rounded-xl2 border border-line">
          <button
            v-for="c in matchingClients" :key="c.id" type="button"
            class="flex w-full items-center gap-2.5 border-b border-line px-3.5 py-2.5 text-left last:border-0 hover:bg-soft"
            :class="selectedClientId === c.id ? 'bg-plum-soft' : ''"
            @click="selectedClientId = c.id"
          >
            <AppAvatar :name="c.name" size="sm" /><span class="text-[13.5px]">{{ c.name }}</span><span class="text-[12px] text-muted">{{ fmtPhone(c.phone) }}</span>
          </button>
        </div>
        <p v-if="selectedClient" class="mt-3 rounded-xl2 bg-ok-bg px-3 py-2 text-[12.5px] text-ok">Выбран: {{ selectedClient.name }}</p>
      </template>
      <template v-else>
        <div class="flex flex-col gap-3">
          <AppInput v-model="newClient.name" label="Имя Фамилия" />
          <AppInput v-model="newClient.phone" label="Телефон" placeholder="+996 700 000 000" />
        </div>
      </template>
      <div class="mt-4 flex justify-between">
        <AppButton icon="ph:arrow-left" @click="step--">Назад</AppButton>
        <AppButton variant="primary" icon-right="ph:arrow-right" @click="next">Далее</AppButton>
      </div>
    </AppCard>

    <!-- Шаг 3: условия -->
    <AppCard v-else-if="step === 2" title="Условия сделки">
      <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <AppSelect v-model="paymentMethodId" label="Способ оплаты" :options="activeMethods.map((m) => ({ value: m.id, label: m.name }))" placeholder="Выберите способ" />
        <AppSelect v-model="dealType" label="Тип сделки" :options="[{ value: 'regular', label: 'Обычная' }, { value: 'barter', label: 'Бартер' }, { value: 'pledge', label: 'Залог' }, { value: 'preferential', label: 'Льготная' }]" />
        <AppInput v-model.number="discount" type="number" label="Скидка, %" suffix="%" />
        <AppSelect v-model="route_" label="Оформление" :options="[{ value: 'company', label: 'Через компанию' }, { value: 'notary', label: 'Нотариус' }, { value: 'state_registry', label: 'Госрегистр' }]" />
        <template v-if="!isFull">
          <AppSelect v-model.number="months" label="Срок рассрочки" :options="[12, 18, 24, 36].map((m) => ({ value: m, label: `${m} мес.` }))" />
          <AppInput v-model.number="downPct" type="number" label="Первый взнос, %" suffix="%" />
        </template>
      </div>

      <div class="mt-4 rounded-xl2 bg-soft p-3.5">
        <div class="flex items-center justify-between text-[13.5px]"><span class="text-muted">Цена объекта</span><span class="tabular">{{ money(basePrice) }}</span></div>
        <div class="mt-1 flex items-center justify-between text-[13.5px]"><span class="text-muted">Скидка</span><span class="tabular text-bad">−{{ discount }}%</span></div>
        <div class="mt-1.5 flex items-center justify-between border-t border-line pt-1.5 text-[15px] font-semibold"><span>Итого</span><span class="tabular">{{ money(finalPrice) }}</span></div>
      </div>

      <p v-if="needsApproval" class="mt-3.5 flex items-start gap-2 rounded-xl2 border-l-4 border-warn bg-warn-bg px-3.5 py-2.5 text-[12.5px] text-warn">
        <Icon name="ph:seal-warning" size="16" class="mt-0.5 shrink-0" />
        Скидка выше лимита или нестандартный тип сделки — договор уйдёт на согласование контролёру и директору перед активацией.
      </p>

      <div class="mt-4 flex justify-between">
        <AppButton icon="ph:arrow-left" @click="step--">Назад</AppButton>
        <AppButton variant="primary" icon-right="ph:check-bold" @click="finalize">Создать договор</AppButton>
      </div>
    </AppCard>

    <!-- Шаг 4: готово -->
    <AppCard v-else-if="step === 3 && createdContract">
      <div class="flex flex-col items-center py-6 text-center">
        <div class="grid h-16 w-16 place-items-center rounded-full" :class="needsApproval ? 'bg-warn-bg text-warn' : 'bg-ok-bg text-ok'">
          <Icon :name="needsApproval ? 'ph:hourglass' : 'ph:check-bold'" size="30" />
        </div>
        <h2 class="mt-4 text-[18px] font-semibold tracking-[-0.02em]">Договор {{ createdContract.number }}</h2>
        <p class="mt-1 text-[13.5px] text-muted">{{ needsApproval ? 'Отправлен на согласование' : 'Активирован, график создан' }}</p>
        <p class="tabular mt-3 text-[20px] font-bold">{{ money(createdContract.price) }}</p>
        <p class="mt-1 text-[12.5px] text-muted">Первая строка графика — {{ fmtDate(createdContract.signedAt ?? createdContract.createdAt) }}</p>
        <div class="mt-5 flex gap-2">
          <AppButton @click="reset">Новая сделка</AppButton>
          <AppButton variant="primary" @click="navigateTo(`/contracts/${createdContract.id}`)">Открыть договор</AppButton>
        </div>
      </div>
    </AppCard>
  </div>
</template>
