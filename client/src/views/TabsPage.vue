<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button
          tab="restaurants"
          href="/tabs/restaurants"
        >
          <ion-icon
            :icon="restaurantOutline"
            aria-hidden="true"
          />
          <ion-label>Restaurants</ion-label>
        </ion-tab-button>
        <ion-tab-button
          tab="shared"
          href="/tabs/shared"
        >
          <ion-icon
            :icon="peopleOutline"
            aria-hidden="true"
          />
          <ion-label>Shared</ion-label>
        </ion-tab-button>
        <ion-tab-button
          tab="friends"
          href="/tabs/friends"
        >
          <ion-icon
            :icon="personAddOutline"
            aria-hidden="true"
          />
          <ion-label>Friends</ion-label>
        </ion-tab-button>
        <ion-tab-button
          tab="profile"
          href="/tabs/profile"
        >
          <ion-icon
            :icon="personOutline"
            aria-hidden="true"
          />
          <ion-label>Profile</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonTabs, IonRouterOutlet, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/vue';
import { restaurantOutline, peopleOutline, personAddOutline, personOutline } from 'ionicons/icons';
</script>
