<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/restaurants" />
          <app-logo />
        </ion-buttons>
        <ion-title data-testid="restaurant-title">
          {{ restaurant?.name ?? 'Restaurant' }}
        </ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-refresher
        slot="fixed"
        data-testid="orders-refresher"
        @ion-refresh="onRefresh"
      >
        <ion-refresher-content />
      </ion-refresher>
      <p
        v-if="errorMessage"
        data-testid="load-error"
      >
        <ion-text color="danger">
          {{ errorMessage }}
        </ion-text>
      </p>
      <div
        v-if="loading && !loaded"
        class="ion-text-center"
      >
        <ion-spinner />
      </div>
      <template v-else-if="!loaded" />
      <p
        v-else-if="orders.length === 0"
        data-testid="no-orders"
      >
        No orders saved here yet.
      </p>
      <ion-list v-else>
        <p
          v-if="!orders.some((o) => o.isDefault)"
          class="hint"
          data-testid="no-default"
        >
          No default order set. Open an order to make it the default.
        </p>
        <ion-item
          v-for="order in orders"
          :key="order.id"
          button
          data-testid="order-item"
          @click="openOrder(order)"
        >
          <ion-label class="ion-text-wrap">
            <h2 data-testid="order-label">
              {{ orderLabel(order) }}
            </h2>
            <p data-testid="order-items">
              {{ order.items.map(formatItem).join(', ') }}
            </p>
            <p v-if="order.notes">
              {{ order.notes }}
            </p>
          </ion-label>
          <ion-badge
            v-if="order.shared"
            slot="end"
            color="tertiary"
            data-testid="shared-pill"
          >
            Shared
          </ion-badge>
          <ion-badge
            v-if="order.isDefault"
            slot="end"
            data-testid="default-badge"
          >
            Default
          </ion-badge>
          <ion-button
            v-else
            slot="end"
            fill="clear"
            size="small"
            data-testid="make-default"
            @click.stop="makeDefault(order)"
          >
            Make default
          </ion-button>
        </ion-item>
      </ion-list>
      <ion-fab
        slot="fixed"
        vertical="bottom"
        horizontal="end"
      >
        <ion-fab-button
          aria-label="Add order here"
          data-testid="add-order-here"
          @click="addOrder"
        >
          <ion-icon :icon="add" />
        </ion-fab-button>
      </ion-fab>
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
  IonFab,
  IonFabButton,
  IonIcon,
  IonButton,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
} from '@ionic/vue';
import { add } from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchRestaurant,
  fetchRestaurantOrders,
  formatItem,
  orderLabel,
  setDefaultOrder,
  type Order,
  type Restaurant,
} from '@/services/restaurants';

const props = defineProps<{ id?: string }>();
const route = useRoute();
const router = useRouter();
const restaurantId = props.id ?? String(route.params.id);

const restaurant = ref<Restaurant | null>(null);
const orders = ref<Order[]>([]);
const loading = ref(true);
const loaded = ref(false);
const errorMessage = ref('');

/** Reloads the page; on failure the previous orders stay visible and an error is shown. */
async function load(): Promise<boolean> {
  loading.value = true;
  try {
    const [r, o] = await Promise.all([
      fetchRestaurant(restaurantId),
      fetchRestaurantOrders(restaurantId),
    ]);
    restaurant.value = r;
    orders.value = o ?? [];
    loaded.value = true;
    errorMessage.value = '';
    return true;
  } catch (e) {
    const reason = e instanceof Error ? e.message : '';
    errorMessage.value = loaded.value
      ? `Could not refresh orders${reason ? `: ${reason}` : ''}. Showing the last loaded list.`
      : reason || 'Could not load orders';
    return false;
  } finally {
    loading.value = false;
  }
}

async function onRefresh(event: CustomEvent) {
  try {
    await load();
  } finally {
    (event.target as HTMLIonRefresherElement | null)?.complete?.();
  }
}

function openOrder(order: Order) {
  router.push(`/tabs/restaurants/${restaurantId}/orders/${order.id}`);
}

async function makeDefault(order: Order) {
  try {
    await setDefaultOrder(order.id);
    orders.value = orders.value.map((o) => ({ ...o, isDefault: o.id === order.id }));
    errorMessage.value = '';
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not change the default order';
  }
}

function addOrder() {
  router.push({ path: '/tabs/restaurants/new-order', query: { restaurantId, restaurant: restaurant.value?.name ?? '' } });
}

onIonViewWillEnter(load);
load();

defineExpose({ orders, load, onRefresh, makeDefault });
</script>

<style scoped>
.hint {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin: 4px 16px;
}

/* Larger text on mobile (phone-width) screens only. */
@media (max-width: 767px) {
  ion-label h2 {
    font-size: 1.3rem;
  }

  ion-label p {
    font-size: 1.05rem;
  }

  .hint {
    font-size: 1rem;
  }
}
</style>
