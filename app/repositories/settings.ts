import { DOC_TEMPLATES, PAYMENT_METHODS, PROMOTIONS, ROLE_LABELS, SALES_OFFICES, TEMPLATE_VARIABLES, UNIT_OPTIONS, USERS } from '~/data/catalog'
import type { AppUser, DocumentTemplate, PaymentMethod, Promotion, SalesOffice, TemplateVariable, UnitOption } from '~/types/models'
import { clone, delay } from './api'

export function fetchPromotions(): Promise<Promotion[]> { return delay(clone(PROMOTIONS)) }
export function fetchPaymentMethods(): Promise<PaymentMethod[]> { return delay(clone(PAYMENT_METHODS)) }
export function fetchUnitOptions(): Promise<UnitOption[]> { return delay(clone(UNIT_OPTIONS)) }
export function fetchDocTemplates(): Promise<DocumentTemplate[]> { return delay(clone(DOC_TEMPLATES)) }
export function fetchTemplateVariables(): Promise<TemplateVariable[]> { return delay(clone(TEMPLATE_VARIABLES), 120) }
export function fetchSalesOffices(): Promise<SalesOffice[]> { return delay(clone(SALES_OFFICES)) }
export function fetchUsers(): Promise<AppUser[]> { return delay(clone(USERS)) }
export function fetchRoleLabels() { return delay(clone(ROLE_LABELS), 80) }

export function saveEntity<T>(entity: T): Promise<T> { return delay(entity, 180) }
export function removeEntity(id: string): Promise<void> { return delay(undefined, 140) }
