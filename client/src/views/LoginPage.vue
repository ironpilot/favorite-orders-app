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
              autocomplete="name"
              required
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
          <ion-item v-if="isSignUp">
            <ion-input
              v-model="phone"
              label="Phone"
              label-placement="stacked"
              type="tel"
              name="phone"
              autocomplete="tel"
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
              :helper-text="isSignUp ? 'At least 8 characters, with letters and numbers' : undefined"
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
        <ion-button
          v-if="!isSignUp"
          expand="block"
          fill="clear"
          size="small"
          router-link="/forgot-password"
          data-testid="forgot-password"
        >
          Forgot password?
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
import { isVerified, signIn, signUp } from '@/services/auth';

const router = useRouter();
const isSignUp = ref(false);
const displayName = ref('');
const email = ref('');
const phone = ref('');
const password = ref('');

// Mirrors the server rules so obvious mistakes are explained before a request is sent.
function signUpError(): string {
  if (!displayName.value.trim()) return 'Name is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return 'Enter a valid email address';
  if (!/^\+?\d{7,15}$/.test(phone.value.trim().replace(/[\s().-]/g, ''))) return 'Enter a valid phone number';
  const p = password.value;
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) {
    return 'Password must be at least 8 characters and contain letters and numbers';
  }
  return '';
}
const busy = ref(false);
const errorMessage = ref('');

async function submit() {
  errorMessage.value = isSignUp.value ? signUpError() : '';
  if (errorMessage.value) return;
  busy.value = true;
  try {
    const account = isSignUp.value
      ? await signUp(email.value.trim(), password.value, displayName.value.trim(), phone.value.trim())
      : await signIn(email.value, password.value);
    await router.replace(isVerified(account) ? '/tabs/restaurants' : '/verify-email');
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Something went wrong';
  } finally {
    busy.value = false;
  }
}
</script>
