<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <app-logo slot="start" />
        <ion-title>Restaurants</ion-title>
      </ion-toolbar>
      <ion-toolbar v-if="restaurants.length > 0">
        <ion-searchbar
          v-model="search"
          placeholder="Search restaurants or items"
          data-testid="search"
        />
      </ion-toolbar>
      <ion-toolbar v-if="restaurants.length > 0">
        <ion-segment
          v-model="sort"
          data-testid="sort"
        >
          <ion-segment-button value="recent">
            <ion-label>Recent</ion-label>
          </ion-segment-button>
          <ion-segment-button value="name">
            <ion-label>A–Z</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-refresher
        slot="fixed"
        data-testid="refresher"
        @ion-refresh="onRefresh"
      >
        <ion-refresher-content />
      </ion-refresher>
      <p
        v-if="refreshMessage"
        data-testid="refresh-message"
      >
        <ion-text color="warning">
          {{ refreshMessage }}
        </ion-text>
      </p>
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
      <p
        v-else-if="visibleRestaurants.length === 0"
        class="ion-text-center"
        data-testid="no-matches"
      >
        No restaurants or items match "{{ search.trim() }}".
      </p>
      <ion-list
        v-else
        data-testid="restaurant-list"
      >
        <ion-item
          v-for="restaurant in visibleRestaurants"
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
            v-if="restaurant.shared"
            slot="end"
            color="tertiary"
            data-testid="shared-pill"
          >
            Shared
          </ion-badge>
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
import { computed, ref, watch } from 'vue';
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
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonRefresher,
  IonRefresherContent,
  onIonViewDidEnter,
} from '@ionic/vue';
import { add } from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchMyRestaurants,
  filterAndSortRestaurants,
  type RestaurantSort,
  type RestaurantSummary,
} from '@/services/restaurants';

const OFFLINE_MESSAGE = 'You are offline. A connection is needed to refresh the list.';

const restaurants = ref<RestaurantSummary[]>([]);
const loading = ref(true);
const loaded = ref(false);
const errorMessage = ref('');
const refreshMessage = ref('');
const search = ref('');
const sort = ref<RestaurantSort>('recent');
const visibleRestaurants = computed(() => filterAndSortRestaurants([...restaurants.value], search.value, sort.value));
const router = useRouter();
const route = useRoute();
const LIST_PATH = '/tabs/restaurants';

function openRestaurant(id: string) {
  router.push(`/tabs/restaurants/${id}`);
}

function addOrder() {
  router.push('/tabs/restaurants/new-order');
}

function addOrderAt(restaurant: RestaurantSummary) {
  router.push({ path: '/tabs/restaurants/new-order', query: { restaurantId: restaurant.id, restaurant: restaurant.name } });
}

/**
 * Reloads the list. Search text and sort are kept. Once a list is shown, a failed or offline
 * refresh keeps it visible and shows a message instead of replacing it.
 */
async function load() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (loaded.value) refreshMessage.value = OFFLINE_MESSAGE;
    else errorMessage.value = OFFLINE_MESSAGE;
    loading.value = false;
    return;
  }
  try {
    restaurants.value = await fetchMyRestaurants();
    loaded.value = true;
    errorMessage.value = '';
    refreshMessage.value = '';
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not load restaurants';
    if (loaded.value) refreshMessage.value = `Could not refresh: ${message}`;
    else errorMessage.value = message;
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

onIonViewDidEnter(load);
load();

// Ionic may not fire view lifecycle hooks when returning after a `router.replace` (e.g. after
// creating an order), so also reload whenever navigation lands back on the list.
watch(
  () => route?.path ?? '',
  (path, previous) => {
    if (path.replace(/\/$/, '') === LIST_PATH && previous !== path) load();
  },
);

defineExpose({ load, onRefresh, search, sort });
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
