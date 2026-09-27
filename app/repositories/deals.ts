import { CONTRACTS, PAYMENTS, SCHEDULE_ITEMS } from '~/data/seed'
import type { Contract, Payment, ScheduleItem } from '~/types/models'
import { clone, delay } from './api'

export function fetchContracts(): Promise<Contract[]> {
  return delay(clone(CONTRACTS), 240)
}

export function fetchScheduleItems(): Promise<ScheduleItem[]> {
  return delay(clone(SCHEDULE_ITEMS), 240)
}

export function fetchPayments(): Promise<Payment[]> {
  return delay(clone(PAYMENTS), 220)
}

export function createContract(contract: Contract, items: ScheduleItem[]): Promise<{ contract: Contract; items: ScheduleItem[] }> {
  return delay({ contract, items }, 320)
}

export function confirmPayment(paymentId: string): Promise<void> {
  return delay(undefined, 220)
}

export function rejectPayment(paymentId: string): Promise<void> {
  return delay(undefined, 180)
}

export function registerPayment(payment: Payment): Promise<Payment> {
  return delay(payment, 240)
}
