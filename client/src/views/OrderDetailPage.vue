<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="`/tabs/restaurants/${restaurantId}`" />
          <app-logo />
        </ion-buttons>
        <ion-title data-testid="order-title">
          {{ order ? orderLabel(order) : 'Order' }}
        </ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div
        v-if="loading && !order"
        class="ion-text-center"
      >
        <ion-spinner />
      </div>
      <p
        v-if="errorMessage"
        data-testid="detail-error"
      >
        <ion-text color="danger">
          {{ errorMessage }}
        </ion-text>
      </p>
      <div
        v-if="order"
        class="order-detail"
      >
        <h2
          v-if="order.title"
          data-testid="detail-name"
        >
          {{ order.title }}
        </h2>
        <ion-badge
          v-if="order.isDefault"
          data-testid="detail-default-badge"
        >
          Default
        </ion-badge>
        <ion-list>
          <ion-item
            v-for="(item, i) in order.items"
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
          v-if="order.notes"
          class="notes"
          data-testid="detail-notes"
        >
          {{ order.notes }}
        </p>
        <ion-button
            size="small"
          expand="block"
          data-testid="share-order"
          @click="share"
        >
          <ion-icon
            slot="start"
            :icon="shareOutline"
          />
          Share
        </ion-button>
        <ion-button
          size="small"
          expand="block"
          fill="outline"
          data-testid="text-order"
          @click="textOrder"
        >
          <ion-icon
            slot="start"
            :icon="chatbubbleOutline"
          />
          Text
        </ion-button>
        <ion-button
          size="small"
          expand="block"
          fill="outline"
          data-testid="copy-order"
          @click="copyOrder"
        >
          <ion-icon
            slot="start"
            :icon="copyOutline"
          />
          Copy order
        </ion-button>
        <ion-alert
          :is-open="textAlert.open"
          :header="textAlert.header"
          :message="textAlert.message"
          :buttons="textAlert.buttons"
          data-testid="text-alert"
          @did-dismiss="textAlert.open = false"
        />
        <ion-alert
          :is-open="notesPrompt"
          header="Include notes?"
          message="Add this order's notes to the text message?"
          :buttons="notesAlertButtons"
          data-testid="notes-prompt"
          @did-dismiss="notesPrompt = false"
        />
        <ion-alert
          :is-open="numberPrompt"
          header="Text order"
          message="Enter the phone number to text."
          :inputs="numberAlertInputs"
          :buttons="numberAlertButtons"
          data-testid="number-prompt"
          @did-dismiss="numberPrompt = false"
        />
        <ion-modal
          :is-open="picking"
          :keep-contents-mounted="true"
          data-testid="share-modal"
          @did-dismiss="picking = false"
        >
            <ion-header>
              <ion-toolbar>
                <ion-title>Share order</ion-title>
                <ion-buttons slot="end">
                  <ion-button
                    data-testid="close-share"
                    @click="picking = false"
                  >
                    Close
                  </ion-button>
                </ion-buttons>
              </ion-toolbar>
            </ion-header>
            <ion-content class="ion-padding">
        <ion-list
          data-testid="friend-picker"
        >
          <ion-list-header>Share with friends</ion-list-header>
          <p
            v-if="friends.length === 0"
            data-testid="picker-empty"
          >
            Add friends in the Friends tab to share orders.
          </p>
          <ion-item
            v-for="f in friends"
            :key="f.user.id"
            data-testid="picker-friend"
          >
            <ion-checkbox
              :checked="alreadyShared(f.user.id) || selected.includes(f.user.id)"
              :disabled="alreadyShared(f.user.id)"
              data-testid="picker-checkbox"
              @ion-change="toggle(f.user.id)"
            >
              {{ userLabel(f.user) }}
            </ion-checkbox>
            <ion-note
              v-if="alreadyShared(f.user.id)"
              slot="end"
              data-testid="picker-already-shared"
            >
              Shared
            </ion-note>
          </ion-item>
          <ion-button
            expand="block"
            :disabled="busy || selected.length === 0"
            data-testid="confirm-share"
            @click="confirmShare"
          >
            Share with {{ selected.length }} {{ selected.length === 1 ? 'friend' : 'friends' }}
          </ion-button>
          <ion-button
            expand="block"
            fill="clear"
            data-testid="cancel-share"
            @click="picking = false"
          >
            Cancel
          </ion-button>
        </ion-list>
        <ion-list data-testid="link-options">
          <ion-list-header>Share via link</ion-list-header>
          <ion-item>
            <ion-select
              v-model="linkExpiry"
              label="Expires"
              interface="popover"
              data-testid="link-expiry"
            >
              <ion-select-option
                v-for="opt in LINK_EXPIRY_OPTIONS"
                :key="opt.label"
                :value="opt.label"
              >
                {{ opt.label }}
              </ion-select-option>
            </ion-select>
          </ion-item>
          <ion-button
            expand="block"
            fill="outline"
            :disabled="busy"
            data-testid="create-link"
            @click="createLink"
          >
            Create link
          </ion-button>
          <ion-item
            v-if="newLinkUrl"
            data-testid="new-link"
          >
            <ion-label class="ion-text-wrap">
              <p data-testid="new-link-url">{{ newLinkUrl }}</p>
            </ion-label>
            <ion-button
              slot="end"
              fill="clear"
              data-testid="copy-link"
              @click="copyLink"
            >
              Copy
            </ion-button>
          </ion-item>
          <div
            v-for="l in links"
            :key="l.id"
            data-testid="share-link"
          >
            <ion-item>
              <ion-label class="ion-text-wrap">
                <h3 data-testid="link-status">
                  {{ linkStatus(l) }}
                </h3>
                <p>Opened by {{ l.openers.length }} {{ l.openers.length === 1 ? 'person' : 'people' }}</p>
              </ion-label>
              <ion-button
                v-if="!l.disabled"
                slot="end"
                fill="clear"
                color="danger"
                data-testid="disable-link"
                @click="disableLink(l.id)"
              >
                Disable
              </ion-button>
            </ion-item>
            <ion-item
              v-for="op in l.openers"
              :key="op.user.id"
              lines="none"
              data-testid="link-opener"
            >
              <ion-label>{{ userLabel(op.user) }}</ion-label>
              <ion-note
                v-if="op.revoked"
                slot="end"
                data-testid="opener-removed"
              >
                Removed
              </ion-note>
              <ion-button
                v-else-if="!l.disabled"
                slot="end"
                fill="clear"
                color="danger"
                data-testid="remove-opener"
                @click="removeOpener(l.id, op.user.id)"
              >
                Remove
              </ion-button>
            </ion-item>
          </div>
        </ion-list>
            </ion-content>
        </ion-modal>
        <ion-toast
          :is-open="toast.open"
          :message="toast.message"
          :color="toast.color"
          :duration="2500"
          position="bottom"
          data-testid="share-toast"
          @did-dismiss="toast.open = false"
        />
        <ion-accordion-group
          v-if="shares.length > 0"
          :value="sharedOpen ? 'shared-with' : undefined"
          data-testid="shared-with"
          @ion-change="sharedOpen = $event.detail.value === 'shared-with'"
        >
          <ion-accordion value="shared-with">
            <ion-item
              slot="header"
              data-testid="shared-with-header"
            >
              <ion-label>Shared with</ion-label>
              <ion-badge
                slot="end"
                color="tertiary"
                data-testid="shared-count"
              >
                {{ shares.length }}
              </ion-badge>
            </ion-item>
            <ion-list
              slot="content"
              data-testid="shared-with-list"
            >
              <ion-item
                v-for="s in shares"
                :key="s.id"
                data-testid="shared-with-item"
              >
                <ion-label>
                  {{ userLabel(s.user) }}
                  <ion-note v-if="s.viaLink">via link</ion-note>
                </ion-label>
                <ion-button
                  slot="end"
                  fill="clear"
                  color="danger"
                  data-testid="unshare"
                  @click="unshare(s.id)"
                >
                  Unshare
                </ion-button>
              </ion-item>
            </ion-list>
          </ion-accordion>
        </ion-accordion-group>
        <ion-button
          size="small"
          expand="block"
          fill="outline"
          data-testid="edit-order"
          @click="edit"
        >
          Edit
        </ion-button>
        <ion-button
            size="small"
          v-if="!order.isDefault"
          expand="block"
          fill="outline"
          :disabled="busy"
          data-testid="make-default"
          @click="makeDefault"
        >
          Make default
        </ion-button>
        <ion-button
          size="small"
          expand="block"
          fill="clear"
          color="danger"
          data-testid="delete-order"
          @click="confirmingDelete = true"
        >
          <ion-icon
              slot="start"
              :icon="trashOutline"
          />
          Remove order
        </ion-button>
        <ion-alert
          :is-open="confirmingDelete"
          header="Remove order"
          message="Remove this order?"
          :buttons="deleteAlertButtons"
          data-testid="delete-confirm"
          @did-dismiss="confirmingDelete = false"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onUnmounted, reactive, ref } from 'vue';
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
  IonButton,
  IonIcon,
  IonAlert,
  IonListHeader,
  IonCheckbox,
  IonNote,
  IonToast,
  IonModal,
  IonAccordion,
  IonAccordionGroup,
  IonSelect,
  IonSelectOption,
  onIonViewWillEnter,
} from '@ionic/vue';
import {chatbubbleOutline, copyOutline, shareOutline, trashOutline} from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';
import {
  deleteOrder,
  fetchOrder,
  fetchRestaurant,
  formatCustomization,
  onOrderUpdated,
  orderLabel,
  setDefaultOrder,
  type Order,
} from '@/services/restaurants';
import { fetchFriendships, userLabel, type Friendship } from '@/services/friends';
import {
  LINK_EXPIRY_OPTIONS,
  OFFLINE_SHARE_MESSAGE,
  createShareLink,
  disableShareLink,
  fetchOrderShares,
  fetchShareLinks,
  removeLinkOpener,
  isOffline,
  shareOrder,
  unshareOrder,
  type OrderShare,
  type ShareLink,
} from '@/services/sharing';
import { buildOrderMessage } from '@/services/orderMessage';
import { canText, openComposer, pickContact } from '@/services/native/texting';
import { copyText } from '@/services/native/clipboard';

