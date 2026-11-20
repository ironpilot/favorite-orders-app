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
        class="add-order-form"
        @submit.prevent="submit"
      >
        <ion-input
          v-model="restaurantName"
          label="Restaurant"
          label-placement="stacked"
          placeholder="e.g. Taco Spot"
          :maxlength="LIMITS.restaurantName"
          data-testid="restaurant-input"
        />
        <p
          v-if="selectedRestaurant"
          class="hint"
          data-testid="restaurant-picked"
        >
          Saving at existing restaurant{{ selectedRestaurant.adminOwned ? ' (listed by the app)' : '' }}.
        </p>
        <p
          v-else-if="restaurantName.trim()"
          class="hint"
          data-testid="restaurant-new"
        >
          Pick a suggestion, or save to use "{{ restaurantName.trim() }}" as your own restaurant.
        </p>
        <ion-list
          v-if="!selectedRestaurant && restaurantSuggestions.length > 0"
          data-testid="restaurant-suggestions"
        >
          <ion-item
            v-for="s in restaurantSuggestions"
            :key="s.id"
            button
            data-testid="restaurant-suggestion"
            @click="pickRestaurant(s)"
          >
            <ion-label class="ion-text-wrap">
              {{ s.name }}
            </ion-label>
            <ion-note
              v-if="s.adminOwned"
              slot="end"
            >
              Listed
            </ion-note>
          </ion-item>
        </ion-list>
        <ion-input
          v-model="title"
          label="Order name (optional)"
          label-placement="stacked"
          placeholder="e.g. Game night"
          :maxlength="LIMITS.title"
          data-testid="title-input"
        />

        <h2 class="section-title">
          Items
        </h2>
        <p
          v-if="items.length === 0"
          data-testid="no-items"
        >
          No items yet. Add at least one item.
        </p>
        <ion-card
          v-for="(item, i) in items"
          :key="item.key"
          data-testid="order-item-row"
        >
          <ion-card-content>
            <ion-input
              v-model="item.name"
              label="Item"
              label-placement="stacked"
              placeholder="e.g. Hamburger"
              :maxlength="LIMITS.itemName"
              data-testid="item-name-input"
            />
            <div class="quantity-row">
              <span>Quantity</span>
              <ion-button
                fill="outline"
                size="small"
                aria-label="Decrease quantity"
                :disabled="item.quantity <= 1"
                data-testid="quantity-decrease"
                @click="changeQuantity(i, -1)"
              >
                <ion-icon :icon="remove" />
              </ion-button>
              <span
                class="quantity"
                data-testid="item-quantity"
              >{{ item.quantity }}</span>
              <ion-button
                fill="outline"
                size="small"
                aria-label="Increase quantity"
                data-testid="quantity-increase"
                @click="changeQuantity(i, 1)"
              >
                <ion-icon :icon="add" />
              </ion-button>
            </div>

            <div
              v-for="(c, j) in item.customizations"
              :key="c.key"
              class="customization-row"
              data-testid="customization-row"
            >
              <span class="kind-label">{{ KIND_LABELS[c.kind] }}</span>
              <ion-input
                v-model="c.ingredient"
                :aria-label="c.kind === 'substitute' ? 'Use' : 'Ingredient'"
                :placeholder="c.kind === 'substitute' ? 'e.g. Mayonnaise' : 'e.g. Lettuce'"
                :maxlength="LIMITS.ingredient"
                data-testid="customization-ingredient"
                @ion-input="loadToppings(c, 'ingredient')"
                @ion-focus="loadToppings(c, 'ingredient')"
              />
              <template v-if="c.kind === 'substitute'">
                <span class="kind-label">instead of</span>
                <ion-input
                  v-model="c.insteadOf"
                  aria-label="Instead of"
                  placeholder="e.g. Ketchup"
                  :maxlength="LIMITS.ingredient"
                  data-testid="customization-instead-of"
                  @ion-input="loadToppings(c, 'insteadOf')"
                  @ion-focus="loadToppings(c, 'insteadOf')"
                />
              </template>
              <ion-button
                fill="clear"
                color="medium"
                aria-label="Remove customization"
                data-testid="remove-customization"
                @click="removeCustomization(i, j)"
              >
                <ion-icon :icon="close" />
              </ion-button>
              <div
                v-if="toppingTarget?.key === c.key && toppingSuggestions.length > 0"
                class="topping-suggestions"
                data-testid="topping-suggestions"
              >
                <ion-chip
                  v-for="t in toppingSuggestions"
                  :key="t"
                  data-testid="topping-suggestion"
                  @click="pickTopping(t)"
                >
                  {{ t }}
                </ion-chip>
              </div>
            </div>

            <div class="customization-actions">
              <ion-button
                v-for="kind in KINDS"
                :key="kind"
                fill="clear"
                size="small"
                :data-testid="`add-${kind}`"
                @click="addCustomization(i, kind)"
              >
                + {{ KIND_LABELS[kind] }}
              </ion-button>
            </div>
            <ion-button
              fill="clear"
              color="danger"
              size="small"
              data-testid="remove-item"
              @click="removeItem(i)"
            >
              Remove item
            </ion-button>
          </ion-card-content>
        </ion-card>
        <ion-button
          expand="block"
          fill="outline"
          data-testid="add-item"
          @click="addItem"
        >
          <ion-icon
            slot="start"
            :icon="add"
          />
          Add item
        </ion-button>

        <ion-textarea
          v-model="notes"
          label="Notes (optional)"
          label-placement="stacked"
          :auto-grow="true"
          :maxlength="LIMITS.notes"
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
import { ref, watch } from 'vue';
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
  IonCard,
  IonCardContent,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonChip,
} from '@ionic/vue';
import { add, close, remove } from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';
import {
  LIMITS,
  fetchRestaurant,
  saveOrder,
  suggestRestaurants,
  suggestToppings,
  type Restaurant,
  type Customization,
  type CustomizationKind,
  type OrderItem,
} from '@/services/restaurants';

