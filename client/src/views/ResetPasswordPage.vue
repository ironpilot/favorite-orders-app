<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <app-logo slot="start" />
        <ion-title>Set a new password</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div v-if="done">
        <p data-testid="reset-done">
          Your password has been changed. Sign in with your new password.
        </p>
        <ion-button
          expand="block"
          router-link="/login"
        >
          Sign in
        </ion-button>
      </div>
      <form
        v-else
        data-testid="reset-form"
        @submit.prevent="submit"
      >
        <ion-list>
          <ion-item>
            <ion-input
              v-model="password"
              label="New password"
              label-placement="stacked"
              type="password"
              name="password"
              helper-text="At least 8 characters, with letters and numbers"
              required
            />
          </ion-item>
        </ion-list>
        <p
          v-if="errorMessage"
          data-testid="reset-error"
          class="ion-text-center"
        >
          <ion-text color="danger">
            {{ errorMessage }}
          </ion-text>
        </p>
        <ion-button
          expand="block"
          type="submit"
          :disabled="busy"
          data-testid="reset-submit"
        >
          Change password
        </ion-button>
        <ion-button
          expand="block"
          fill="clear"
          router-link="/forgot-password"
        >
          Request a new link
        </ion-button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  IonText,
} from '@ionic/vue';
import { resetPassword, signOut } from '@/services/auth';

const route = useRoute();
const password = ref('');
const busy = ref(false);
const done = ref(false);
const errorMessage = ref('');

async function submit() {
  const token = typeof route.query.token === 'string' ? route.query.token : '';
  const p = password.value;
  if (!token) {
    errorMessage.value = 'This reset link is invalid or has expired';
    return;
  }
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) {
    errorMessage.value = 'Password must be at least 8 characters and contain letters and numbers';
    return;
  }
  errorMessage.value = '';
  busy.value = true;
  try {
    await resetPassword(token, p);
    // The server signs the account out everywhere, so drop any local session too.
    await signOut();
    done.value = true;
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Something went wrong';
  } finally {
    busy.value = false;
  }
}
</script>
