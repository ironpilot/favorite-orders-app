<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/tabs/restaurants/${restaurantId}`" />
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
        <ion-button
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
          v-if="!confirmingDelete"
          expand="block"
          fill="clear"
          color="danger"
          data-testid="delete-order"
          @click="confirmingDelete = true"
        >
          Remove order
        </ion-button>
        <div
          v-else
          data-testid="delete-confirm"
        >
          <p>Remove this order?</p>
          <ion-button
            color="danger"
            :disabled="busy"
            data-testid="confirm-delete"
            @click="remove"
          >
            Remove
          </ion-button>
          <ion-button
            fill="clear"
            data-testid="cancel-delete"
            @click="confirmingDelete = false"
          >
            Cancel
          </ion-button>
        </div>
      </div>
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
  IonLabel,
  IonBadge,
  IonSpinner,
  IonText,
  IonButton,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';
import { shareOutline } from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';
import {
  deleteOrder,
  fetchOrder,
  formatCustomization,
  orderLabel,
  setDefaultOrder,
  shareHandler,
  type Order,
} from '@/services/restaurants';

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

async function load() {
  errorMessage.value = '';
  try {
    order.value = await fetchOrder(orderId);
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not load order';
  } finally {
    loading.value = false;
  }
}

async function share() {
  if (order.value) await shareHandler.share(order.value);
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

onIonViewWillEnter(load);
load();

defineExpose({ order, load, makeDefault, remove, share });
</script>

<style scoped>
.order-detail {
  max-width: 640px;
  margin: 0 auto;
  overflow-wrap: anywhere;
}

.notes {
  white-space: pre-wrap;
}
</style>