interface CustomizationDraft {
  key: number;
  kind: CustomizationKind;
  ingredient: string;
  insteadOf: string;
}

interface ItemDraft {
  key: number;
  name: string;
  quantity: number;
  customizations: CustomizationDraft[];
}

const KINDS: CustomizationKind[] = ['remove', 'add', 'substitute'];
const KIND_LABELS: Record<CustomizationKind, string> = { remove: 'No', add: 'Add', substitute: 'Substitute' };

const route = useRoute();
const router = useRouter();

let nextKey = 0;
const restaurantName = ref(typeof route?.query.restaurant === 'string' ? route.query.restaurant : '');
const selectedRestaurant = ref<Restaurant | null>(null);
const restaurantSuggestions = ref<Restaurant[]>([]);
const toppingTarget = ref<{ key: number; field: 'ingredient' | 'insteadOf' } | null>(null);
const toppingSuggestions = ref<string[]>([]);
const title = ref('');
const items = ref<ItemDraft[]>([newItem()]);
const notes = ref('');
const saving = ref(false);
const errorMessage = ref('');

let suggestionRequest = 0;

/** Typing changes the restaurant back to a new, user-created one until a suggestion is picked. */
watch(restaurantName, async (value) => {
  if (selectedRestaurant.value && selectedRestaurant.value.name === value) return;
  selectedRestaurant.value = null;
  const q = value.trim();
  const request = ++suggestionRequest;
  if (!q) {
    restaurantSuggestions.value = [];
    return;
  }
  try {
    const found = await suggestRestaurants(q);
    if (request === suggestionRequest) restaurantSuggestions.value = found;
  } catch {
    restaurantSuggestions.value = [];
  }
});

function pickRestaurant(r: Restaurant) {
  selectedRestaurant.value = r;
  restaurantName.value = r.name;
  restaurantSuggestions.value = [];
}

// Opening the form from a restaurant preselects it.
if (typeof route?.query.restaurantId === 'string' && route.query.restaurantId) {
  fetchRestaurant(route.query.restaurantId)
    .then((r) => {
      if (r) pickRestaurant(r);
    })
    .catch(() => undefined);
}

function findCustomization(key: number): CustomizationDraft | undefined {
  for (const item of items.value) {
    const c = item.customizations.find((x) => x.key === key);
    if (c) return c;
  }
  return undefined;
}

