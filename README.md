# ARCA Next.js Backend

API backend do projeto ARCA — comparador de preços de supermercados de Mogi Mirim.

## Arquitetura

Coleta (Python scraper) → MongoDB (dados brutos) → ETL → Supabase (dados tratados) → este backend → App Ionic

## Variáveis de ambiente (`.env.local`)
```env
MONGODB_URI=...
MONGODB_DB_NAME=arca
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
```

## Endpoints

- `GET /api/health` — status da API
- `POST /api/produtos` — salva produto bruto no MongoDB
- `GET /api/produtos?limit=20` — lista produtos tratados do Supabase
- `POST /api/setup-test` — insere dado de teste ponta a ponta

## Rodar localmente
```bash
npm run dev
```