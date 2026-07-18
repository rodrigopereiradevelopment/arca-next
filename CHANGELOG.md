# arca-next — Changelog

## v1.2.2 (15/jul/2026)
- **tsvector full-text search** — RPC `buscar_produtos_tsvector`, busca 4.1s → 0.36s
- **Redis Cache** — Upstash, comparação 8s → 0.34s (23× mais rápido)
- **Security fixes** — REVOKE EXECUTE anon, SET search_path public em 17 functions
- **RLS performance** — auth.uid() → (select auth.uid()) em 22 policies
- **Limpeza preços** — 790k → 59k linhas (145MB → 15MB)

## v1.2.1 (02/jul/2026)
- **Filtro substitutos**: âncora na posição 0-1 + blocklists
- **Substituto_amplo desligado**: zero falsos positivos
- **Busca por âncora**: OR query usa só a primeira palavra
- **Ordenação por completeza**: mercados ordenados por itens encontrados
- **nomeEncontrado na API**: exposto no response do comparar
- **Motivo nos similares**: `similarInfo.motivo` em todas as camadas
- **Imagens quebradas**: 6.711 produtos com `imagem_url` morta limpos

## v1.2.0 (29/jun/2026)
- **Search otimizado**: ILIKE direto com índice GIN (timeout 3s+ → ~120ms)
- **Preços no search**: corrige array `precos[]` vazio
- **Comparação acelerada**: ILIKE tokenizado + cache (~40s → ~380ms)
- **Fallback tokenizado**: busca por palavras-chave AND

## v1.1.0 (31/mai/2026)
- **Portal do Mercado**: dashboard, CRUD preços, import CSV
- **Role mercado_admin**: cada mercado vê só seus produtos
- **Auth centralizada**: `lib/mercado-auth.ts`

## v1.0.0 (29/mar/2026)
- **Schema completo**: produtos, preços, supermercados, usuários
- **API REST**: 15+ endpoints
- **Auth**: email + OAuth (Google/Facebook)
- **Comparação**: 4 camadas de fallback
- **Busca**: tokenizada com normalização de acentos