const props = defineProps<{ id?: string; orderId?: string }>();
const route = useRoute();
const router = useRouter();
const restaurantId = props.id ?? String(route?.params.id);
const orderId = props.orderId ?? String(route?.params.orderId);

const order = ref<Order | null>(null);
const loading = ref(true);
const busy = ref(false);
const errorMessage = ref('');
const confirmingDelete = ref(false);
const deleteAlertButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Remove', role: 'destructive', handler: () => { remove(); } },
];

const picking = ref(false);
const friends = ref<Friendship[]>([]);
const shares = ref<OrderShare[]>([]);
const selected = ref<string[]>([]);
const links = ref<ShareLink[]>([]);
const linkExpiry = ref(LINK_EXPIRY_OPTIONS[1].label);
const newLinkUrl = ref('');
/** Collapsed by default; the accordion's own chevron shows open or closed. */
const sharedOpen = ref(false);
const toast = reactive({ open: false, message: '', color: 'success' as 'success' | 'warning' | 'danger' });

const restaurantName = ref('');
const notesPrompt = ref(false);
const numberPrompt = ref(false);
let pendingMessage = '';
/** What the notes prompt continues with: texting or the "Copy order" button. */
let notesAction: 'text' | 'copy' = 'text';
const afterNotes = (includeNotes: boolean) => {
  void (notesAction === 'copy' ? copyMessage(includeNotes) : continueText(includeNotes));
};
const notesAlertButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'No', handler: () => afterNotes(false) },
  { text: 'Include', handler: () => afterNotes(true) },
];
type AlertButton = { text: string; role?: string; handler?: () => void };
const textAlert = reactive({ open: false, header: '', message: '', buttons: [] as AlertButton[] });
function showTextAlert(header: string, message: string, buttons: AlertButton[] = [{ text: 'OK', role: 'cancel' }]) {
  Object.assign(textAlert, { open: true, header, message, buttons });
}
const CANNOT_SEND = 'The message cannot be sent.';
const numberAlertInputs = [{ name: 'phone', type: 'tel' as const, placeholder: 'Phone number' }];
const numberAlertButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Text', handler: (data: { phone?: string }) => sendTo(data?.phone ?? '') },
];

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

