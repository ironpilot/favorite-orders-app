<template>
  <img
    :src="logoUrl"
    alt="Favorite Orders"
    class="app-logo"
    :class="{ 'app-logo--large': large }"
    data-testid="app-logo"
  >
</template>

<script setup lang="ts">
import logoUrl from '@/assets/logo.svg';

defineProps<{ large?: boolean }>();
</script>

<style scoped>
.app-logo {
  display: block;
  height: 40px;
  width: 40px;
  margin: 0 4px 0 8px;
}

.app-logo--large {
  height: auto;
  width: min(70vw, 280px);
  margin: 16px auto 24px;
}
</style>
