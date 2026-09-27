import { CLIENT_DOCUMENTS, CLIENTS, LEADS, RESERVATIONS } from '~/data/seed'
import type { Client, ClientDocument, Lead, Reservation } from '~/types/models'
import { clone, delay } from './api'

export function fetchClients(): Promise<Client[]> {
  return delay(clone(CLIENTS), 200)
}

export function fetchLeads(): Promise<Lead[]> {
  return delay(clone(LEADS), 220)
}

export function fetchReservations(): Promise<Reservation[]> {
  return delay(clone(RESERVATIONS), 180)
}

export function fetchDocuments(): Promise<ClientDocument[]> {
  return delay(clone(CLIENT_DOCUMENTS), 160)
}

export function createClient(client: Client): Promise<Client> {
  return delay(client, 200)
}

export function createLead(lead: Lead): Promise<Lead> {
  return delay(lead, 200)
}

export function createReservation(res: Reservation): Promise<Reservation> {
  return delay(res, 260)
}

export function cancelReservation(id: string): Promise<void> {
  return delay(undefined, 160)
}