async function loadShares() {
  try {
    shares.value = await fetchOrderShares(orderId);
  } catch {
    // The share list is secondary; keep showing what was loaded before.
  }
}

async function loadLinks() {
  try {
    links.value = await fetchShareLinks(orderId);
  } catch {
    // Secondary, like the share list.
  }
}

function linkStatus(l: ShareLink): string {
  if (l.disabled) return 'Disabled link';
  if (!l.active) return 'Expired link';
  return l.expiresAt ? `Link expires ${new Date(l.expiresAt).toLocaleString()}` : 'Link with no expiry';
}

async function createLink() {
  busy.value = true;
  try {
    const hours = LINK_EXPIRY_OPTIONS.find((o) => o.label === linkExpiry.value)?.hours ?? null;
    const link = await createShareLink(orderId, hours);
    newLinkUrl.value = link.url ?? '';
    showToast('Share link created', 'success');
    await loadLinks();
  } catch (e) {
    showToast(errorText(e, 'Could not create link'), isOffline() ? 'warning' : 'danger');
  } finally {
    busy.value = false;
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(newLinkUrl.value);
    showToast('Link copied', 'success');
  } catch {
    showToast('Could not copy the link', 'danger');
  }
}

async function disableLink(linkId: string) {
  try {
    await disableShareLink(linkId);
    showToast('Link disabled', 'success');
    await Promise.all([loadLinks(), loadShares()]);
  } catch (e) {
    showToast(errorText(e, 'Could not disable link'), 'danger');
  }
}

