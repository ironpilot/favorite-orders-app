<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <app-logo slot="start" />
        <ion-title>Shared Orders</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment
          :value="grouping"
          data-testid="grouping"
          @ion-change="grouping = ($event.detail.value as SharedGrouping)"
        >
          <ion-segment-button value="restaurant">
            <ion-label>By Restaurant</ion-label>
          </ion-segment-button>
          <ion-segment-button value="person">
            <ion-label>By Person</ion-label>
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
        v-else-if="shared.length === 0"
        data-testid="no-shared"
      >
        Orders shared by your friends will appear here.
      </p>
      <ion-list
        v-for="group in groups"
        v-else
        :key="group.key"
        data-testid="shared-group"
      >
        <ion-list-header data-testid="shared-group-label">
          {{ group.label }}
        </ion-list-header>
        <ion-item
          v-for="s in group.orders"
          :key="s.shareId"
          button
          detail
          :router-link="`/tabs/shared/${s.shareId}`"
          data-testid="shared-item"
        >
          <ion-label class="ion-text-wrap">
            <h3>{{ orderLabel(s.order) }}</h3>
            <p>{{ grouping === 'restaurant' ? `From ${userLabel(s.sharedBy)}` : s.restaurantName }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonSegment,
  IonSegmentButton,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
} from '@ionic/vue';
import { orderLabel } from '@/services/restaurants';
import { userLabel } from '@/services/friends';
import { fetchSharedOrders, groupSharedOrders, isOffline, type SharedGrouping, type SharedOrder } from '@/services/sharing';

const OFFLINE_MESSAGE = 'You are offline. A connection is needed to refresh the list.';

const shared = ref<SharedOrder[]>([]);
const grouping = ref<SharedGrouping>('restaurant');
const loading = ref(true);
const loaded = ref(false);
const errorMessage = ref('');
const refreshMessage = ref('');

const groups = computed(() => groupSharedOrders(shared.value, grouping.value));

/** Reloads the list; a failed or offline refresh keeps the shown list and displays a message. */
async function load() {
  if (isOffline()) {
    if (loaded.value) refreshMessage.value = OFFLINE_MESSAGE;
    else errorMessage.value = OFFLINE_MESSAGE;
    loading.value = false;
    return;
  }
  try {
    shared.value = await fetchSharedOrders();
    loaded.value = true;
    errorMessage.value = '';
    refreshMessage.value = '';
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not load shared orders';
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

onIonViewWillEnter(load);
load();

defineExpose({ load, onRefresh, grouping });
</script>
