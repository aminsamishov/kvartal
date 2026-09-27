import type { Currency } from '~/types/models'

const SYMBOL: Record<Currency, string> = { USD: '$', KGS: 'с' }

export function money(value: number, currency: Currency = 'USD') {
  const n = Math.round(value).toLocaleString('ru-RU')
  return currency === 'USD' ? `${n} ${SYMBOL.USD}` : `${n} ${SYMBOL.KGS}`
}

export function moneyCompact(value: number, currency: Currency = 'USD') {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')} млн ${SYMBOL[currency]}`
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1000)} тыс ${SYMBOL[currency]}`
  return money(value, currency)
}

export function area(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, '')} м²`
}

export const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MONTHS_FULL = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

export function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDateFull(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${fmtDate(iso)}, ${hh}:${mm}`
}

export function daysBetween(a: string, b: string) {
  const MS = 1000 * 60 * 60 * 24
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS)
}

export function fmtPhone(raw: string) {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 12) return raw
  return `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9, 12)}`
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('')
}

export function pluralRu(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

/**
 * Двухбуквенный бейдж проекта. Просто взять заглавные буквы нельзя: у всех
 * проектов вида «ЖК «Аврора»» получится одинаковое «ЖК», поэтому сначала
 * отбрасываем тип объекта и кавычки.
 */
export function projectBadge(name: string) {
  const core = name.replace(/^(ЖК|МФК|ТЦ|БЦ)\s*/i, '').replace(/[«»"']/g, '').trim()
  const words = core.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase()
  if (!core) return 'ЖК'
  return core[0]!.toUpperCase() + (core[1] ?? '')
}