async function removeOpener(linkId: string, userId: string) {
  try {
    await removeLinkOpener(linkId, userId);
    showToast('Access removed', 'success');
    await Promise.all([loadLinks(), loadShares()]);
  } catch (e) {
    showToast(errorText(e, 'Could not remove access'), 'danger');
  }
}

async function loadRestaurantName() {
  try {
    restaurantName.value = (await fetchRestaurant(restaurantId))?.name ?? restaurantName.value;
  } catch {
    // Keep the name loaded before; the message still describes the order.
  }
}

/** Text an Order: ask about notes (only when there are any), then pick a contact. Works offline; never changes the order. */
function textOrder() {
  startWithNotes('text');
}

/** "Copy order": same notes choice, then copies the prepared message. */
function copyOrder() {
  startWithNotes('copy');
}

function startWithNotes(action: 'text' | 'copy') {
  if (!order.value) return;
  notesAction = action;
  if (order.value.notes?.trim()) notesPrompt.value = true;
  else afterNotes(false);
}

/** Builds the message, or shows an alert and returns null when it cannot be prepared. */
function prepare(includeNotes: boolean): string | null {
  try {
    if (!order.value) throw new Error('No order');
    return buildOrderMessage(order.value, restaurantName.value, { includeNotes });
  } catch {
    showTextAlert('Text order', 'The message could not be prepared.');
    return null;
  }
}

async function copyMessage(includeNotes: boolean) {
  const message = prepare(includeNotes);
  if (message !== null) await copyPrepared(message);
}

async function copyPrepared(message: string) {
  if (await copyText(message)) showTextAlert('Copied', 'The order was copied to the clipboard.');
  else showTextAlert('Copy order', 'The order could not be copied.');
}

async function continueText(includeNotes: boolean) {
  const message = prepare(includeNotes);
  if (message === null) return;
  pendingMessage = message;
  if (!canText()) {
    showTextAlert('Text order', 'This device cannot send text messages. Copy the order instead?', [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Copy', handler: () => { void copyPrepared(message); } },
    ]);
    return;
  }
  let picked;
  try {
    picked = await pickContact();
  } catch {
    showTextAlert('Text order', CANNOT_SEND);
    return;
  }
  if (picked === 'unsupported') numberPrompt.value = true;
  else if (picked === 'denied') showTextAlert('Contacts access denied', `${CANNOT_SEND} Allow contacts access to text an order.`);
  else if (picked === 'no-phone') {
    showTextAlert('No phone number', 'That contact has no phone number. Pick another contact.', [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Pick another', handler: () => { void continueText(includeNotes); } },
    ]);
  } else if (picked) compose(picked.phone, message);
}

function compose(phone: string, message: string) {
  try {
    openComposer(phone, message);
  } catch {
    showTextAlert('Text order', CANNOT_SEND);
  }
}

/** Returns false to keep the number prompt open when no number was entered. */
function sendTo(phone: string): boolean {
  if (!phone.trim() || !pendingMessage) return false;
  compose(phone.trim(), pendingMessage);
  return true;
}

