<template>
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-side px-4">
    <div class="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-plum/25 blur-[100px]" />
    <div class="pointer-events-none absolute -bottom-40 -right-24 h-[420px] w-[420px] rounded-full bg-info/20 blur-[110px]" />
    <slot />
    <ToastHost />
  </div>
</template>
