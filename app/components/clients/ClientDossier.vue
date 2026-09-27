<script setup lang="ts">
import type { ClientProfile } from '~/utils/clientProfile'
import { buildClientSummary, CLIENT_STATUS_META } from '~/utils/clientProfile'
import { MARITAL_STATUS_META, UNIT_KIND_META } from '~/utils/meta'
import { area as fmtArea, fmtDate, fmtPhone, money } from '~/utils/format'

/**
 * Печатная версия досье — то самое «скачать всё в PDF». Отдельного генератора
 * PDF в проекте нет и заводить его ради одной кнопки незачем: браузер печатает
 * в PDF сам, а нам нужно дать ему аккуратную страницу без интерфейса.
 */
const props = defineProps<{ profile: ClientProfile }>()

const summary = computed(() => buildClientSummary(props.profile))
const unitsStore = useUnitsStore()
const printedAt = new Date().toISOString()
</script>

<template>
  <section class="print-root">
    <header class="print-head">
      <div>
        <p class="print-eyebrow">Kvartal · досье покупателя</p>
        <h1 class="print-title">{{ profile.client.name }}</h1>
        <p class="print-sub">
          {{ CLIENT_STATUS_META[profile.status].label }}
          <template v-if="profile.manager"> · менеджер {{ profile.manager.name }}</template>
          <template v-if="profile.purchaseAt"> · покупка {{ fmtDate(profile.purchaseAt) }}</template>
        </p>
      </div>
      <p class="print-sub">Сформировано {{ fmtDate(printedAt) }}</p>
    </header>

    <p class="print-summary">{{ summary }}</p>

    <h2 class="print-h2">Контакты и реквизиты</h2>
    <table class="print-table">
      <tbody>
        <tr><td>Телефон</td><td>{{ profile.client.phone ? fmtPhone(profile.client.phone) : '—' }}</td></tr>
        <tr><td>Почта</td><td>{{ profile.client.email ?? '—' }}</td></tr>
        <tr><td>ИНН</td><td>{{ profile.client.inn ?? '—' }}</td></tr>
        <tr><td>Паспорт</td><td>{{ profile.client.passportMasked ?? '—' }}</td></tr>
        <tr><td>Дата рождения</td><td>{{ profile.client.birthDate ? fmtDate(profile.client.birthDate) : '—' }}</td></tr>
        <tr><td>Адрес</td><td>{{ profile.client.address ?? '—' }}</td></tr>
        <tr><td>Семейное положение</td><td>{{ profile.client.maritalStatus ? MARITAL_STATUS_META[profile.client.maritalStatus] : '—' }}</td></tr>
        <tr><td>Источник</td><td>{{ profile.client.source ?? '—' }}</td></tr>
      </tbody>
    </table>

    <h2 class="print-h2">Финансы</h2>
    <table class="print-table">
      <tbody>
        <tr><td>Объём покупок</td><td>{{ money(profile.totals.purchases) }}</td></tr>
        <tr><td>Оплачено</td><td>{{ money(profile.totals.paid) }} ({{ profile.totals.paidPct }}%)</td></tr>
        <tr><td>Остаток</td><td>{{ money(profile.totals.remaining) }}</td></tr>
        <tr><td>Просрочка</td><td>{{ profile.totals.overdueAmount ? `${money(profile.totals.overdueAmount)} · ${profile.totals.overdueDays} дн.` : 'нет' }}</td></tr>
        <tr v-if="profile.totals.nextDue"><td>Следующий платёж</td><td>{{ fmtDate(profile.totals.nextDue.dueDate) }} — {{ money(profile.totals.nextDue.remaining) }}</td></tr>
      </tbody>
    </table>

    <h2 class="print-h2">Объекты · {{ profile.units.length }}</h2>
    <table class="print-table print-table--grid">
      <thead><tr><th>Объект</th><th>ЖК / дом</th><th>Этаж</th><th>Площадь</th><th>Стоимость</th></tr></thead>
      <tbody>
        <tr v-for="u in profile.units" :key="u.id">
          <td>{{ UNIT_KIND_META[u.kind].short }} № {{ u.number }}</td>
          <td>{{ unitsStore.project(u.projectId)?.name ?? '—' }} · {{ unitsStore.building(u.buildingId)?.name ?? '—' }}</td>
          <td>{{ u.floor }}</td>
          <td>{{ fmtArea(u.area) }}</td>
          <td>{{ money(u.price) }}</td>
        </tr>
      </tbody>
    </table>

    <h2 class="print-h2">Договоры · {{ profile.contracts.length }}</h2>
    <table class="print-table print-table--grid">
      <thead><tr><th>Номер</th><th>Дата</th><th>Стоимость</th><th>Скидка</th><th>Статус</th></tr></thead>
      <tbody>
        <tr v-for="c in profile.contracts" :key="c.id">
          <td>{{ c.number }}</td>
          <td>{{ fmtDate(c.signedAt ?? c.createdAt) }}</td>
          <td>{{ money(c.price, c.currency) }}</td>
          <td>{{ c.discount ? `${c.discount}%` : '—' }}</td>
          <td>{{ c.status === 'paid' ? 'Оплачен' : c.status === 'active' ? 'Активен' : c.status }}</td>
        </tr>
      </tbody>
    </table>

    <h2 class="print-h2">График платежей</h2>
    <table class="print-table print-table--grid">
      <thead><tr><th>Дата</th><th>Договор</th><th>План</th><th>Факт</th><th>Остаток</th></tr></thead>
      <tbody>
        <tr v-for="r in profile.schedule" :key="r.id">
          <td>{{ fmtDate(r.dueDate) }}</td>
          <td>{{ r.contractNumber }}</td>
          <td>{{ money(r.plan) }}</td>
          <td>{{ r.fact ? money(r.fact) : '—' }}</td>
          <td>{{ r.remaining ? money(r.remaining) : '—' }}</td>
        </tr>
      </tbody>
    </table>

    <h2 class="print-h2">Документы · {{ profile.documents.length }}</h2>
    <table class="print-table print-table--grid">
      <thead><tr><th>Документ</th><th>Загружен</th><th>Подпись</th></tr></thead>
      <tbody>
        <tr v-for="d in profile.documents" :key="d.id">
          <td>{{ d.name }}</td>
          <td>{{ fmtDate(d.uploadedAt) }} · {{ d.uploadedBy }}</td>
          <td>{{ d.signed ? 'подписан' : 'нет' }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.print-root { color: #1A171D; background: #fff; font-family: var(--f-ui); font-size: 11px; line-height: 1.45; }
.print-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #1A171D; padding-bottom: 10px; }
.print-eyebrow { font-size: 9px; text-transform: uppercase; letter-spacing: .08em; color: #6D6772; margin: 0; }
.print-title { font-size: 20px; font-weight: 700; margin: 4px 0 2px; letter-spacing: -.02em; }
.print-sub { font-size: 10.5px; color: #6D6772; margin: 0; }
.print-summary { margin: 12px 0 0; font-size: 12px; }
.print-h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #6D6772; margin: 16px 0 6px; }
.print-table { width: 100%; border-collapse: collapse; }
.print-table td, .print-table th { padding: 4px 6px; border-bottom: 1px solid #E5E1DE; text-align: left; vertical-align: top; }
.print-table td:first-child { color: #6D6772; width: 34%; }
.print-table--grid td:first-child { color: #1A171D; width: auto; font-weight: 600; }
.print-table th { font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; color: #6D6772; border-bottom: 1px solid #1A171D; }
</style>
