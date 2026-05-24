# 🚀 ARCA Next — API Backend

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://arca-next.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)](https://supabase.com)

API backend do ecossistema **ARCA** — ponte entre o banco de dados (Supabase/MongoDB) e o aplicativo mobile.

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

---

## 📡 Endpoints da API

### Produtos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/produtos/search?q={termo}` | Busca fuzzy por nome (pg_trgm) |
| `GET` | `/api/produtos/preco?produtoId={id}&mercadoId={id}` | Preço exato do produto no mercado |
| `GET` | `/api/produtos/preco-similar?nome={nome}&mercadoId={id}` | Busca por similaridade de nome (fallback) |

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

# Preço exato
curl https://arca-next.vercel.app/api/produtos/preco?produtoId=189080&mercadoId=1

# Preço por similaridade de nome
curl https://arca-next.vercel.app/api/produtos/preco-similar?nome=acucar+uniao&mercadoId=1

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
```

```bash
npm run dev
# http://localhost:3000
```

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
| `produtos` | Catálogo com ~57.000 produtos |
| `precos` | Histórico de preços por mercado |
| `supermercados` | 6 mercados com coordenadas reais |
| `perfis` | Usuários e permissões |

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
│       │   ├── search/route.ts       # Busca fuzzy
│       │   ├── preco/route.ts        # Preço exato
│       │   └── preco-similar/route.ts # Fallback similar
│       ├── chat/route.ts             # Assistente IA
│       └── health/route.ts
├── lib/
│   └── db/
│       ├── mongodb.ts
│       └── supabase.ts
└── .env.local
```

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|------------|-----|
| Next.js 15 | Framework (App Router) |
| TypeScript | Linguagem |
| Supabase | PostgreSQL + Auth |
| MongoDB | Dados brutos (Bronze) |
| pg_trgm | Busca fuzzy |
| Google Gemini | Assistente IA |
| Vercel | Deploy e hospedagem |

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
