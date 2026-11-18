# THE KLAB MGT

Internal contract and accounting calendar (prototype).

## Current status
- `index.html` is an interactive browser prototype using **localStorage**, not PostgreSQL.
- PostgreSQL schema is provisioned on **first initialization of an empty Docker volume**.
- Contract, billing, installments, vouchers, receipts and expenses are represented in the schema.
- Actual receipt file uploads, secure authentication, approval workflow and accountant ZIP export **are not yet implemented**.
- Do not use this prototype for real financial data or personal data.

## Run locally with Docker Compose
1. Install Docker Engine + Compose plugin (or Docker Desktop).
2. Copy `.env.example` to `.env`; change `POSTGRES_PASSWORD` to a strong random password.
3. Run `docker compose up -d --build`.
4. Visit `http://localhost:8080` (or your chosen WEB_PORT).

The database is isolated on an internal Docker network and has **no host port published**. The frontend cannot access PostgreSQL directly. Implement a separately authenticated API before real CRUD operations.

## Database backup / migration
With the containers running, back up from a secure administrator shell (supply password via environment):
```sh
docker compose exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > theklab.dump
```
To restore into a **new empty target database** on the destination Docker host:
```sh
cat theklab.dump | docker compose exec -T db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists'
```
Validate restore in a test environment first. Keep backups outside the repo, encrypted and access-controlled. A database dump does not include uploaded receipt files; back up the future private object-storage volume separately.

## Next implementation steps
1. Backend API with server-side authorization (admin, staff, accountant read-only)
2. Transactions and links between invoices, receipts and payment allocations
3. Protected attachment storage and accountant export with audit logs
4. Production secrets, HTTPS reverse proxy, tests, monitoring and backup policy
