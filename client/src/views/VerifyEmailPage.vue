<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <app-logo slot="start" />
        <ion-title>Verify your email</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p>
        We sent a 6-digit code to <strong>{{ email || 'your email' }}</strong>.
      </p>
      <p
        v-if="expiresLabel"
        data-testid="verify-expiry"
      >
        The code expires at {{ expiresLabel }} (valid for 15 minutes).
      </p>
      <form
        data-testid="verify-form"
        @submit.prevent="submit"
      >
        <ion-list>
          <ion-item>
            <ion-input
              v-model="code"
              label="Verification code"
              label-placement="stacked"
              inputmode="numeric"
              autocomplete="one-time-code"
              name="code"
              required
            />
          </ion-item>
        </ion-list>
        <p
          v-if="errorMessage"
          data-testid="verify-error"
          class="ion-text-center"
        >
          <ion-text color="danger">
            {{ errorMessage }}
          </ion-text>
        </p>
        <p
          v-if="infoMessage"
          data-testid="verify-info"
          class="ion-text-center"
        >
          <ion-text color="medium">
            {{ infoMessage }}
          </ion-text>
        </p>
        <ion-button
          expand="block"
          type="submit"
          :disabled="busy"
          data-testid="verify-submit"
        >
          Verify
        </ion-button>
        <ion-button
          expand="block"
          fill="clear"
          :disabled="busy"
          data-testid="verify-resend"
          @click="resend"
        >
          Send a new code
        </ion-button>
        <ion-button
          expand="block"
          fill="clear"
          color="medium"
          data-testid="verify-signout"
          @click="leave"
        >
          Sign out
        </ion-button>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
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
import { getCurrentAccount, resendVerification, signOut, verifyEmail, type Account } from '@/services/auth';

const router = useRouter();
const code = ref('');
const email = ref('');
const expiresAt = ref<string | null>(null);
const busy = ref(false);
const errorMessage = ref('');
const infoMessage = ref('');

const expiresLabel = computed(() =>
  expiresAt.value ? new Date(expiresAt.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
);

function show(account: Account | null) {
  email.value = account?.email ?? '';
  expiresAt.value = account?.verificationExpiresAt ?? null;
}

onMounted(async () => show(await getCurrentAccount()));

async function submit() {
  errorMessage.value = '';
  infoMessage.value = '';
  if (!code.value.trim()) {
    errorMessage.value = 'Enter the code from your email';
    return;
  }
  busy.value = true;
  try {
    await verifyEmail(code.value.trim());
    await router.replace('/tabs/restaurants');
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Something went wrong';
  } finally {
    busy.value = false;
  }
}

async function resend() {
  errorMessage.value = '';
  infoMessage.value = '';
  busy.value = true;
  try {
    show(await resendVerification());
    code.value = '';
    infoMessage.value = 'A new code has been sent. Earlier codes no longer work.';
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Something went wrong';
  } finally {
    busy.value = false;
  }
}

async function leave() {
  await signOut();
  await router.replace('/login');
}
</script>
