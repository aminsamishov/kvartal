<script setup lang="ts">
import { USERS } from '~/data/catalog'
import { ROLE_LABELS } from '~/data/catalog'

definePageMeta({ layout: 'auth' })

const auth = useAuthStore()
const phone = ref('')
const code = ref('')

/** Демо-вход: одно нажатие — и человек внутри, под выбранной ролью. */
function loginAs(userId: string) {
  auth.loginAsDemo(userId)
  if (auth.isAuthed) navigateTo('/')
}

async function submitPhone() {
  await auth.sendCode(phone.value)
}
async function submitCode() {
  await auth.confirmCode(code.value)
  if (auth.isAuthed) navigateTo('/')
}
</script>

<template>
  <div class="relative z-10 w-full max-w-[400px]">
    <div class="mb-7 flex flex-col items-center gap-3 text-center">
      <div class="grid h-14 w-14 place-items-center rounded-2xl bg-fill-plum font-disp text-2xl font-bold text-white shadow-panel">K</div>
      <div>
        <h1 class="font-disp text-[22px] font-semibold text-white">Kvartal</h1>
        <p class="text-[13px] text-side-ink">Платформа продаж и рассрочек застройщика</p>
      </div>
    </div>

    <div class="rounded-card border border-side-line bg-panel p-6 shadow-panel">
      <template v-if="auth.step === 'phone'">
        <h2 class="text-[16px] font-semibold tracking-[-0.02em]">Вход по номеру телефона</h2>
        <p class="mt-1 text-[13px] text-muted">Отправим код в SMS или WhatsApp — без паролей.</p>

        <form class="mt-5 flex flex-col gap-3.5" @submit.prevent="submitPhone">
          <AppInput v-model="phone" label="Номер телефона" placeholder="+996 700 123 456" icon="ph:phone" type="tel" :error="auth.error" />
          <AppButton variant="primary" type="submit" :loading="auth.loading" block>Получить код</AppButton>
        </form>

        <div class="mt-5 border-t border-line pt-4">
          <p class="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted">Демо-вход — выберите роль</p>
          <p class="mb-2 text-[12px] text-muted">Один клик — и вы внутри под этой ролью. Права у ролей разные.</p>
          <div class="flex flex-wrap gap-1.5">
            <Chip v-for="u in USERS.slice(0, 6)" :key="u.id" @click="loginAs(u.id)">
              {{ u.name.split(' ')[0] }} · {{ ROLE_LABELS[u.role] }}
            </Chip>
          </div>
        </div>
      </template>

      <template v-else>
        <button class="mb-3 flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink" @click="auth.backToPhone">
          <Icon name="ph:arrow-left" size="14" /> Изменить номер
        </button>
        <h2 class="text-[16px] font-semibold tracking-[-0.02em]">Введите код из SMS</h2>
        <p class="mt-1 text-[13px] text-muted">Отправили код на {{ fmtPhone(auth.phoneInput) }}</p>

        <form class="mt-5 flex flex-col gap-3.5" @submit.prevent="submitCode">
          <AppInput v-model="code" label="Код" placeholder="0000" :error="auth.error" />
          <AppButton variant="primary" type="submit" :loading="auth.loading" block>Войти</AppButton>
        </form>

        <p class="mt-4 rounded-xl2 bg-info-bg px-3 py-2.5 text-[12.5px] text-info">
          Демо-режим: код <b class="tabular">{{ auth.demoCode }}</b> или любой другой — вход выполнится в любом случае.
        </p>
      </template>
    </div>

    <p class="mt-5 text-center text-[12px] text-side-ink">© 2026 Kvartal — внутренняя платформа продаж</p>
  </div>
</template>
