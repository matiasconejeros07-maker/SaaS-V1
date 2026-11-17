#!/usr/bin/env bash
# Ejecuta las pruebas de la base de datos en un Postgres local (sin Docker).
# Uso: bash supabase/tests/run.sh   (requiere psql y un usuario con permiso para crear bases)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-saas_test}
PSQL=${PSQL:-psql}
dropdb --if-exists "$DB" >/dev/null 2>&1 || true
createdb "$DB"
out=$($PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/00_stub_supabase.sql $(ls migrations/*.sql | sort | sed 's/^/-f /') $(ls tests/[1-9]*_test.sql | sort | sed 's/^/-f /') 2>&1)
echo "$out" | grep -E 'NOTICE|^ [A-Z][0-9]|FALLA|ERROR' || true
if echo "$out" | grep -qE 'FALLA|ERROR'; then echo "❌ Pruebas fallidas"; exit 1; fi
echo "✅ Pruebas de base de datos OK"
