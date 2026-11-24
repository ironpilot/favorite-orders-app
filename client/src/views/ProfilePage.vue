<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Profile</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p>Account settings will appear here.</p>
      <ion-button
        expand="block"
        color="medium"
        data-testid="sign-out"
        @click="leave"
      >
        Sign out
      </ion-button>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton } from '@ionic/vue';
import { signOut } from '@/services/auth';

const router = useRouter();

async function leave() {
  await signOut();
  await router.replace('/login');
}
</script>
