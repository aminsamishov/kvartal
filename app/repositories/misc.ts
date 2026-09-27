import { AUDIT, NOTIFICATIONS } from '~/data/seed'
import type { AuditEntry, NotificationItem } from '~/types/models'
import { clone, delay } from './api'

export function fetchAudit(): Promise<AuditEntry[]> {
  return delay(clone(AUDIT), 200)
}

export function fetchNotifications(): Promise<NotificationItem[]> {
  return delay(clone(NOTIFICATIONS), 150)
}

export function markNotificationRead(id: string): Promise<void> {
  return delay(undefined, 80)
}
