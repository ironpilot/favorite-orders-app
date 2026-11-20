<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/restaurants" />
        </ion-buttons>
        <ion-title data-testid="restaurant-title">
          {{ restaurant?.name ?? 'Restaurant' }}
        </ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div
        v-if="loading"
        class="ion-text-center"
      >
        <ion-spinner />
      </div>
      <p
        v-else-if="errorMessage"
        data-testid="load-error"
      >
        <ion-text color="danger">
          {{ errorMessage }}
        </ion-text>
      </p>
      <p
        v-else-if="orders.length === 0"
        data-testid="no-orders"
      >
        No orders saved here yet.
      </p>
      <ion-list v-else>
        <ion-item
          v-for="order in orders"
          :key="order.id"
          data-testid="order-item"
        >
          <ion-label class="ion-text-wrap">
            <h2>{{ order.title || 'Order' }}</h2>
            <p data-testid="order-items">
              {{ order.items.map(formatItem).join(', ') }}
            </p>
            <p v-if="order.notes">
              {{ order.notes }}
            </p>
          </ion-label>
          <ion-badge
            v-if="order.isDefault"
            slot="end"
            data-testid="default-badge"
          >
            Default
          </ion-badge>
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
  onIonViewWillEnter,
} from '@ionic/vue';
import { add } from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';
import { fetchRestaurant, fetchRestaurantOrders, formatItem, type Order, type Restaurant } from '@/services/restaurants';

const props = defineProps<{ id?: string }>();
const route = useRoute();
const router = useRouter();
const restaurantId = props.id ?? String(route.params.id);

const restaurant = ref<Restaurant | null>(null);
const orders = ref<Order[]>([]);
const loading = ref(true);
const errorMessage = ref('');

async function load() {
  errorMessage.value = '';
  try {
    [restaurant.value, orders.value] = await Promise.all([
      fetchRestaurant(restaurantId),
      fetchRestaurantOrders(restaurantId),
    ]);
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not load orders';
  } finally {
    loading.value = false;
  }
}

function addOrder() {
  router.push({ path: '/tabs/restaurants/new-order', query: { restaurantId, restaurant: restaurant.value?.name ?? '' } });
}

onIonViewWillEnter(load);
load();
</script>
