<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/shared" />
          <app-logo />
        </ion-buttons>
        <ion-title data-testid="shared-title">
          {{ shared ? orderLabel(shared.order) : 'Shared order' }}
        </ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div
        v-if="loading && !shared"
        class="ion-text-center"
      >
        <ion-spinner />
      </div>
      <p
        v-if="errorMessage"
        data-testid="shared-error"
      >
        <ion-text color="danger">
          {{ errorMessage }}
        </ion-text>
      </p>
      <div
        v-if="shared"
        class="order-detail"
      >
        <p data-testid="shared-meta">
          {{ shared.restaurantName }} · shared by {{ userLabel(shared.sharedBy) }}
        </p>
        <h2
          v-if="shared.order.title"
          data-testid="detail-name"
        >
          {{ shared.order.title }}
        </h2>
        <ion-list>
          <ion-item
            v-for="(item, i) in shared.order.items"
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
          v-if="shared.order.notes"
          class="notes"
          data-testid="detail-notes"
        >
          {{ shared.order.notes }}
        </p>
        <ion-button
          expand="block"
          :disabled="busy"
          data-testid="save-copy"
          @click="saveCopy"
        >
          Save to my orders
        </ion-button>
        <p
          v-if="saveMessage"
          data-testid="save-message"
        >
          <ion-text color="success">
            {{ saveMessage }}
          </ion-text>
        </p>
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
  IonSpinner,
  IonText,
  IonButton,
  onIonViewWillEnter,
} from '@ionic/vue';
import { useRoute } from 'vue-router';
import { formatCustomization, orderLabel } from '@/services/restaurants';
import { userLabel } from '@/services/friends';
import { fetchSharedOrders, saveSharedOrder, type SharedOrder } from '@/services/sharing';

const props = defineProps<{ shareId?: string }>();
const route = useRoute();
const shareId = props.shareId ?? String(route?.params.shareId);

const shared = ref<SharedOrder | null>(null);
const loading = ref(true);
const busy = ref(false);
const errorMessage = ref('');
const saveMessage = ref('');

/** Read-only view of the owner's latest version; it is gone once the owner deletes or unshares it. */
async function load() {
  try {
    const found = (await fetchSharedOrders()).find((s) => s.shareId === shareId) ?? null;
    shared.value = found;
    errorMessage.value = found ? '' : 'This order is no longer shared with you.';
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not load shared order';
  } finally {
    loading.value = false;
  }
}

async function saveCopy() {
  busy.value = true;
  errorMessage.value = '';
  saveMessage.value = '';
  try {
    await saveSharedOrder(shareId);
    saveMessage.value = `Saved to your orders at ${shared.value?.restaurantName ?? 'the restaurant'}`;
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not save order';
  } finally {
    busy.value = false;
  }
}

onIonViewWillEnter(load);
load();

defineExpose({ shared, load, saveCopy });
</script>

<style scoped>
.order-detail {
  max-width: 640px;
  margin: 0 auto;
  overflow-wrap: anywhere;
  font-size: 1.15rem;
}

.notes {
  white-space: pre-wrap;
}
</style>
