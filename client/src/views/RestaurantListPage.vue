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
          data-testid="restaurant-item"
        >
          <ion-label class="ion-text-wrap">
            <h2 data-testid="restaurant-name">
              {{ restaurant.name }}
            </h2>
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
  onIonViewWillEnter,
} from '@ionic/vue';
import { fetchMyRestaurants, type RestaurantSummary } from '@/services/restaurants';

const restaurants = ref<RestaurantSummary[]>([]);
const loading = ref(true);
const errorMessage = ref('');

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
