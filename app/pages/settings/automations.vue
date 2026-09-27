<script setup lang="ts">
import type { AutomationRule, AutomationTriggerKind } from '~/types/automation'
import { TRIGGER_META } from '~/types/automation'
import { newRule, type FieldOption } from '~/utils/automation'
import { fmtDateTime } from '~/utils/format'

definePageMeta({ breadcrumb: [{ label: 'Настройки', to: '/settings' }, { label: 'Автоматизации' }] })

/**
 * Автоматизации как конструктор, а не как список выключателей. Сценарии
 * продаж меняются быстрее релизов: «бронь истекает — предупреди за сутки»,
 * «показ прошёл — перезвони завтра». Руководитель собирает такое правило сам,
 * видит формулу целиком и журнал срабатываний.
 */
const automations = useAutomationsStore()
const unitsStore = useUnitsStore()
const salesStore = useSalesStore()
const settings = useSettingsStore()
const ui = useUiStore()

const projects = computed<FieldOption[]>(() => unitsStore.projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name })))
const sources = computed(() => [...new Set(salesStore.leads.map((l) => l.source))].filter(Boolean))

const GROUPS = ['Продажи', 'Бронь', 'Финансы'] as const
const tab = ref<'all' | typeof GROUPS[number]>('all')

const rules = computed(() => (tab.value === 'all'
  ? automations.rules
  : automations.rules.filter((r) => TRIGGER_META[r.trigger].group === tab.value)))

const groupCount = (group: string) => automations.rules.filter((r) => TRIGGER_META[r.trigger].group === group).length

/* -------------------------------- редактор -------------------------------- */

const builderOpen = ref(false)
const editing = ref<AutomationRule | null>(null)

function createRule(trigger?: AutomationTriggerKind) {
  editing.value = trigger ? newRule(trigger) : null
  builderOpen.value = true
}
function editRule(rule: AutomationRule) {
  editing.value = rule
  builderOpen.value = true
}
function saveRule(rule: AutomationRule) {
  const isNew = !automations.rule(rule.id)
  automations.saveRule(rule)
  ui.toast(isNew ? 'Правило создано' : 'Правило сохранено', 'ok')
}
function removeRule(rule: AutomationRule) {
  if (automations.removeRule(rule.id)) ui.toast('Правило удалено', 'info')
  else ui.toast('Встроенное правило можно выключить, но не удалить', 'warn')
}
function duplicateRule(rule: AutomationRule) {
  const copy = automations.duplicateRule(rule.id)
  if (copy) { editing.value = copy; builderOpen.value = true }
}

/* -------------------------------- шаблоны --------------------------------- */

/** Готовые сценарии: чаще всего отделу нужен именно один из них. */
const TEMPLATES: { title: string; hint: string; icon: string; build: () => AutomationRule }[] = [
  {
    title: 'Бронь истекает — предупредить за сутки',
    hint: 'Уведомление менеджеру и задача-звонок клиенту',
    icon: 'ph:hourglass-medium',
    build: () => {
      const r = newRule('reservation.expiring')
      r.name = 'Бронь истекает через сутки'
      r.offsetHours = 24
      r.actions = [
        { id: 'a1', kind: 'notify', target: 'manager', text: 'Бронь на {объект} истекает {срок} — клиент {клиент}' },
        { id: 'a2', kind: 'task', text: 'Позвонить клиенту {клиент} по брони {объект}', value: 'call', delayHours: 1, target: 'manager' },
      ]
      return r
    },
  },
  {
    title: 'Показ завершён — follow-up через сутки',
    hint: 'Задача «Узнать впечатления» на следующий день',
    icon: 'ph:buildings',
    build: () => {
      const r = newRule('visit.completed')
      r.name = 'Follow-up через сутки после показа'
      r.actions = [{ id: 'a1', kind: 'task', text: 'Узнать впечатления после показа', value: 'call', delayHours: 24, target: 'manager' }]
      return r
    },
  },
  {
    title: 'Дорогая бронь без задатка — под контроль',
    hint: 'Руководитель узнаёт о брони дорогого лота сразу',
    icon: 'ph:shield-check',
    build: () => {
      const r = newRule('reservation.created')
      r.name = 'Дорогая бронь без задатка'
      r.conditions = [
        { id: 'c1', field: 'reservationKind', op: 'eq', value: 'no_deposit' },
        { id: 'c2', field: 'price', op: 'gt', value: 60000 },
      ]
      r.actions = [{ id: 'a1', kind: 'notify', target: 'head', text: 'Бронь без задатка на {объект} — клиент {клиент}' }]
      return r
    },
  },
  {
    title: 'Просрочка больше недели — директору',
    hint: 'Эскалация, когда платёж завис',
    icon: 'ph:warning-octagon',
    build: () => {
      const r = newRule('payment.overdue')
      r.name = 'Просрочка больше недели'
      r.offsetHours = 24 * 7
      r.actions = [{ id: 'a1', kind: 'notify', target: 'director', text: 'Договор {договор}: {сумма}, {срок}' }]
      return r
    },
  },
]

