<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <app-logo slot="start" />
        <ion-title>Friends</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          v-model="query"
          placeholder="Find by email or phone"
          :debounce="300"
          data-testid="friend-search"
          @ion-input="runSearch"
        />
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
      <p
        v-if="actionMessage"
        data-testid="action-message"
      >
        <ion-text color="danger">
          {{ actionMessage }}
        </ion-text>
      </p>

      <ion-list
        v-if="query.trim()"
        data-testid="search-results"
      >
        <ion-list-header>Search results</ion-list-header>
        <p
          v-if="searched && results.length === 0"
          data-testid="no-results"
        >
          No user found with that email or phone.
        </p>
        <ion-item
          v-for="u in results"
          :key="u.id"
          data-testid="search-result"
        >
          <ion-label>
            <h2>{{ userLabel(u) }}</h2>
            <p>{{ u.email }}</p>
          </ion-label>
          <ion-note
            v-if="relationFor(u.id)"
            slot="end"
            data-testid="search-status"
          >
            {{ relationLabel(relationFor(u.id)!) }}
          </ion-note>
          <ion-button
            v-else
            slot="end"
            data-testid="send-request"
            @click="send(u)"
          >
            Add friend
          </ion-button>
        </ion-item>
      </ion-list>

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
      <template v-else>
        <ion-list
          v-if="received.length > 0"
          data-testid="received-list"
        >
          <ion-list-header>Requests received</ion-list-header>
          <ion-item
            v-for="f in received"
            :key="f.id"
            data-testid="received-item"
          >
            <ion-label>{{ userLabel(f.user) }}</ion-label>
            <ion-button
              slot="end"
              data-testid="accept"
              @click="act(() => acceptFriendRequest(f.id))"
            >
              Accept
            </ion-button>
            <ion-button
              slot="end"
              fill="outline"
              data-testid="decline"
              @click="act(() => removeFriendship(f.id))"
            >
              Decline
            </ion-button>
          </ion-item>
        </ion-list>
        <ion-list
          v-if="sent.length > 0"
          data-testid="sent-list"
        >
          <ion-list-header>Requests sent</ion-list-header>
          <ion-item
            v-for="f in sent"
            :key="f.id"
            data-testid="sent-item"
          >
            <ion-label>{{ userLabel(f.user) }}</ion-label>
            <ion-button
              slot="end"
              fill="outline"
              data-testid="cancel"
              @click="act(() => removeFriendship(f.id))"
            >
              Cancel
            </ion-button>
          </ion-item>
        </ion-list>
        <ion-list data-testid="friend-list">
          <ion-list-header>Friends</ion-list-header>
          <p
            v-if="friends.length === 0"
            data-testid="no-friends"
          >
            No friends yet. Search by email or phone to add one.
          </p>
          <ion-item
            v-for="f in friends"
            :key="f.id"
            data-testid="friend-item"
          >
            <ion-label>
              <h2>{{ userLabel(f.user) }}</h2>
              <p>{{ f.user.email }}</p>
            </ion-label>
            <ion-button
              slot="end"
              fill="clear"
              color="danger"
              data-testid="remove-friend"
              @click="act(() => removeFriendship(f.id))"
            >
              Remove
            </ion-button>
          </ion-item>
        </ion-list>
      </template>
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
  IonNote,
  IonButton,
  IonSpinner,
  IonText,
  IonSearchbar,
  IonRefresher,
  IonRefresherContent,
  onIonViewWillEnter,
} from '@ionic/vue';
import {
  acceptFriendRequest,
  fetchFriendships,
  removeFriendship,
  searchUsers,
  sendFriendRequest,
  userLabel,
  type Friendship,
  type PublicUser,
} from '@/services/friends';

const OFFLINE_MESSAGE = 'You are offline. A connection is needed to refresh the list.';

const friendships = ref<Friendship[]>([]);
const loading = ref(true);
const loaded = ref(false);
const errorMessage = ref('');
const refreshMessage = ref('');
const actionMessage = ref('');
const query = ref('');
const results = ref<PublicUser[]>([]);
const searched = ref(false);

const friends = computed(() => friendships.value.filter((f) => f.status === 'accepted'));
const received = computed(() => friendships.value.filter((f) => f.status === 'pending' && f.direction === 'incoming'));
const sent = computed(() => friendships.value.filter((f) => f.status === 'pending' && f.direction === 'outgoing'));

function relationFor(userId: string): Friendship | undefined {
  return friendships.value.find((f) => f.user.id === userId);
}

function relationLabel(f: Friendship): string {
  if (f.status === 'accepted') return 'Friend';
  return f.direction === 'outgoing' ? 'Request sent' : 'Request received';
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Reloads the list; a failed or offline refresh keeps the shown list and displays a message. */
async function load() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (loaded.value) refreshMessage.value = OFFLINE_MESSAGE;
    else errorMessage.value = OFFLINE_MESSAGE;
    loading.value = false;
    return;
  }
  try {
    friendships.value = await fetchFriendships();
    loaded.value = true;
    errorMessage.value = '';
    refreshMessage.value = '';
  } catch (e) {
    const message = errorText(e, 'Could not load friends');
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

async function runSearch() {
  actionMessage.value = '';
  const q = query.value;
  try {
    const found = await searchUsers(q);
    if (q !== query.value) return;
    results.value = found;
    searched.value = !!q.trim();
  } catch (e) {
    actionMessage.value = errorText(e, 'Search failed');
  }
}

async function act(action: () => Promise<unknown>) {
  actionMessage.value = '';
  try {
    await action();
  } catch (e) {
    actionMessage.value = errorText(e, 'Something went wrong');
  }
  await load();
}

function send(u: PublicUser) {
  return act(() => sendFriendRequest(u.id));
}

onIonViewWillEnter(load);
load();

defineExpose({ load, onRefresh, runSearch, query });
</script>
