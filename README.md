# 🚀 ARCA Next — API Backend

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://arca-next.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)](https://supabase.com)
![Version](https://img.shields.io/badge/version-1.0.4-green)

API backend do ecossistema **ARCA** — ponte entre o banco de dados (Supabase/MongoDB) e o aplicativo mobile. Gerencia catálogo de produtos, preços, mercados, usuários, autenticação, notificações, tickets, upload e mais.

> 📱 **App Mobile:** [arca-ionic](https://github.com/rodrigopereiradevelopment/arca-ionic) — https://arca-ionic.vercel.app
> 🕷️ **Scraper:** [arca-scraper](https://github.com/rodrigopereiradevelopment/arca-scraper)
> 🌐 **API Produção:** https://arca-next.vercel.app

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
- **Prisma ORM** — schema em `prisma/schema.prisma`, singleton global

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
| `GET` | `/api/mercados` | Lista mercados (filtro status) |
| `POST` | `/api/mercados` | Cria mercado com geocoding (Nominatim) |
| `PUT` | `/api/mercados` | Atualiza mercado |
| `DELETE` | `/api/mercados` | Exclui mercado (apenas admin) |

### Comparação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/comparar` | Compara preços entre mercados (dinâmico — query Supabase) |

### Auth

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/auth/login` | Login com email e senha |
| `POST` | `/api/auth/cadastro` | Cadastro de novo usuário |
| `POST` | `/api/auth/logout` | Encerra sessão |
| `POST` | `/api/auth/deletar-conta` | Soft delete (anonimiza + desativa) |
| `GET` | `/api/auth/perfil` | Dados do perfil do usuário |
| `POST` | `/api/auth/perfil` | Atualiza dados do perfil |
| `GET` | `/api/auth/enderecos` | Lista endereços do usuário |
| `POST` | `/api/auth/enderecos` | Cria endereço |
| `PUT` | `/api/auth/enderecos` | Atualiza endereço / definir principal |
| `DELETE` | `/api/auth/enderecos` | Exclui endereço |
| `POST` | `/api/auth/alterar-senha` | Altera senha |

### Notificações

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/notificacoes` | Lista notificações do usuário |
| `POST` | `/api/notificacoes` | Cria notificação |
| `PUT` | `/api/notificacoes` | Marca como lida |
| `DELETE` | `/api/notificacoes` | Remove notificação |

### Histórico

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/historico` | Lista atividades recentes |
| `POST` | `/api/historico` | Registra atividade |
| `DELETE` | `/api/historico` | Limpa histórico do usuário |

### Tickets

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/tickets` | Lista tickets do usuário |
| `POST` | `/api/tickets` | Abre novo ticket |
| `PUT` | `/api/tickets/[id]` | Atualiza status (resolvido) |
| `GET` | `/api/tickets/[id]/mensagens` | Lista mensagens do ticket |
| `POST` | `/api/tickets/[id]/mensagens` | Envia mensagem no ticket |

### Alertas de Preço

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/alertas` | Lista alertas do usuário |
| `PUT` | `/api/alertas` | Ativa/desativa alerta |
| `DELETE` | `/api/alertas` | Remove alerta |

### Upload

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/upload` | Upload (multipart) — `folder: avatars|mercados` |

### Utilitários

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/health` | Status da API |
| `POST` | `/api/chat` | Assistente IA (Gemini) com contexto |
| `GET` | `/api/configuracoes` | Preferências do usuário |
| `PUT` | `/api/configuracoes` | Atualiza preferências |

### Exemplos

```bash
# Busca fuzzy
curl https://arca-next.vercel.app/api/produtos/search?q=arroz

# Comparação de preços
curl -X POST https://arca-next.vercel.app/api/comparar \
  -H 'Content-Type: application/json' \
  -d '{"produtos": [{"id": 189080, "nome": "Arroz 5kg", "quantidade": 2}]}'

# Upload de imagem
curl -X POST https://arca-next.vercel.app/api/upload \
  -F "file=@foto.jpg" \
  -F "folder=avatars"

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

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `produtos` | Catálogo com ~57.000 produtos (categorias, upload imagem) |
| `categorias` | Categorias de produtos (FK em produtos) |
| `precos` | Histórico de preços por mercado |
| `supermercados` | 6 mercados com coordenadas, status e logo |
| `perfis` / `profiles` | Usuários, permissões (admin, moderador, usuario) |
| `notificacoes` | Notificações por usuário (RLS) |
| `atividades_recentes` | Histórico de atividades (RLS) |
| `tickets` | Tickets de suporte |
| `tickets_mensagens` | Mensagens dos tickets |
| `alerta_preco` | Alertas de preço por produto (RLS) |
| `configuracoes` | Preferências do usuário |

### Extensões

- **pg_trgm** — busca fuzzy por similaridade de texto
- **RLS (Row Level Security)** — notificações, alertas, atividades, tickets

---

## 📁 Estrutura

```
arca-next/
├── app/
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── cadastro/route.ts
│       │   ├── logout/route.ts
│       │   ├── deletar-conta/route.ts
│       │   ├── perfil/route.ts
│       │   ├── enderecos/route.ts
│       │   └── alterar-senha/route.ts
│       ├── produtos/
│       │   ├── route.ts              # CRUD + paginação + busca
│       │   ├── precos/route.ts       # Preços por produto ou recentes
│       │   └── search/route.ts       # Busca fuzzy
│       ├── categorias/route.ts       # CRUD categorias
│       ├── mercados/route.ts         # CRUD mercados + geocoding
│       ├── comparar/route.ts         # Comparação dinâmica
│       ├── notificacoes/route.ts     # CRUD notificações
│       ├── historico/route.ts        # Histórico de atividades
│       ├── tickets/
│       │   ├── route.ts              # Lista/cria tickets
│       │   └── [id]/
│       │       ├── route.ts          # Atualiza status
│       │       └── mensagens/route.ts # Mensagens do ticket
│       ├── alertas/route.ts          # CRUD alertas preço
│       ├── upload/route.ts           # Upload genérico (folders)
│       ├── configuracoes/route.ts    # Preferências do usuário
│       ├── chat/route.ts             # Assistente IA (Gemini)
│       └── health/route.ts
├── lib/
│   ├── db/
│   │   ├── mongodb.ts
│   │   ├── supabase.ts              # getSupabaseServerClient()
│   │   └── prisma.ts                # Prisma singleton global
│   └── auth/
│       └── admin.ts                 # isAdmin(), isAdminOrModerador()
├── prisma/
│   └── schema.prisma
└── .env.local
```

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|------------|-----|
| Next.js 16 | Framework (App Router, --webpack) |
| TypeScript | Linguagem |
| Supabase | PostgreSQL + Auth via HTTP |
| Prisma 7 | ORM com adapter pg |
| MongoDB | Dados brutos (Bronze) |
| pg_trgm | Busca fuzzy |
| Google Gemini | Assistente IA |
| Nominatim | Geocoding de mercados |
| Vercel | Deploy e hospedagem |

---

## 🔐 Autenticação

- **Admin/Moderador**: Token via `Authorization: Bearer` + body fallback
- `isAdminOrModerador()` e `isAdmin()` — verificam role no Supabase com logging detalhado
- CORS com OPTIONS explícito para PUT/DELETE
- Token armazenado em localStorage (`arca_usuario`)
- Soft delete: `ativo = false` em vez de remover o registro

---

## 🧹 Rotas Removidas

As seguintes rotas foram removidas por não serem mais consumidas pelo frontend:

| Rota | Motivo |
|------|--------|
| `GET /api/produtos/preco` | Substituída por `/api/produtos/precos` |
| `GET /api/produtos/preco-similar` | Nunca consumida pelo app |
| `GET /api/setup-test` | Apenas para testes iniciais |
| `GET /api/migrate` | Migração única, já concluída |

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
