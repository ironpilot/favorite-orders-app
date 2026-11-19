<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ isSignUp ? 'Create account' : 'Sign in' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <form
        data-testid="auth-form"
        @submit.prevent="submit"
      >
        <ion-list>
          <ion-item v-if="isSignUp">
            <ion-input
              v-model="displayName"
              label="Name"
              label-placement="stacked"
              name="displayName"
            />
          </ion-item>
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
          <ion-item>
            <ion-input
              v-model="password"
              label="Password"
              label-placement="stacked"
              type="password"
              name="password"
              required
            />
          </ion-item>
        </ion-list>
        <p
          v-if="errorMessage"
          data-testid="auth-error"
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
          data-testid="auth-submit"
        >
          {{ isSignUp ? 'Sign up' : 'Sign in' }}
        </ion-button>
        <ion-button
          expand="block"
          fill="clear"
          data-testid="auth-toggle"
          @click="isSignUp = !isSignUp"
        >
          {{ isSignUp ? 'Have an account? Sign in' : 'New here? Create an account' }}
        </ion-button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
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
import { signIn, signUp } from '@/services/auth';

const router = useRouter();
const isSignUp = ref(false);
const displayName = ref('');
const email = ref('');
const password = ref('');
const busy = ref(false);
const errorMessage = ref('');

async function submit() {
  busy.value = true;
  errorMessage.value = '';
  try {
    if (isSignUp.value) {
      await signUp(email.value, password.value, displayName.value);
    } else {
      await signIn(email.value, password.value);
    }
    await router.replace('/tabs/restaurants');
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Something went wrong';
  } finally {
    busy.value = false;
  }
}
</script>
