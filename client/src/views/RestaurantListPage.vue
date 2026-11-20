<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Restaurants</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div
        v-if="loading"
        class="ion-text-center"
        data-testid="loading"
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
        v-else-if="restaurants.length === 0"
        data-testid="empty-state"
      >
        No restaurants yet. Add your first favorite order to get started.
      </p>
      <ion-list
        v-else
        data-testid="restaurant-list"
      >
        <ion-item
          v-for="restaurant in restaurants"
          :key="restaurant.id"
          button
          detail
          data-testid="restaurant-item"
          @click="openRestaurant(restaurant.id)"
        >
          <ion-label class="ion-text-wrap">
            <h2 data-testid="restaurant-name">
              {{ restaurant.name }}
            </h2>
            <p
              v-if="restaurant.defaultItems.length > 0"
              data-testid="key-items"
            >
              {{ restaurant.defaultItems.join(', ') }}
            </p>
            <p
              v-else-if="restaurant.orderCount > 0"
              data-testid="preview-fallback"
            >
              No default order set
            </p>
            <p
              v-else
              data-testid="preview-fallback"
            >
              No orders yet. Tap to add one.
            </p>
          </ion-label>
          <ion-badge
            slot="end"
            color="medium"
            data-testid="order-count"
          >
            {{ restaurant.orderCount }} {{ restaurant.orderCount === 1 ? 'order' : 'orders' }}
          </ion-badge>
        </ion-item>
      </ion-list>
      <ion-fab
        slot="fixed"
        vertical="bottom"
        horizontal="end"
      >
        <ion-fab-button
          aria-label="Add order"
          data-testid="add-order"
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
import { useRouter } from 'vue-router';
import { fetchMyRestaurants, type RestaurantSummary } from '@/services/restaurants';

const restaurants = ref<RestaurantSummary[]>([]);
const loading = ref(true);
const errorMessage = ref('');
const router = useRouter();

function openRestaurant(id: string) {
  router.push(`/tabs/restaurants/${id}`);
}

function addOrder() {
  router.push('/tabs/restaurants/new-order');
}

async function load() {
  errorMessage.value = '';
  try {
    restaurants.value = await fetchMyRestaurants();
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not load restaurants';
  } finally {
    loading.value = false;
  }
}

onIonViewWillEnter(load);
load();

defineExpose({ load });
</script>
