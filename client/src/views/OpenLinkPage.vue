<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <app-logo />
        </ion-buttons>
        <ion-title>Shared order</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div
        v-if="loading"
        class="ion-text-center"
      >
        <ion-spinner />
      </div>
      <div
        v-if="errorMessage"
        class="ion-text-center"
        data-testid="link-error"
      >
        <p>
          <ion-text color="danger">
            {{ errorMessage }}
          </ion-text>
        </p>
        <ion-button
          fill="clear"
          router-link="/tabs/shared"
          data-testid="link-go-shared"
        >
          Go to Shared
        </ion-button>
      </div>
      <ion-alert
        :is-open="prompting"
        header="Become friends?"
        :message="opened ? `Send ${userLabel(opened.owner)} a friend request?` : ''"
        :buttons="promptButtons"
        data-testid="friend-prompt"
        @did-dismiss="prompting = false"
      />
      <ion-toast
        :is-open="toast.open"
        :message="toast.message"
        :color="toast.color"
        :duration="2500"
        position="bottom"
        data-testid="link-toast"
        @did-dismiss="toast.open = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonSpinner,
  IonText,
  IonButton,
  IonAlert,
  IonToast,
} from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '@/lib/api';
import { sendFriendRequest, userLabel } from '@/services/friends';
import { LINK_INVALID_MESSAGE, openShareLink, type OpenedLink } from '@/services/sharing';

const props = defineProps<{ token?: string }>();
const route = useRoute();
const router = useRouter();
const token = props.token ?? String(route?.params.token);

const loading = ref(true);
const errorMessage = ref('');
const opened = ref<OpenedLink | null>(null);
const prompting = ref(false);
const toast = reactive({ open: false, message: '', color: 'success' as 'success' | 'danger' });

const showOrder = () => {
  const o = opened.value;
  if (!o) return Promise.resolve();
  return router.replace(o.own ? '/tabs/restaurants' : `/tabs/shared/${o.shareId}`);
};

/** Accepting sends the owner a friend request; skipping keeps the order in the Shared tab. */
async function acceptPrompt() {
  try {
    await sendFriendRequest(opened.value!.owner.id);
    toast.message = `Friend request sent to ${userLabel(opened.value!.owner)}`;
    toast.color = 'success';
  } catch (e) {
    toast.message = e instanceof Error ? e.message : 'Could not send friend request';
    toast.color = 'danger';
  }
  toast.open = true;
  await showOrder();
}

const promptButtons = [
  { text: 'Not now', role: 'cancel', handler: () => { showOrder(); } },
  { text: 'Send request', handler: () => { acceptPrompt(); } },
];

async function open() {
  try {
    opened.value = await openShareLink(token);
    if (opened.value.friendPrompt) prompting.value = true;
    else await showOrder();
  } catch (e) {
    errorMessage.value = e instanceof ApiError && e.status === 410
      ? LINK_INVALID_MESSAGE
      : e instanceof Error ? e.message : 'Could not open link';
  } finally {
    loading.value = false;
  }
}

open();

defineExpose({ opened, prompting, errorMessage, acceptPrompt, promptButtons, toast });
</script>
