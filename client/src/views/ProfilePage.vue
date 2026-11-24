<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <app-logo slot="start" />
        <ion-title>Profile</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <form
        data-testid="profile-form"
        @submit.prevent="save"
      >
        <ion-list>
          <ion-item>
            <ion-input
              v-model="displayName"
              label="Name"
              label-placement="stacked"
              name="displayName"
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
          <ion-item>
            <ion-input
              v-model="phone"
              label="Phone"
              label-placement="stacked"
              type="tel"
              name="phone"
              required
            />
          </ion-item>
          <ion-item>
            <ion-input
              v-model="currentPassword"
              label="Current password (to change password)"
              label-placement="stacked"
              type="password"
              autocomplete="current-password"
              name="currentPassword"
            />
          </ion-item>
          <ion-item>
            <ion-input
              v-model="newPassword"
              label="New password"
              label-placement="stacked"
              type="password"
              autocomplete="new-password"
              name="newPassword"
            />
          </ion-item>
        </ion-list>
        <ion-button
          expand="block"
          type="submit"
          :disabled="busy"
          data-testid="profile-save"
        >
          Save changes
        </ion-button>
      </form>

      <div
        v-if="account?.pendingEmail"
        data-testid="email-change"
      >
        <p>
          We sent a 6-digit code to <strong>{{ account.pendingEmail }}</strong>.
          Until you confirm it, keep using <strong>{{ account.email }}</strong>.
        </p>
        <p v-if="changeExpiresLabel">
          The code expires at {{ changeExpiresLabel }} (valid for 15 minutes).
        </p>
        <ion-list>
          <ion-item>
            <ion-input
              v-model="code"
              label="Verification code"
              label-placement="stacked"
              inputmode="numeric"
              autocomplete="one-time-code"
              name="code"
            />
          </ion-item>
        </ion-list>
        <ion-button
          expand="block"
          :disabled="busy"
          data-testid="email-change-verify"
          @click="confirmEmail"
        >
          Confirm new email
        </ion-button>
        <ion-button
          expand="block"
          fill="clear"
          :disabled="busy"
          data-testid="email-change-resend"
          @click="run(resendEmailChange, 'A new code has been sent. Earlier codes no longer work.')"
        >
          Send a new code
        </ion-button>
        <ion-button
          expand="block"
          fill="clear"
          color="medium"
          :disabled="busy"
          data-testid="email-change-cancel"
          @click="run(cancelEmailChange, 'Email change cancelled.')"
        >
          Cancel email change
        </ion-button>
      </div>

      <p
        v-if="errorMessage"
        data-testid="profile-error"
        class="ion-text-center"
      >
        <ion-text color="danger">
          {{ errorMessage }}
        </ion-text>
      </p>
      <p
        v-if="infoMessage"
        data-testid="profile-info"
        class="ion-text-center"
      >
        <ion-text color="medium">
          {{ infoMessage }}
        </ion-text>
      </p>

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
import {
  cancelEmailChange,
  getCurrentAccount,
  resendEmailChange,
  signOut,
  updateProfile,
  verifyEmailChange,
  type Account,
  type ProfileChanges,
} from '@/services/auth';

const router = useRouter();
const account = ref<Account | null>(null);
const displayName = ref('');
const email = ref('');
const phone = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const code = ref('');
const busy = ref(false);
const errorMessage = ref('');
const infoMessage = ref('');

const changeExpiresLabel = computed(() => {
  const at = account.value?.pendingEmailExpiresAt;
  return at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
});

function show(a: Account | null) {
  account.value = a;
  displayName.value = a?.displayName ?? '';
  email.value = a?.pendingEmail ?? a?.email ?? '';
  phone.value = a?.phone ?? '';
}

onMounted(async () => show(await getCurrentAccount()));

async function run(action: () => Promise<Account>, success: string) {
  errorMessage.value = '';
  infoMessage.value = '';
  busy.value = true;
  try {
    show(await action());
    infoMessage.value = success;
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Something went wrong';
  } finally {
    busy.value = false;
  }
}

async function save() {
  const changes: ProfileChanges = { displayName: displayName.value, phone: phone.value };
  const targetEmail = email.value.trim();
  if (targetEmail && targetEmail !== (account.value?.pendingEmail ?? account.value?.email)) changes.email = targetEmail;
  if (newPassword.value) {
    if (!currentPassword.value) {
      errorMessage.value = 'Enter your current password to set a new one';
      return;
    }
    changes.currentPassword = currentPassword.value;
    changes.password = newPassword.value;
  }
  await run(() => updateProfile(changes), changes.email
    ? 'Saved. Enter the code sent to your new email to finish changing it.'
    : 'Profile saved.');
  if (!errorMessage.value) {
    currentPassword.value = '';
    newPassword.value = '';
  }
}

async function confirmEmail() {
  if (!code.value.trim()) {
    errorMessage.value = 'Enter the code from your email';
    return;
  }
  await run(() => verifyEmailChange(code.value.trim()), 'Your email has been changed.');
  if (!errorMessage.value) code.value = '';
}

async function leave() {
  await signOut();
  await router.replace('/login');
}
</script>
