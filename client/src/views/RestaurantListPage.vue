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
      <div
        v-else-if="restaurants.length === 0"
        class="ion-text-center"
        data-testid="empty-state"
      >
        <p>No restaurants yet. Add your first favorite order to get started.</p>
        <ion-button
          data-testid="empty-add-order"
          @click="addOrder"
        >
          Add your first order
        </ion-button>
      </div>
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
          <ion-label class="ion-text-wrap restaurant-label">
            <h2
              class="restaurant-name"
              :title="restaurant.name"
              data-testid="restaurant-name"
            >
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
            <template v-else>
              <p data-testid="preview-fallback">
                No orders yet. Tap to add one.
              </p>
              <ion-button
                size="small"
                fill="outline"
                data-testid="empty-entry-add-order"
                @click.stop="addOrderAt(restaurant)"
              >
                Add order
              </ion-button>
            </template>
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
  IonButton,
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

function addOrderAt(restaurant: RestaurantSummary) {
  router.push({ path: '/tabs/restaurants/new-order', query: { restaurantId: restaurant.id, restaurant: restaurant.name } });
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

<style scoped>
.restaurant-label {
  min-width: 0;
}

/* Long names wrap at any character and are clamped to two lines so the entry keeps its layout. */
.restaurant-name {
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
