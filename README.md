# Favorite Order App

Save your favorite restaurant orders and share them with friends and family. Orders are private until you share them, and shared orders show up in a separate Shared tab.

## Project structure

- `client/` - Vue 3 + Ionic front end (Vite, TypeScript, Vitest, ESLint).
- `server/` - Node.js + SQLite REST API.
- `docs/` - Specs and feature documents (see `docs/spec.md` and `docs/features.md`).

## Prerequisites

- Node.js 22.13 or newer
- npm

## Install

```bash
cd client && npm install
cd ../server && npm install
```

## Start the servers

Run each in its own terminal.

API server (default http://localhost:3000):

```bash
cd server
npm start        # or: npm run dev  (restarts on file changes)
```

Client dev server (Vite, default http://localhost:5173):

```bash
cd client
npm run dev
```

### Configuration

Server environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API port |
| `DATABASE_PATH` | `data/app.db` | SQLite database file |
| `ADMIN_RESTAURANTS` | none | Comma-separated admin-owned restaurants, e.g. `Taco Bell,Subway` |

Client environment variable:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | Base URL of the API |

## Build

```bash
cd client
npm run build    # type-checks with vue-tsc, then builds to client/dist
npm run preview  # serve the production build locally
```

The server needs no build step.

## Native builds (Capacitor)

The client is wrapped with CapacitorJS (`client/capacitor.config.ts`, app id `com.favoriteorders.app`). The native projects are in `client/android` and `client/ios`.

```bash
cd client
npm run cap:sync     # build the web app and copy it into the native projects
npm run cap:android  # sync, then open Android Studio
npm run cap:ios      # sync, then open Xcode (macOS only)
```

Android builds need Android Studio and a JDK. iOS builds need macOS and Xcode. On a device or emulator, set `VITE_API_URL` to an address the device can reach before you build (for example `http://10.0.2.2:3000` on the Android emulator).

## Test, lint and type-check

```bash
# Client
cd client
npm test              # run unit tests once
npm run test:watch    # watch mode
npm run lint          # ESLint (npm run lint:fix to auto-fix)
npm run typecheck

# Server
cd server
npm test              # node --test
```
