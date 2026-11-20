<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/restaurants" />
        </ion-buttons>
        <ion-title>Add order</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <form
        data-testid="add-order-form"
        @submit.prevent="submit"
      >
        <ion-input
          v-model="restaurantName"
          label="Restaurant"
          label-placement="stacked"
          placeholder="e.g. Taco Spot"
          data-testid="restaurant-input"
        />
        <ion-input
          v-model="title"
          label="Order name (optional)"
          label-placement="stacked"
          data-testid="title-input"
        />
        <ion-textarea
          v-model="itemsText"
          label="Items (one per line)"
          label-placement="stacked"
          :auto-grow="true"
          data-testid="items-input"
        />
        <ion-textarea
          v-model="notes"
          label="Notes (optional)"
          label-placement="stacked"
          data-testid="notes-input"
        />
        <p
          v-if="errorMessage"
          data-testid="save-error"
        >
          <ion-text color="danger">
            {{ errorMessage }}
          </ion-text>
        </p>
        <ion-button
          type="submit"
          expand="block"
          :disabled="saving"
          data-testid="save-order"
        >
          Save order
        </ion-button>
      </form>
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
  IonInput,
  IonTextarea,
  IonButton,
  IonText,
} from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { saveOrder } from '@/services/restaurants';

const route = useRoute();
const router = useRouter();

const restaurantName = ref(typeof route?.query.restaurant === 'string' ? route.query.restaurant : '');
const title = ref('');
const itemsText = ref('');
const notes = ref('');
const saving = ref(false);
const errorMessage = ref('');

async function submit() {
  errorMessage.value = '';
  const name = restaurantName.value.trim();
  const items = itemsText.value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!name) {
    errorMessage.value = 'Enter a restaurant name.';
    return;
  }
  if (items.length === 0) {
    errorMessage.value = 'Add at least one item.';
    return;
  }
  saving.value = true;
  try {
    const order = await saveOrder({
      restaurantName: name,
      title: title.value.trim() || undefined,
      items,
      notes: notes.value.trim() || undefined,
    });
    await router.replace(`/tabs/restaurants/${order.restaurantId}`);
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not save order';
  } finally {
    saving.value = false;
  }
}

defineExpose({ restaurantName, title, itemsText, notes, submit });
</script>
