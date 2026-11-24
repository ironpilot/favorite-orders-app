<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <app-logo slot="start" />
        <ion-title>Shared Orders</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p>Orders shared by your friends will appear here.</p>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue';
</script>
