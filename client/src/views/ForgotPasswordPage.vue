<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/login" />
        </ion-buttons>
        <ion-title>Forgot password</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <form
        data-testid="forgot-form"
        @submit.prevent="submit"
      >
        <p>Enter your account email and we will send you a link to set a new password.</p>
        <ion-list>
          <ion-item>
            <ion-input
              v-model="email"
              label="Email"
              label-placement="stacked"
              type="email"
              name="email"
              required
            />
          </ion-item>
        </ion-list>
        <p
          v-if="message"
          data-testid="forgot-message"
          class="ion-text-center"
        >
          <ion-text :color="failed ? 'danger' : 'medium'">
            {{ message }}
          </ion-text>
        </p>
        <ion-button
          expand="block"
          type="submit"
          :disabled="busy"
          data-testid="forgot-submit"
        >
          Send reset link
        </ion-button>
        <ion-button
          expand="block"
          fill="clear"
          router-link="/login"
        >
          Back to sign in
        </ion-button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  IonText,
} from '@ionic/vue';
import { requestPasswordReset } from '@/services/auth';

const email = ref('');
const busy = ref(false);
const message = ref('');
const failed = ref(false);

async function submit() {
  failed.value = false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    failed.value = true;
    message.value = 'Enter a valid email address';
    return;
  }
  busy.value = true;
  try {
    message.value = await requestPasswordReset(email.value.trim());
  } catch (e) {
    failed.value = true;
    message.value = e instanceof Error ? e.message : 'Something went wrong';
  } finally {
    busy.value = false;
  }
}
</script>
