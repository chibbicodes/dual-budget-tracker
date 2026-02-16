#!/bin/bash
# ============================================================================
# Dual Budget Tracker — Cross-Platform Validation Script
#
# Run from the repository root after any change to verify both apps still work.
# Usage: ./scripts/validate.sh
# ============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

check() {
  local label="$1"
  shift
  printf "  %-50s" "$label"
  if "$@" > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}FAIL${NC}"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "============================================"
echo "  Dual Budget Tracker Validation"
echo "============================================"
echo ""

# --- 1. Shared Package ---
echo -e "${YELLOW}1. Shared Package${NC}"
check "TypeScript compiles" npx tsc --noEmit -p "$ROOT_DIR/packages/shared/tsconfig.json"
check "Index exports exist" test -f "$ROOT_DIR/packages/shared/src/index.ts"
echo ""

# --- 2. Desktop App ---
echo -e "${YELLOW}2. Desktop App (Electron)${NC}"
check "TypeScript compiles" npx tsc --noEmit -p "$ROOT_DIR/tsconfig.json"
check "Vite config exists" test -f "$ROOT_DIR/vite.config.ts"
echo ""

# --- 3. Mobile App ---
echo -e "${YELLOW}3. Mobile App (Expo)${NC}"
check "Package.json exists" test -f "$ROOT_DIR/apps/mobile/package.json"
check "App config exists" test -f "$ROOT_DIR/apps/mobile/app.json"
check "Root layout exists" test -f "$ROOT_DIR/apps/mobile/app/_layout.tsx"
check "Tab layout exists" test -f "$ROOT_DIR/apps/mobile/app/(tabs)/_layout.tsx"
check "Dashboard screen exists" test -f "$ROOT_DIR/apps/mobile/app/(tabs)/index.tsx"
check "Budget screen exists" test -f "$ROOT_DIR/apps/mobile/app/(tabs)/budget.tsx"
check "Transactions screen exists" test -f "$ROOT_DIR/apps/mobile/app/(tabs)/transactions.tsx"
check "Income screen exists" test -f "$ROOT_DIR/apps/mobile/app/(tabs)/income.tsx"
check "Settings screen exists" test -f "$ROOT_DIR/apps/mobile/app/(tabs)/settings.tsx"
check "Database service exists" test -f "$ROOT_DIR/apps/mobile/services/database.ts"
check "BudgetContext exists" test -f "$ROOT_DIR/apps/mobile/contexts/BudgetContext.tsx"
check "ProfileContext exists" test -f "$ROOT_DIR/apps/mobile/contexts/ProfileContext.tsx"
check "AuthContext exists" test -f "$ROOT_DIR/apps/mobile/contexts/AuthContext.tsx"
echo ""

# --- 4. Shared Logic Consistency ---
echo -e "${YELLOW}4. Shared Logic Consistency${NC}"
check "Types re-exported in desktop" grep -q "@dual-budget/shared" "$ROOT_DIR/src/types/index.ts"
check "Calculations re-exported in desktop" grep -q "@dual-budget/shared" "$ROOT_DIR/src/utils/calculations.ts"
check "Income calcs re-exported in desktop" grep -q "@dual-budget/shared" "$ROOT_DIR/src/utils/incomeCalculations.ts"
check "Categories re-exported in desktop" grep -q "@dual-budget/shared" "$ROOT_DIR/src/data/defaultCategories.ts"
check "Converters re-exported in desktop" grep -q "@dual-budget/shared" "$ROOT_DIR/src/services/dataConverters.ts"
check "Mobile imports shared types" grep -rq "@dual-budget/shared" "$ROOT_DIR/apps/mobile/contexts/" 2>/dev/null
check "No duplicate calculateBudgetSummary" test "$(grep -rl 'export function calculateBudgetSummary' "$ROOT_DIR/packages" "$ROOT_DIR/src" 2>/dev/null | wc -l)" -eq 1
echo ""

# --- 5. Sync Compatibility ---
echo -e "${YELLOW}5. Sync Compatibility${NC}"
check "Shared syncService has DatabaseAdapter" grep -q "DatabaseAdapter" "$ROOT_DIR/packages/shared/src/services/syncService.ts"
check "Mobile database implements adapter" test -f "$ROOT_DIR/apps/mobile/services/database.ts"
check "Shared firestore service exists" test -f "$ROOT_DIR/packages/shared/src/services/firebase/firestore.ts"
echo ""

# --- Summary ---
echo "============================================"
TOTAL=$((PASS + FAIL))
echo -e "  Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC} (${TOTAL} total)"
echo "============================================"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
