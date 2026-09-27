<script setup lang="ts">
import { AUTOMATION_RULES } from '~/composables/useAutomations'

definePageMeta({ breadcrumb: [{ label: 'Настройки', to: '/settings' }, { label: 'Автоматизации' }] })

/**
 * Автоматизации: что система делает без менеджера. Выключатели нужны не ради
 * гибкости — правило, которое нельзя отключить, отдел продаж обходит руками,
 * и данные перестают сходиться.
 */
const settings = useSettingsStore()
const ui = useUiStore()

const limits = computed(() => settings.discountLimits)

function toggle(key: keyof typeof settings.automations) {
  settings.automations[key] = !settings.automations[key]
  ui.toast(settings.automations[key] ? 'Правило включено' : 'Правило выключено', settings.automations[key] ? 'ok' : 'info')
}

const reservation = computed(() => settings.reservationSettings)
</script>

<template>
  <SettingsShell
    title="Автоматизации"
    subtitle="Сценарии, которые выполняются сами: задачи, брони, графики и оповещения"
  >
    <div class="flex flex-col gap-4">
      <AppCard :padded="false">
        <div class="flex flex-col">
          <div
            v-for="(rule, i) in AUTOMATION_RULES" :key="rule.key"
            class="flex flex-wrap items-start gap-3 px-5 py-4"
            :class="i ? 'border-t border-line' : ''"
          >
            <span
              class="grid h-9 w-9 shrink-0 place-items-center rounded-xl2"
              :class="settings.automations[rule.key] ? 'bg-plum-soft text-plum' : 'bg-soft text-muted'"
            ><Icon :name="rule.icon" size="17" /></span>

            <div class="min-w-0 flex-1">
              <p class="text-[13.5px] font-semibold text-ink">{{ rule.title }}</p>
              <p class="mt-0.5 text-[12.5px] text-muted">
                <b class="font-medium text-ink">Когда:</b> {{ rule.trigger }}
              </p>
              <p class="text-[12.5px] text-muted">
                <b class="font-medium text-ink">Что делаем:</b> {{ rule.action }}
              </p>
            </div>

            <AppSwitch
              :model-value="settings.automations[rule.key]"
              :label="settings.automations[rule.key] ? 'Включено' : 'Выключено'"
              @update:model-value="toggle(rule.key)"
            />
          </div>
        </div>
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
            При автопередаче первый в очереди получает бронь без задатка на сутки — менеджеру остаётся позвонить
            и подтвердить. Без неё освободившийся объект просто возвращается в продажу.
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
  </SettingsShell>
</template>