async function loadToppings(c: CustomizationDraft, field: 'ingredient' | 'insteadOf') {
  toppingTarget.value = { key: c.key, field };
  try {
    const found = await suggestToppings(c[field].trim());
    if (toppingTarget.value?.key === c.key && toppingTarget.value.field === field) {
      toppingSuggestions.value = found.filter((t) => t !== c[field]);
    }
  } catch {
    toppingSuggestions.value = [];
  }
}

function pickTopping(name: string) {
  const target = toppingTarget.value;
  const c = target && findCustomization(target.key);
  if (c && target) c[target.field] = name;
  toppingTarget.value = null;
  toppingSuggestions.value = [];
}

function newItem(): ItemDraft {
  return { key: nextKey++, name: '', quantity: 1, customizations: [] };
}

function addItem() {
  items.value.push(newItem());
}

function removeItem(index: number) {
  items.value.splice(index, 1);
}

function changeQuantity(index: number, delta: number) {
  const item = items.value[index];
  item.quantity = Math.max(1, item.quantity + delta);
}

function addCustomization(index: number, kind: CustomizationKind) {
  items.value[index].customizations.push({ key: nextKey++, kind, ingredient: '', insteadOf: '' });
}

function removeCustomization(index: number, cIndex: number) {
  items.value[index].customizations.splice(cIndex, 1);
}

/** Converts the drafts to API items; blank rows are skipped. Returns an error message when invalid. */
function buildItems(): OrderItem[] | string {
  const result: OrderItem[] = [];
  for (const draft of items.value) {
    const name = draft.name.trim();
    const customizations: Customization[] = [];
    for (const c of draft.customizations) {
      const ingredient = c.ingredient.trim();
      const insteadOf = c.insteadOf.trim();
      if (!ingredient && !insteadOf) continue;
      if (c.kind === 'substitute' && (!ingredient || !insteadOf)) return 'Complete both parts of each substitution.';
      customizations.push(c.kind === 'substitute' ? { kind: c.kind, ingredient, insteadOf } : { kind: c.kind, ingredient });
    }
    if (!name) {
      if (customizations.length > 0) return 'Each item needs a name.';
      continue;
    }
    result.push({ name, quantity: Math.max(1, Math.floor(draft.quantity) || 1), customizations });
  }
  return result;
}

async function submit() {
  errorMessage.value = '';
  const name = restaurantName.value.trim();
  if (!name) {
    errorMessage.value = 'Enter a restaurant name.';
    return;
  }
  const built = buildItems();
  if (typeof built === 'string') {
    errorMessage.value = built;
    return;
  }
  if (built.length === 0) {
    errorMessage.value = 'Add at least one item.';
    return;
  }
  saving.value = true;
  try {
    const order = await saveOrder({
      ...(selectedRestaurant.value ? { restaurantId: selectedRestaurant.value.id } : { restaurantName: name }),
      title: title.value.trim() || undefined,
      items: built,
      notes: notes.value.trim() || undefined,
    });
    await router.replace(`/tabs/restaurants/${order.restaurantId}`);
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not save order';
  } finally {
    saving.value = false;
  }
}

defineExpose({
  restaurantName, selectedRestaurant, restaurantSuggestions, pickRestaurant, toppingSuggestions, loadToppings, pickTopping,
  title, items, notes, addItem, removeItem, changeQuantity, addCustomization, removeCustomization, submit,
});
</script>

<style scoped>
.add-order-form {
  max-width: 640px;
  margin: 0 auto;
  overflow-wrap: anywhere;
}

.section-title {
  font-size: 1.1rem;
  margin: 16px 0 4px;
}

.quantity-row,
.customization-row,
.customization-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.quantity {
  min-width: 2ch;
  text-align: center;
  font-weight: 600;
}

.customization-row ion-input {
  flex: 1 1 120px;
  min-width: 0;
}

.hint {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin: 4px 0;
}

.topping-suggestions {
  flex-basis: 100%;
  display: flex;
  flex-wrap: wrap;
}

.kind-label {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}
</style>
