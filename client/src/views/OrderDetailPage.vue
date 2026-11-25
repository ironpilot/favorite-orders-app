<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/tabs/restaurants/${restaurantId}`" />
          <app-logo />
        </ion-buttons>
        <ion-title data-testid="order-title">
          {{ order ? orderLabel(order) : 'Order' }}
        </ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div
        v-if="loading && !order"
        class="ion-text-center"
      >
        <ion-spinner />
      </div>
      <p
        v-if="errorMessage"
        data-testid="detail-error"
      >
        <ion-text color="danger">
          {{ errorMessage }}
        </ion-text>
      </p>
      <div
        v-if="order"
        class="order-detail"
      >
        <h2
          v-if="order.title"
          data-testid="detail-name"
        >
          {{ order.title }}
        </h2>
        <ion-badge
          v-if="order.isDefault"
          data-testid="detail-default-badge"
        >
          Default
        </ion-badge>
        <ion-list>
          <ion-item
            v-for="(item, i) in order.items"
            :key="i"
            data-testid="detail-item"
          >
            <ion-label class="ion-text-wrap">
              <h3>
                <span data-testid="detail-quantity">{{ item.quantity }}×</span>
                {{ item.name }}
              </h3>
              <p
                v-for="(c, j) in item.customizations"
                :key="j"
                data-testid="detail-customization"
              >
                {{ formatCustomization(c) }}
              </p>
            </ion-label>
          </ion-item>
        </ion-list>
        <p
          v-if="order.notes"
          class="notes"
          data-testid="detail-notes"
        >
          {{ order.notes }}
        </p>
        <ion-button
            size="small"
          expand="block"
          data-testid="share-order"
          @click="share"
        >
          <ion-icon
            slot="start"
            :icon="shareOutline"
          />
          Share
        </ion-button>
        <ion-list
          v-if="picking"
          data-testid="friend-picker"
        >
          <ion-list-header>Share with friends</ion-list-header>
          <p
            v-if="friends.length === 0"
            data-testid="picker-empty"
          >
            Add friends in the Friends tab to share orders.
          </p>
          <ion-item
            v-for="f in friends"
            :key="f.user.id"
            data-testid="picker-friend"
          >
            <ion-checkbox
              :checked="alreadyShared(f.user.id) || selected.includes(f.user.id)"
              :disabled="alreadyShared(f.user.id)"
              data-testid="picker-checkbox"
              @ion-change="toggle(f.user.id)"
            >
              {{ userLabel(f.user) }}
            </ion-checkbox>
            <ion-note
              v-if="alreadyShared(f.user.id)"
              slot="end"
              data-testid="picker-already-shared"
            >
              Shared
            </ion-note>
          </ion-item>
          <ion-button
            expand="block"
            :disabled="busy || selected.length === 0"
            data-testid="confirm-share"
            @click="confirmShare"
          >
            Share with {{ selected.length }} {{ selected.length === 1 ? 'friend' : 'friends' }}
          </ion-button>
          <ion-button
            expand="block"
            fill="clear"
            data-testid="cancel-share"
            @click="picking = false"
          >
            Cancel
          </ion-button>
        </ion-list>
        <p
          v-if="shareMessage"
          data-testid="share-message"
        >
          <ion-text :color="shareError ? 'danger' : 'success'">
            {{ shareMessage }}
          </ion-text>
        </p>
        <ion-list
          v-if="shares.length > 0"
          data-testid="shared-with"
        >
          <ion-list-header>Shared with</ion-list-header>
          <ion-item
            v-for="s in shares"
            :key="s.id"
            data-testid="shared-with-item"
          >
            <ion-label>{{ userLabel(s.user) }}</ion-label>
            <ion-button
              slot="end"
              fill="clear"
              color="danger"
              data-testid="unshare"
              @click="unshare(s.id)"
            >
              Unshare
            </ion-button>
          </ion-item>
        </ion-list>
        <ion-button
          size="small"
          expand="block"
          fill="outline"
          data-testid="edit-order"
          @click="edit"
        >
          Edit
        </ion-button>
        <ion-button
          v-if="!order.isDefault"
          expand="block"
          fill="outline"
          :disabled="busy"
          data-testid="make-default"
          @click="makeDefault"
        >
          Make default
        </ion-button>
        <ion-button
          size="small"
          expand="block"
          fill="clear"
          color="danger"
          data-testid="delete-order"
          @click="confirmingDelete = true"
        >
          <ion-icon
              slot="start"
              :icon="trashOutline"
          />
          Remove order
        </ion-button>
        <ion-alert
          :is-open="confirmingDelete"
          header="Remove order"
          message="Remove this order?"
          :buttons="deleteAlertButtons"
          data-testid="delete-confirm"
          @did-dismiss="confirmingDelete = false"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
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
  IonLabel,
  IonBadge,
  IonSpinner,
  IonText,
  IonButton,
  IonIcon,
  IonAlert,
  IonListHeader,
  IonCheckbox,
  IonNote,
  onIonViewWillEnter,
} from '@ionic/vue';
import {shareOutline, trashOutline} from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';
import {
  deleteOrder,
  fetchOrder,
  formatCustomization,
  onOrderUpdated,
  orderLabel,
  setDefaultOrder,
  type Order,
} from '@/services/restaurants';
import { fetchFriendships, userLabel, type Friendship } from '@/services/friends';
import {
  OFFLINE_SHARE_MESSAGE,
  fetchOrderShares,
  isOffline,
  shareOrder,
  unshareOrder,
  type OrderShare,
} from '@/services/sharing';

const props = defineProps<{ id?: string; orderId?: string }>();
const route = useRoute();
const router = useRouter();
const restaurantId = props.id ?? String(route?.params.id);
const orderId = props.orderId ?? String(route?.params.orderId);

const order = ref<Order | null>(null);
const loading = ref(true);
const busy = ref(false);
const errorMessage = ref('');
const confirmingDelete = ref(false);
const deleteAlertButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Remove', role: 'destructive', handler: () => { remove(); } },
];

const picking = ref(false);
const friends = ref<Friendship[]>([]);
const shares = ref<OrderShare[]>([]);
const selected = ref<string[]>([]);
const shareMessage = ref('');
const shareError = ref(false);

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

async function loadShares() {
  try {
    shares.value = await fetchOrderShares(orderId);
  } catch {
    // The share list is secondary; keep showing what was loaded before.
  }
}

async function load() {
  errorMessage.value = '';
  try {
    order.value = await fetchOrder(orderId);
    await loadShares();
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not load order';
  } finally {
    loading.value = false;
  }
}

function setShareMessage(message: string, error: boolean) {
  shareMessage.value = message;
  shareError.value = error;
}

const alreadyShared = (userId: string) => shares.value.some((s) => s.user.id === userId);

function toggle(userId: string) {
  if (alreadyShared(userId)) return;
  selected.value = selected.value.includes(userId)
    ? selected.value.filter((id) => id !== userId)
    : [...selected.value, userId];
}

/** Opens the friend picker; only accepted friends are listed. Sharing needs a connection. */
async function share() {
  setShareMessage('', false);
  if (isOffline()) {
    setShareMessage(OFFLINE_SHARE_MESSAGE, true);
    return;
  }
  try {
    const all = (await fetchFriendships()) ?? [];
    friends.value = all.filter((f) => f.status === 'accepted');
    await loadShares();
    selected.value = [];
    picking.value = true;
  } catch (e) {
    setShareMessage(errorText(e, 'Could not load friends'), true);
  }
}

async function confirmShare() {
  busy.value = true;
  try {
    const count = selected.value.length;
    await shareOrder(orderId, selected.value);
    picking.value = false;
    selected.value = [];
    setShareMessage(`Shared with ${count} ${count === 1 ? 'friend' : 'friends'}`, false);
    await loadShares();
  } catch (e) {
    setShareMessage(errorText(e, 'Could not share order'), true);
  } finally {
    busy.value = false;
  }
}

async function unshare(shareId: string) {
  setShareMessage('', false);
  try {
    await unshareOrder(shareId);
    shares.value = shares.value.filter((s) => s.id !== shareId);
  } catch (e) {
    setShareMessage(errorText(e, 'Could not unshare order'), true);
  }
}

function edit() {
  router.push(`/tabs/restaurants/${restaurantId}/orders/${orderId}/edit`);
}

async function makeDefault() {
  busy.value = true;
  errorMessage.value = '';
  try {
    order.value = await setDefaultOrder(orderId);
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not change the default order';
  } finally {
    busy.value = false;
  }
}

async function remove() {
  busy.value = true;
  errorMessage.value = '';
  try {
    await deleteOrder(orderId);
    await router.replace(`/tabs/restaurants/${restaurantId}`);
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not remove order';
  } finally {
    busy.value = false;
    confirmingDelete.value = false;
  }
}

// Show a saved edit right away, then reload from the server when the page is entered again.
const stopListening = onOrderUpdated((saved) => {
  if (saved.id === orderId) order.value = saved;
});
onUnmounted(stopListening);

onIonViewWillEnter(load);
load();

defineExpose({
  order, load, makeDefault, remove, share, confirmShare, unshare, toggle, selected, picking,
  confirmingDelete, deleteAlertButtons,
});
</script>

<style scoped>
.order-detail {
  max-width: 640px;
  margin: 0 auto;
  overflow-wrap: anywhere;
  /* Larger text for readability on web and mobile. */
  font-size: 1.15rem;
}

.notes {
  white-space: pre-wrap;
}

.order-detail :deep(h2) {
  font-size: 1.4rem;
}

.order-detail :deep(ion-label),
.order-detail :deep(p) {
  font-size: 1.1rem;
}

/* Larger item names (with quantity) on mobile (phone-width) screens only. */
@media (max-width: 767px) {
  .order-detail :deep(ion-label h3) {
    font-size: 1.35rem;
  }
}
</style>
