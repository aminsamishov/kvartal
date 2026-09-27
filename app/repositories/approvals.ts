import type { DiscountRequest } from '~/types/models'
import { DISCOUNT_REQUESTS } from '~/data/seed'
import { clone, delay } from './api'

export function fetchDiscountRequests(): Promise<DiscountRequest[]> {
  return delay(clone(DISCOUNT_REQUESTS), 180)
}

export function saveDiscountRequest(request: DiscountRequest): Promise<DiscountRequest> {
  return delay(request, 200)
}
