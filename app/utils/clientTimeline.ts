import type { Unit } from '~/types/models'
import type { ClientProfile } from '~/utils/clientProfile'
import { buildLeadTimeline, type TimelineItem } from '~/utils/leadTimeline'
import { DOC_KIND_META } from '~/utils/meta'
import { money } from '~/utils/format'

/**
 * Единая лента клиента. Собирается из лент его заявок (там уже есть звонки,
 * задачи, этапы, брони, договоры и платежи) плюс документы, которые к заявке
 * не привязаны: досье живёт дольше любой отдельной заявки.
 */
export function buildClientTimeline(profile: ClientProfile, unitOf: (id: string) => Unit | undefined): TimelineItem[] {
  const items: TimelineItem[] = []
  const seen = new Set<string>()

  for (const lead of profile.leads) {
    const leadReservations = profile.reservations.filter((r) => r.leadId === lead.id)
    const leadContracts = profile.contracts.filter((c) => c.leadId === lead.id)
    const contractIds = new Set(leadContracts.map((c) => c.id))
    for (const item of buildLeadTimeline({
      lead,
      reservations: leadReservations,
      contracts: leadContracts,
      payments: profile.payments.filter((p) => contractIds.has(p.contractId)),
      unitOf,
    })) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      items.push(item)
    }
  }

  // брони и договоры без заявки: переоформления и повторные покупки приходят
  // мимо воронки, но в досье клиента они обязаны быть
  for (const r of profile.reservations.filter((x) => !x.leadId)) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    const unit = unitOf(r.unitId)
    items.push({
      id: r.id, at: r.createdAt, group: 'object', icon: 'ph:bookmark-simple',
      title: `Бронь ${unit ? `№ ${unit.number}` : ''}`.trim(),
      detail: r.deposit ? `задаток ${money(r.deposit, 'KGS')}` : 'без задатка',
      tone: r.status === 'converted' ? 'ok' : r.status === 'active' ? 'warn' : 'bad',
    })
  }

  for (const c of profile.contracts.filter((x) => !x.leadId)) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    items.push({
      id: c.id, at: c.signedAt ?? c.createdAt, group: 'money', icon: 'ph:file-text',
      title: `Договор ${c.number}`,
      detail: money(c.price, c.currency),
      tone: 'ok',
    })
  }

  for (const p of profile.payments) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    items.push({
      id: p.id, at: p.date, group: 'money', icon: 'ph:hand-coins',
      title: p.status === 'confirmed' ? 'Платёж принят' : p.status === 'pending' ? 'Платёж на подтверждении' : 'Платёж отклонён',
      detail: money(p.amount, p.currency),
      tone: p.status === 'confirmed' ? 'ok' : p.status === 'pending' ? 'warn' : 'bad',
    })
  }

  for (const d of profile.documents) {
    items.push({
      id: `doc-${d.id}`, at: d.uploadedAt, group: 'doc', icon: DOC_KIND_META[d.kind].icon,
      title: `Документ: ${d.name}`,
      detail: d.signed ? 'подписан' : 'без подписи',
      author: d.uploadedBy,
      tone: d.signed ? 'ok' : 'neutral',
    })
  }

  return items.sort((a, b) => b.at.localeCompare(a.at))
}
