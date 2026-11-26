<template>
  <div
    v-if="authState === 'offline'"
    class="offline-banner"
    role="status"
    data-testid="offline-banner"
  >
    <ion-icon
      :icon="cloudOfflineOutline"
      aria-hidden="true"
    />
    Operating offline
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { cloudOfflineOutline } from 'ionicons/icons';
import { authState } from '@/services/session';
</script>

<style scoped>
.offline-banner {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(56px + env(safe-area-inset-bottom));
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 14px;
  background: var(--ion-color-warning);
  color: var(--ion-color-warning-contrast);
}
</style>
