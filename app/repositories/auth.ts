import { USERS } from '~/data/catalog'
import type { AppUser } from '~/types/models'
import { clone, delay } from './api'

// Мок входа по коду из SMS/WhatsApp — как описано в архитектуре платформы.
// Код всегда 4 цифры "0000" в демо-режиме, любой другой код тоже примется
// в целях прототипа, чтобы не блокировать демонстрацию.
export function requestCode(phone: string): Promise<{ demoCode: string }> {
  return delay({ demoCode: '0000' }, 500)
}

export function verifyCode(phone: string, code: string): Promise<AppUser> {
  const normalized = phone.replace(/\D/g, '')
  const user = USERS.find((u) => u.phone === normalized) ?? USERS[0]!
  return delay(clone(user), 500)
}
