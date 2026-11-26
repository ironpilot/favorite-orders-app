<template>
  <ion-app>
    <ion-router-outlet />
    <offline-banner />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import OfflineBanner from '@/components/OfflineBanner.vue';
</script>
