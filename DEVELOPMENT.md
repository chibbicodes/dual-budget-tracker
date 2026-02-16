# Development Guide — Dual Budget Tracker Monorepo

This repository contains the desktop (Electron) and mobile (iOS/Expo) versions of
the Dual Budget Tracker, with shared business logic in a single package.

## Repository Structure

```
dual-budget-tracker/
├── packages/
│   └── shared/              # Shared business logic (types, calculations, sync, Firebase)
├── apps/
│   └── mobile/              # iOS app (Expo/React Native)
├── src/                     # Desktop app (Electron + React)
├── electron/                # Electron main process
├── package.json             # Workspace root + desktop dependencies
└── DEVELOPMENT.md           # This file
```

## Prerequisites

- **Node.js** 18+ and npm 9+
- **Xcode** 15+ (for iOS builds — macOS only)
- **CocoaPods** (`sudo gem install cocoapods`)
- **Expo CLI** (`npx expo` — no global install needed)
- Firebase project configured (see `.env.example` files)

## Initial Setup

```bash
# Install all workspace dependencies (root, shared, mobile)
npm install

# Install iOS native dependencies
cd apps/mobile && npx expo prebuild --platform ios && cd ios && pod install && cd ../../..
```

## Running the Apps

### Desktop (Electron)
```bash
# Development
npm run dev

# Production build
npm run build

# Package for macOS
npm run build:mac
```

### Mobile (iOS)
```bash
# Development in iOS Simulator
cd apps/mobile
npx expo run:ios

# Or use Expo Go for quick testing
npx expo start
```

---

## Making Changes

### Changes that affect BOTH apps (shared logic)

Edit files in `packages/shared/src/`. Both apps import from this package.

**Examples:** Changing how suggested budget is calculated, modifying data types,
updating default categories, changing sync logic.

```bash
# 1. Edit the file in packages/shared/src/
# 2. Verify desktop still compiles
npm run build --prefix .   # or: npx tsc --noEmit
# 3. Verify mobile still compiles
cd apps/mobile && npx tsc --noEmit
# 4. Run the validation script
./scripts/validate.sh
```

**Key shared files:**
| What | File |
|------|------|
| Types & interfaces | `packages/shared/src/types/index.ts` |
| Budget calculations | `packages/shared/src/utils/calculations.ts` |
| Income projections | `packages/shared/src/utils/incomeCalculations.ts` |
| Default categories | `packages/shared/src/data/defaultCategories.ts` |
| Firebase config | `packages/shared/src/services/firebase/config.ts` |
| Firebase auth | `packages/shared/src/services/firebase/auth.ts` |
| Firestore sync | `packages/shared/src/services/firebase/firestore.ts` |
| Sync orchestration | `packages/shared/src/services/syncService.ts` |
| DB data converters | `packages/shared/src/services/dataConverters.ts` |

### Changes that only affect DESKTOP

Edit files in `src/` (React pages/components) or `electron/` (main process).
The desktop's `src/types/`, `src/utils/`, `src/data/`, and `src/services/dataConverters.ts`
are thin re-exports from `@dual-budget/shared` — do NOT edit those directly.

```bash
# After editing desktop-only files:
npx tsc --noEmit
npm run dev   # to test
```

### Changes that only affect MOBILE

Edit files in `apps/mobile/`.

```bash
# After editing mobile-only files:
cd apps/mobile && npx tsc --noEmit
npx expo run:ios   # to test
```

---

## Testing After Changes

Run the validation script from the repo root:

```bash
./scripts/validate.sh
```

This checks:
1. Shared package compiles
2. Desktop app compiles
3. Mobile app compiles
4. Shared logic is consistent (no duplicate definitions)

---

## Sync Architecture

Both apps use the same sync strategy:

```
Local SQLite ←→ Shared SyncService ←→ Firebase Firestore
```

- **Desktop** uses `better-sqlite3` (via Electron IPC)
- **Mobile** uses `expo-sqlite`
- Both implement the same `DatabaseAdapter` interface from the shared package
- Same Firebase project, same Firestore collections, same data format
- Conflict resolution: last-write-wins based on `updatedAt` timestamps

---

## Environment Variables

### Desktop (.env in root)
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Mobile (apps/mobile/.env)
```
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
```

Both apps connect to the **same Firebase project**.

---

## iOS Deployment

### TestFlight (personal use)
1. Open `apps/mobile/ios/DualBudgetTracker.xcworkspace` in Xcode
2. Set your Apple Developer team in Signing & Capabilities
3. Product → Archive → Distribute App → TestFlight

### App Store
You'll need:
- Apple Developer Program membership ($99/year)
- App Store Connect account
- App icons (1024×1024 for store, plus device sizes)
- Privacy policy URL
- Screenshots for iPhone and iPad

### Provisioning (Expo EAS Build — alternative)
```bash
npx eas build --platform ios --profile production
npx eas submit --platform ios
```

---

## Adding New Entity Types

If you add a new data type (e.g., "budgetGoals"):
1. Add the TypeScript interface in `packages/shared/src/types/index.ts`
2. Add the SQLite table in both:
   - `electron/services/database/schema.ts` (desktop)
   - `apps/mobile/services/database.ts` (mobile)
3. Add data converter in `packages/shared/src/services/dataConverters.ts`
4. Add sync methods in `packages/shared/src/services/syncService.ts`
5. Add CRUD in both database service implementations
6. Add to BudgetContext in both `src/contexts/BudgetContext.tsx` and `apps/mobile/contexts/BudgetContext.tsx`