async function load() {
  errorMessage.value = '';
  try {
    order.value = await fetchOrder(orderId);
    await Promise.all([loadShares(), loadRestaurantName()]);
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not load order';
  } finally {
    loading.value = false;
  }
}

function showToast(message: string, color: 'success' | 'warning' | 'danger') {
  toast.message = message;
  toast.color = color;
  toast.open = true;
}

const alreadyShared = (userId: string) => shares.value.some((s) => s.user.id === userId);

function toggle(userId: string) {
  if (alreadyShared(userId)) return;
  selected.value = selected.value.includes(userId)
    ? selected.value.filter((id) => id !== userId)
    : [...selected.value, userId];
}

/** Opens the friend picker; only accepted friends are listed. Sharing needs a connection. */
async function share() {
  if (isOffline()) {
    showToast(OFFLINE_SHARE_MESSAGE, 'warning');
    return;
  }
  try {
    const all = (await fetchFriendships()) ?? [];
    friends.value = all.filter((f) => f.status === 'accepted');
    await Promise.all([loadShares(), loadLinks()]);
    selected.value = [];
    newLinkUrl.value = '';
    picking.value = true;
  } catch (e) {
    showToast(errorText(e, 'Could not load friends'), 'danger');
  }
}

async function confirmShare() {
  if (isOffline()) {
    showToast(OFFLINE_SHARE_MESSAGE, 'warning');
    return;
  }
  busy.value = true;
  try {
    const count = selected.value.length;
    await shareOrder(orderId, selected.value);
    picking.value = false;
    selected.value = [];
    showToast(`Shared with ${count} ${count === 1 ? 'Friend' : 'Friends'}`, 'success');
    await loadShares();
  } catch (e) {
    showToast(errorText(e, 'Could not share order'), 'danger');
  } finally {
    busy.value = false;
  }
}

async function unshare(shareId: string) {
  try {
    const removed = shares.value.find((s) => s.id === shareId);
    await unshareOrder(shareId);
    shares.value = shares.value.filter((s) => s.id !== shareId);
    showToast(`Unshared from ${removed ? userLabel(removed.user) : 'friend'}`, 'success');
  } catch (e) {
    showToast(errorText(e, 'Could not unshare order'), 'danger');
  }
}

function edit() {
  router.push(`/tabs/restaurants/${restaurantId}/orders/${orderId}/edit`);
}

async function makeDefault() {
  busy.value = true;
  errorMessage.value = '';
  try {
    order.value = await setDefaultOrder(orderId);
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not change the default order';
  } finally {
    busy.value = false;
  }
}

async function remove() {
  busy.value = true;
  errorMessage.value = '';
  try {
    await deleteOrder(orderId);
    await router.replace(`/tabs/restaurants/${restaurantId}`);
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Could not remove order';
  } finally {
    busy.value = false;
    confirmingDelete.value = false;
  }
}

// Show a saved edit right away, then reload from the server when the page is entered again.
const stopListening = onOrderUpdated((saved) => {
  if (saved.id === orderId) order.value = saved;
});
onUnmounted(stopListening);

onIonViewWillEnter(load);
load();

defineExpose({
  order, load, makeDefault, remove, share, confirmShare, unshare, toggle, selected, picking, toast, sharedOpen,
  links, linkExpiry, newLinkUrl, createLink, disableLink, removeOpener,
  confirmingDelete, deleteAlertButtons,
  textOrder, continueText, sendTo, notesPrompt, numberPrompt, notesAlertButtons, numberAlertButtons, restaurantName,
  copyOrder, textAlert,
});
</script>

<style scoped>
.order-detail {
  max-width: 640px;
  margin: 0 auto;
  overflow-wrap: anywhere;
  /* Larger text for readability on web and mobile. */
  font-size: 1.15rem;
}

.notes {
  white-space: pre-wrap;
}

.order-detail :deep(h2) {
  font-size: 1.4rem;
}

.order-detail :deep(ion-label),
.order-detail :deep(p) {
  font-size: 1.1rem;
}

/* Larger item names (with quantity) on mobile (phone-width) screens only. */
@media (max-width: 767px) {
  .order-detail :deep(ion-label h3) {
    font-size: 1.35rem;
  }
}
</style>