function useTemplate(t: typeof TEMPLATES[number]) {
  editing.value = t.build()
  builderOpen.value = true
}

/* --------------------------------- прочее --------------------------------- */

const limits = computed(() => settings.discountLimits)
const reservation = computed(() => settings.reservationSettings)
</script>

<template>
  <SettingsShell
    title="Автоматизации"
    subtitle="Конструктор сценариев: событие → условия → действия. Правила работают без менеджера"
  >
    <div class="flex flex-col gap-4">
      <!-- состояние конвейера -->
      <section class="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4">
        <div class="bg-panel px-4 py-3">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted">Правил</p>
          <p class="tabular mt-1 text-[19px] font-semibold text-ink">{{ automations.rules.length }}</p>
        </div>
        <div class="bg-panel px-4 py-3">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted">Включено</p>
          <p class="tabular mt-1 text-[19px] font-semibold text-ok">{{ automations.activeCount }}</p>
        </div>
        <div class="bg-panel px-4 py-3">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted">Срабатываний</p>
          <p class="tabular mt-1 text-[19px] font-semibold text-ink">{{ automations.totalRuns }}</p>
        </div>
        <div class="bg-panel px-4 py-3">
          <p class="text-[11px] uppercase tracking-[0.04em] text-muted">Последнее</p>
          <p class="mt-1 truncate text-[13px] font-medium text-ink">
            {{ automations.runs[0] ? fmtDateTime(automations.runs[0].at) : '—' }}
          </p>
        </div>
      </section>

      <!-- шаблоны -->
      <AppCard title="Готовые сценарии" subtitle="Соберите правило в один клик и допишите под себя">
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            v-for="t in TEMPLATES" :key="t.title" type="button"
            class="focus-ring flex items-start gap-2.5 rounded-xl2 border border-line px-3 py-2.5 text-left transition-colors hover:border-plum/50 hover:bg-soft"
            @click="useTemplate(t)"
          >
            <Icon :name="t.icon" size="18" class="mt-0.5 shrink-0 text-plum" />
            <span class="min-w-0">
              <span class="block text-[12.5px] font-semibold text-ink">{{ t.title }}</span>
              <span class="block text-[11.5px] leading-tight text-muted">{{ t.hint }}</span>
            </span>
          </button>
        </div>
      </AppCard>

      <!-- правила -->
      <section>
        <SectionHeader title="Правила" :subtitle="`${automations.activeCount} из ${automations.rules.length} включены`">
          <template #actions>
            <SegmentedControl
              v-model="tab"
              :options="[
                { value: 'all', label: `Все ${automations.rules.length}` },
                ...GROUPS.map((g) => ({ value: g, label: `${g} ${groupCount(g)}` })),
              ]"
            />
            <AppButton variant="primary" size="sm" icon="ph:plus-bold" @click="createRule()">Новое правило</AppButton>
          </template>
        </SectionHeader>

        <div class="flex flex-col gap-2.5">
          <AutomationCard
            v-for="rule in rules" :key="rule.id" :rule="rule" :projects="projects"
            @edit="editRule(rule)"
            @toggle="automations.toggleRule(rule.id)"
            @duplicate="duplicateRule(rule)"
            @remove="removeRule(rule)"
          />
        </div>
        <EmptyState v-if="!rules.length" compact icon="ph:flow-arrow" title="В этой группе правил нет" />
      </section>

      <!-- журнал -->
      <AppCard :padded="false">
        <div class="flex items-center justify-between gap-3 px-4 pt-4">
          <h3 class="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Журнал срабатываний</h3>
          <p class="text-[11.5px] text-muted">последние {{ automations.runs.length }}</p>
        </div>
        <div v-if="automations.runs.length" class="mt-3 overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Когда</th><th>Правило</th><th>По чему</th><th>Что сделано</th></tr></thead>
            <tbody>
              <tr v-for="run in automations.runs.slice(0, 20)" :key="run.id">
                <td class="tabular whitespace-nowrap">{{ fmtDateTime(run.at) }}</td>
                <td class="font-medium">{{ run.ruleName }}</td>
                <td class="text-muted">{{ run.subject }}</td>
                <td>{{ run.effects.join(', ') || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="p-4">
          <EmptyState
            compact icon="ph:list-checks" title="Пока ничего не срабатывало"
            text="Правила по времени проверяются при входе в систему, событийные — в момент действия"
          />
        </div>
      </AppCard>

      <!-- то, что система делает всегда -->
      <AppCard title="Что система делает всегда" subtitle="Это не правила — без этого процесс не сходится">
        <ul class="flex flex-col gap-1.5 text-[12.5px] text-ink">
          <li class="flex items-start gap-2"><Icon name="ph:check-circle" size="14" class="mt-0.5 shrink-0 text-ok" /> График платежей создаётся при подписании договора, заявка переходит в «Сделку».</li>
          <li class="flex items-start gap-2"><Icon name="ph:check-circle" size="14" class="mt-0.5 shrink-0 text-ok" /> Бронь с прошедшим сроком закрывается: висеть активной она не может.</li>
          <li class="flex items-start gap-2"><Icon name="ph:check-circle" size="14" class="mt-0.5 shrink-0 text-ok" /> Помещение «в брони» без активной брони возвращается в продажу.</li>
        </ul>
      </AppCard>

      <AppCard title="Очередь на объект" subtitle="Что происходит, когда бронь снимается">
        <div class="flex flex-col gap-3">
          <AppSwitch
            :model-value="reservation.autoQueueTransfer"
            label="Передавать объект следующему в очереди автоматически"
            @update:model-value="reservation.autoQueueTransfer = $event"
          />
          <AppSwitch
            :model-value="reservation.clearQueueOnConvert"
            label="Очищать очередь, когда бронь стала договором"
            @update:model-value="reservation.clearQueueOnConvert = $event"
          />
          <p class="rounded-xl2 bg-soft px-3 py-2 text-[12px] text-muted">
            За передачу объекта очереди отвечает действие «Предложить очереди» в правиле «Снятие истёкшей брони».
            Первый в очереди получает бронь без задатка на сутки — менеджеру остаётся позвонить и подтвердить.
          </p>
        </div>
      </AppCard>

      <AppCard title="Лимиты скидок" subtitle="От них зависит маршрут согласования">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AppInput v-model.number="limits.manager" type="number" label="Менеджер, до %" suffix="%" />
          <AppInput v-model.number="limits.head" type="number" label="Руководитель, до %" suffix="%" />
          <AppInput v-model.number="limits.director" type="number" label="Директор, до %" suffix="%" />
        </div>
        <p class="mt-3 rounded-xl2 bg-soft px-3 py-2 text-[12px] text-muted">
          Скидка до {{ limits.manager }}% применяется сразу. До {{ limits.head }}% — уходит руководителю,
          выше — руководителю и директору. Каждое решение остаётся в истории запроса.
        </p>
        <NuxtLink to="/approvals" class="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-plum hover:underline">
          Открыть согласования <Icon name="ph:arrow-right" size="13" />
        </NuxtLink>
      </AppCard>
    </div>

    <AutomationBuilder
      v-model="builderOpen" :rule="editing" :projects="projects" :sources="sources"
      @save="saveRule"
    />
  </SettingsShell>
</template>
