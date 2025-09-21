# SQLite Setup (Fácil e Grátis)

Este projeto suporta SQLite como backend de storage para tickets, painéis, webhooks, configs e logs. É simples de usar e não precisa de contas externas.

## Ativar SQLite

Defina a variável de ambiente:

- `STORAGE_BACKEND=sqlite`

Opcionalmente, para controlar onde fica o ficheiro da base de dados:

- `DATA_DIR` (pasta base, por defeito `./data`)
- `SQLITE_DB_FILE` (ficheiro da DB, por defeito `./data/ignis.db`)

## Railway (Volume Persistente)

Para manter dados entre deploys no Railway, crie um Volume e monte-o no caminho da app (ex.: `/app/data`). Depois defina:

- `STORAGE_BACKEND=sqlite`
- `DATA_DIR=/app/data`

O ficheiro final ficará em `/app/data/ignis.db` e será persistente no Volume.

## Backup & Export

Criei um utilitário de backup:

```powershell
npm run backup
```

Resultados (pasta `data/backups/`):

- `sqlite-backup-<timestamp>.json` — dump JSON dos dados
- `sqlite-db-<timestamp>.db` — cópia raw do ficheiro `.db`

Se estiveres a usar JSON storage, é criado um `json-storage-backup-<timestamp>.json`.
Se estiveres com Mongo conectado, é criado um `mongo-export-<timestamp>.json`.

## Migração entre backends

De SQLite -> Mongo:

```powershell
setx MONGO_URI "<a tua URI Mongo>"
npm run migrate:sqlite-to-mongo
```

De Mongo -> SQLite:

```powershell
setx MONGO_URI "<a tua URI Mongo>"
npm run migrate:mongo-to-sqlite
```

Notas:

- As migrações fazem upsert/replace simples. Recomenda-se backup antes.
- Para produção, usa um Volume no Railway e `DATA_DIR` para garantir persistência dos dados SQLite.

Arranque rápido (Windows PowerShell)

```powershell
$env:STORAGE_BACKEND = 'sqlite'; $env:DATA_DIR = "$PWD/data"; npm run start:local
```

Variáveis Railway recomendadas

- `STORAGE_BACKEND=sqlite`
- `DATA_DIR=/app/data`
