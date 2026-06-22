# Backup y restore de la base de datos de producción (Neon)

Runbook para respaldar el estado de producción **antes de aplicar migraciones** (ej. el cambio
de lógica de mata-mata `knockout_advancement`). Combina dos estrategias complementarias:

1. **Branch de Neon** — copia instantánea point-in-time dentro de Neon. Rollback en segundos.
2. **`pg_dump` a archivo local** — copia física portable, fuera de la infraestructura de Neon.

> Requisito: tener a mano la `DATABASE_URL` de producción (connection string de Neon, idealmente
> el endpoint **directo/unpooled** para `pg_dump`/`pg_restore`, no el pooled `-pooler`).
> Nunca commitear la `DATABASE_URL` ni los archivos `.dump`.
>
> **Versión de `pg_dump`:** debe ser **≥ a la del servidor**, o aborta con
> `aborting because of server version mismatch`. Neon corre **Postgres 18** (jun-2026), así que
> necesitás `pg_dump` 18+. En Windows: `winget install -e --id PostgreSQL.PostgreSQL.18` e invocá el
> binario por ruta completa (`& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" ...`), porque un
> PostgreSQL viejo puede seguir primero en el `PATH`. El directorio de salida (`~/backups`) debe
> existir antes (`pg_dump` no lo crea).

---

## 1. Branch de Neon (rollback rápido)

### Opción A — Consola web

1. Neon Console → proyecto del prode → pestaña **Branches**.
2. **Create branch**. Source: `main` (o `production`), **point in time = ahora**.
3. Nombre sugerido: `pre-knockout-YYYYMMDD` (ej. `pre-knockout-20260619`).
4. Crear. Queda una copia inmutable del estado actual.

### Opción B — Neon CLI

```bash
# instalar una vez: npm i -g neonctl  (luego: neonctl auth)
neonctl branches create \
  --project-id <PROJECT_ID> \
  --name pre-knockout-20260619 \
  --parent main
```

**Rollback** (si la migración sale mal): apuntar el backend (env `DATABASE_URL` en Render) a la
connection string del branch `pre-knockout-YYYYMMDD`, o desde la consola promover/restaurar ese
branch a `main`. Verificar y redeploy.

---

## 2. `pg_dump` a archivo local (copia portable)

Formato custom (`-Fc`): comprimido y restaurable selectivamente con `pg_restore`.

### Bash / Linux / macOS / Git Bash

```bash
export PROD_DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
STAMP=$(date +%Y%m%d-%H%M)
pg_dump "$PROD_DATABASE_URL" -Fc --no-owner --no-privileges -f "prode-prod-$STAMP.dump"

# (opcional) copia legible en SQL plano para inspección rápida
pg_dump "$PROD_DATABASE_URL" --no-owner --no-privileges -f "prode-prod-$STAMP.sql"
```

### PowerShell (Windows)

```powershell
$env:PROD_DATABASE_URL = "postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
pg_dump $env:PROD_DATABASE_URL -Fc --no-owner --no-privileges -f "prode-prod-$stamp.dump"
```

> Guardar el `.dump` fuera del repo (ej. `~/backups/prode/`). Está cubierto por `.gitignore`
> (`*.dump`, `*.sql.gz`), pero verificá antes de commitear.

### Verificar el dump

```bash
pg_restore --list "prode-prod-$STAMP.dump" | head -n 40   # debe listar tablas Match, Prediction, User, etc.
```

---

## 3. Restore

### A un branch/DB nuevo de Neon (recomendado para probar)

```bash
export RESTORE_DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB_restore?sslmode=require"
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "$RESTORE_DATABASE_URL" "prode-prod-YYYYMMDD-HHMM.dump"
```

### Restaurar SOLO datos (si el esquema ya migró y querés volver datos)

```bash
pg_restore --data-only --disable-triggers --no-owner \
  -d "$RESTORE_DATABASE_URL" "prode-prod-YYYYMMDD-HHMM.dump"
```

> `--clean --if-exists` borra y recrea objetos: usarlo solo contra una DB destinada al restore,
> nunca a ciegas sobre producción viva.

---

## 4. Checklist antes de migrar mata-mata

- [ ] Branch `pre-knockout-YYYYMMDD` creado en Neon.
- [ ] `pg_dump -Fc` descargado y verificado con `pg_restore --list`.
- [ ] Archivo `.dump` guardado fuera del repo.
- [ ] Recién entonces: `npx prisma migrate deploy` contra prod.
- [ ] Post-migración: `POST /admin/fixture/import` para reasignar fases (ROUND_OF_32) y smoke test.
