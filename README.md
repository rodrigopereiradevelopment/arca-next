# 🚀 ARCA Next — API Backend

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://arca-next.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)](https://supabase.com)
API backend do ecossistema **ARCA** — ponte entre o banco de dados (Supabase/MongoDB) e o aplicativo mobile. Gerencia catálogo de produtos, preços, mercados, usuários e autenticação.

> 🔗 **App Mobile:** [arca-ionic](https://github.com/rodrigopereiradevelopment/arca-ionic)
> 🕷️ **Scraper:** [arca-scraper](https://github.com/rodrigopereiradevelopment/arca-scraper)
> 🌐 **Produção:** https://arca-next.vercel.app

---

## 🏗️ Arquitetura

```
arca-scraper (Python)
       ↓
MongoDB Atlas (Bronze) → ETL → Supabase PostgreSQL (Gold)
                                        ↓
                              arca-next (Vercel) ← ESTE REPO
                                        ↓
                              arca-ionic (App Mobile)
```

- **Supabase HTTP** — todas as rotas usam `getSupabaseServerClient()` diretamente

---

## 📡 Endpoints da API

### Produtos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/produtos` | Lista produtos (paginado, busca, filtro categoria) |
| `POST` | `/api/produtos` | Cria produto (auth admin/moderador) |
| `PUT` | `/api/produtos` | Atualiza produto (auth admin/moderador) |
| `DELETE` | `/api/produtos` | Soft delete (auth admin/moderador) |
| `GET` | `/api/produtos/precos` | Lista preços por produto ou 20 mais recentes |
| `GET` | `/api/produtos/search?q={termo}` | Busca fuzzy por nome (pg_trgm) |

### Categorias

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/categorias` | Lista todas as categorias |
| `POST` | `/api/categorias` | Cria categoria (auth admin/moderador) |
| `PUT` | `/api/categorias` | Atualiza categoria (auth admin/moderador) |
| `DELETE` | `/api/categorias` | Exclui categoria (auth admin/moderador) |

### Mercados

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/mercados` | Lista mercados |
| `POST` | `/api/mercados` | Cria mercado com geocoding (Nominatim) |
| `PUT` | `/api/mercados` | Atualiza mercado |
| `DELETE` | `/api/mercados` | Exclui mercado (apenas admin) |

### Auth

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/auth/login` | Login com email e senha |
| `POST` | `/api/auth/cadastro` | Cadastro de novo usuário |
| `POST` | `/api/auth/logout` | Encerra sessão |

### Utilitários

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/health` | Status da API |
| `POST` | `/api/chat` | Assistente IA (Gemini) |

### Exemplos

```bash
# Busca fuzzy
curl https://arca-next.vercel.app/api/produtos/search?q=arroz

# Lista produtos (paginado, com filtro)
curl "https://arca-next.vercel.app/api/produtos?page=1&limit=20&busca=arroz&categoria_id=5"

# Preços de um produto
curl "https://arca-next.vercel.app/api/produtos/precos?produto_id=189080"

# Status da API
curl https://arca-next.vercel.app/api/health
# {"ok":true,"service":"arca-api","timestamp":"..."}
```

---

## ⚙️ Configuração Local

```bash
git clone https://github.com/rodrigopereiradevelopment/arca-next.git
cd arca-next
npm install
```

Crie `.env.local`:

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=arca_bronze

NEXT_PUBLIC_SUPABASE_URL=https://seuprojeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key

GEMINI_API_KEY=sua_chave_gemini
SYNC_SECRET=seu_secret
DATABASE_URL=postgresql://...
```

```bash
npm run dev
# http://localhost:3000
```

> ⚠️ Use `npm run dev` (--webpack), **não** turbopack.

---

## ☁️ Deploy (Vercel)

1. Importe o repositório no [vercel.com](https://vercel.com)
2. Configure as variáveis de ambiente
3. Deploy automático a cada `git push`

---

## 🗄️ Banco de Dados (Supabase)

Principais tabelas:

| Tabela | Descrição |
|--------|-----------|
| `produtos` | Catálogo com ~57.000 produtos (inclui categorias e upload de imagem) |
| `categorias` | Categorias de produtos (FK em produtos) |
| `precos` | Histórico de preços por mercado |
| `supermercados` | 6 mercados com coordenadas reais, status e logo |
| `perfis` | Usuários, permissões (admin, moderador, usuario) |

**Extensão pg_trgm** habilitada para busca fuzzy:

```sql
-- Busca por similaridade
SELECT * FROM buscar_produtos('acucar uniao');

-- Preço similar por nome
SELECT * FROM buscar_preco_similar('arroz 5kg', 1);
```

---

## 📁 Estrutura

```
arca-next/
├── app/
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── cadastro/route.ts
│       │   └── logout/route.ts
│       ├── produtos/
│       │   ├── route.ts              # CRUD + paginação + busca
│       │   ├── precos/route.ts       # Preços por produto ou recentes
│       │   ├── search/route.ts       # Busca fuzzy
│       │   └── preco-similar/route.ts
│       ├── categorias/route.ts       # CRUD categorias
│       ├── mercados/route.ts         # CRUD mercados + geocoding
│       ├── chat/route.ts             # Assistente IA
│       └── health/route.ts
├── lib/
│   └── db/
│       ├── mongodb.ts
│       └── supabase.ts              # getSupabaseServerClient()
└── .env.local
```

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|------------|-----|
| Next.js 16 | Framework (App Router, --webpack) |
| TypeScript | Linguagem |
| Supabase | PostgreSQL + Auth via HTTP |

| MongoDB | Dados brutos (Bronze) |
| pg_trgm | Busca fuzzy |
| Google Gemini | Assistente IA |
| Nominatim | Geocoding de mercados |
| Vercel | Deploy e hospedagem |

---

## 🔐 Autenticação

- **Admin/Moderador**: Token via `Authorization: Bearer` + body fallback
- `isAdminOrModerador()` — verifica role no Supabase
- CORS com OPTIONS explícito para PUT/DELETE
- Token armazenado em localStorage (`arca_usuario`)

---

## 👨‍🎓 Equipe

TCC — ETEC Pedro Ferreira Alves — Mogi Mirim/SP — 2025/2026

| Nome | Papel |
|------|-------|
| Rodrigo Pereira | Desenvolvedor Full Stack |
| Bruno | Colaborador |
| Miguel | Colaborador |
| Félix | Colaborador |

**Orientador:** Prof. Maurício Aparecido das Neves

📝 **Licença:** MIT
