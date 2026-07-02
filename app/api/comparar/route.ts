import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

interface ProdutoItem {
  id?: number;
  nome: string;
  quantidade: number;
}

const BLOCKLIST_FOOD = ['GATO', 'CACHORRO', 'PET', 'RACAO', 'CAPELLETI', 'LASANHA', 'NUGGET', 'PETISCO'];
const ANCHOR_BLOCKLIST: Record<string, string[]> = {
  'ARROZ': ['VINAGRE', 'EXTRATO', 'MOLHO', 'TEMPERO', 'SOPA'],
  'FEIJAO': ['VINAGRE', 'EXTRATO', 'MOLHO', 'SOPA', 'DOCE'],
  'MACARRAO': ['VINAGRE', 'EXTRATO', 'SOPA'],
  'SABAO': ['CIF', 'DETERGENTE', 'GEL', 'AMACIANTE'],
};

function isSubstitutoValido(nomeOriginal: string, nomeSubstituto: string): boolean {
  const orig = nomeOriginal.toUpperCase().split(/\s+/).filter((w: string) => w.length >= 3);
  const sub = nomeSubstituto.toUpperCase().split(/\s+/).filter((w: string) => w.length >= 3);
  if (orig.length === 0 || sub.length === 0) return false;

  const anchor = orig[0];

  // Âncora deve estar entre as 2 primeiras palavras do substituto
  // ARROZ Camil → ARROZ Tio João: OK (pos 0)
  // ARROZ Camil → VINAGRE DE ARROZ: rejeita (pos 2)
  const posAnchor = sub.findIndex((t: string) => t === anchor || t.includes(anchor) || anchor.includes(t));
  if (posAnchor < 0 || posAnchor > 1) return false;

  // Blocklist geral
  for (const b of BLOCKLIST_FOOD) {
    if (sub.some((t: string) => t.includes(b))) return false;
  }

  // Blocklist por âncora
  const specific = ANCHOR_BLOCKLIST[anchor];
  if (specific) {
    for (const b of specific) {
      if (sub.some((t: string) => t.includes(b))) return false;
    }
  }

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { produtos } = await req.json() as { produtos: ProdutoItem[] };
    if (!produtos || produtos.length === 0) {
      return NextResponse.json({ sucesso: false, erro: "Nenhum produto enviado" }, { status: 400, headers: CORS_HEADERS });
    }

    const MAX_PRODUTOS = 20;
    if (produtos.length > MAX_PRODUTOS) {
      return NextResponse.json(
        { sucesso: false, erro: `Máximo de ${MAX_PRODUTOS} produtos por comparação. Você enviou ${produtos.length}.` },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = getSupabaseServerClient();

    // Buscar todos os mercados (incluindo pendentes para demo/TCC)
    const { data: mercados } = await supabase.from("supermercados")
      .select("id, nome").order("id");
    if (!mercados || mercados.length === 0) {
      return NextResponse.json({ sucesso: false, erro: "Nenhum mercado cadastrado" }, { status: 404, headers: CORS_HEADERS });
    }

    // ── 1. Resolver produtos (sequential ILIKE por nome + batch por ID) ─
    const nomesUnicos = [...new Set(
      produtos.filter(p => !p.id).map(p => p.nome.trim().toUpperCase())
    )];

    const idsDiretos = produtos.filter(p => p.id).map(p => p.id!);
    const resolvedMap: Record<string, { id: number; nome: string; categoria_id: number | null; peso_volume: string | null }> = {};

    // Buscar por IDs diretos (batch)
    if (idsDiretos.length > 0) {
      const { data: porId } = await supabase.from("produtos")
        .select("id, nome, categoria_id, peso_volume")
        .in("id", idsDiretos);
      if (porId) for (const p of porId) resolvedMap[String(p.id)] = p;
    }

    // Buscar por nome (frase inteira com ILIKE + índice GIN)
    if (nomesUnicos.length > 0) {
      const resultados = await Promise.all(
        nomesUnicos.map(async (nome) => {
          const { data } = await supabase
            .from("produtos")
            .select("id, nome, categoria_id, peso_volume")
            .ilike("nome", `%${nome}%`)
            .limit(1);
          return { nome, produto: data?.[0] || null };
        })
      );
      for (const { nome, produto } of resultados) {
        if (produto) resolvedMap[nome] = produto;
      }
    }

    // ── 2. Buscar todos os preços de uma vez ──────────────────────────
    const allIds = new Set<number>();
    for (const p of produtos) {
      if (p.id && resolvedMap[String(p.id)]) allIds.add(p.id);
    }
    for (const v of Object.values(resolvedMap)) allIds.add(v.id);

    const diasLimite = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const priceMap: Record<string, number> = {};
    const dateMap: Record<string, string> = {};

    if (allIds.size > 0) {
      const { data: precos } = await supabase
        .from("precos")
        .select("produto_id, supermercado_id, preco, data_coleta")
        .in("produto_id", [...allIds])
        .gte("data_coleta", diasLimite);

      if (precos) {
        for (const p of precos) {
          const key = `${p.produto_id}_${p.supermercado_id}`;
          if (!dateMap[key] || p.data_coleta > dateMap[key]) {
            priceMap[key] = p.preco;
            dateMap[key] = p.data_coleta;
          }
        }
      }
    }

    // ── 3. Função auxiliar: resolver ID de um produto ─────────────────
    function resolveId(produto: ProdutoItem): { id: number; nome: string; categoria_id: number | null; peso_volume: string | null } | null {
      if (produto.id) {
        const found = resolvedMap[String(produto.id)];
        return found || null;
      }
      const termo = produto.nome.trim().toUpperCase();
      // Busca direta primeiro
      for (const v of Object.values(resolvedMap)) {
        if (v.nome?.toUpperCase() === termo) return v;
      }
      // Busca parcial
      for (const v of Object.values(resolvedMap)) {
        if (v.nome?.toUpperCase().includes(termo) || termo.includes(v.nome?.toUpperCase() || '')) return v;
      }
      return null;
    }

    // ── 4. Construir matriz de comparação ─────────────────────────────
    interface MercadoAcc {
      total: number;
      itens: number;
      produtos: any[];
    }

    // 4a. Primeira passada: preços exatos + coletar produtos que precisam fallback
    const acc: Record<number, MercadoAcc> = {};
    for (const m of mercados) acc[m.id] = { total: 0, itens: 0, produtos: [] };

    const produtosResolvidos: { produto: ProdutoItem; resolved: { id: number; nome: string; categoria_id: number | null; peso_volume: string | null } }[] = [];

    for (const produto of produtos) {
      const quantidade = produto.quantidade || 1;
      const resolved = resolveId(produto);
      if (!resolved) {
        for (const m of mercados) {
          acc[m.id].produtos.push({
            nome: produto.nome, nomeEncontrado: null, tipoBusca: null,
            quantidade, precoUnitario: 0, subtotal: 0, naoEncontrado: true,
          });
        }
        continue;
      }
      produtosResolvidos.push({ produto, resolved });

      for (const mercado of mercados) {
        const preco = priceMap[`${resolved.id}_${mercado.id}`];
        if (preco !== undefined && preco > 0) {
          acc[mercado.id].total += preco * quantidade;
          acc[mercado.id].itens++;
          acc[mercado.id].produtos.push({
            nome: produto.nome, nomeEncontrado: resolved.nome,
            tipoBusca: produto.id ? 'id' : 'nome',
            quantidade, precoUnitario: preco, subtotal: preco * quantidade,
            naoEncontrado: false,
          });
        }
      }

      // Placeholder para mercados sem preço (sempre — garante N entradas/mercado)
      for (const mercado of mercados) {
        const preco = priceMap[`${resolved.id}_${mercado.id}`];
        if (!preco || preco <= 0) {
          acc[mercado.id].produtos.push({
            nome: produto.nome, nomeEncontrado: null, tipoBusca: null,
            quantidade, precoUnitario: 0, subtotal: 0, naoEncontrado: true,
          });
        }
      }
    }

    // 4b. Fallback: buscar equivalentes via tabela pré-computada
    //     produtos_equivalentes pré-populada com trigram + marca + categoria
    const fallbacks = produtosResolvidos.filter(({ resolved }) => {
      for (const m of mercados) {
        const preco = priceMap[`${resolved.id}_${m.id}`];
        if (!preco || preco <= 0) return true;
      }
      return false;
    });

    if (fallbacks.length > 0) {
      const fallbackIds = fallbacks.map(f => f.resolved.id);

      // Busca equivalentes na tabela (individualmente, top 5 por produto)
      // Evita o limite de 1000 linhas do PostgREST free tier
      const resultados: { produtoId: number; nomeOriginal: string; similares: { id: number; nome: string }[] }[] = [];
      const similarIds = new Set<number>();

      if (fallbackIds.length > 0) {
        const eqResults = await Promise.all(
          fallbackIds.map(async (fbId) => {
            const [a, b] = await Promise.all([
              supabase.from("produtos_equivalentes").select("produto_id_b, score").eq("produto_id_a", fbId).gte("score", 0.3).order("score", { ascending: false }).limit(10),
              supabase.from("produtos_equivalentes").select("produto_id_a, score").eq("produto_id_b", fbId).gte("score", 0.3).order("score", { ascending: false }).limit(10),
            ]);
            return { fbId, matchIds: [...new Set([...(a.data || []).map(x => x.produto_id_b), ...(b.data || []).map(x => x.produto_id_a)])] };
          })
        );
        for (const { fbId, matchIds } of eqResults) {
          if (matchIds.length > 0) {
            for (const id of matchIds) similarIds.add(id);
            resultados.push({
              produtoId: fbId,
              nomeOriginal: fallbacks.find(f => f.resolved.id === fbId)?.resolved.nome || '',
              similares: matchIds.map(id => ({ id, nome: '' })),
            });
          }
        }
      }

      // Fallback ILIKE progressivo — tenta com todas as palavras,
      // depois relaxa (sem categoria, menos palavras) ate achar algo
      async function buscarIlike(resolved: { id: number; nome: string }, palavras: string[]): Promise<{ id: number; nome: string }[]> {
        if (palavras.length < 2) return [];
        let q = supabase.from("produtos").select("id, nome").neq("id", resolved.id);
        for (const p of palavras) q = q.ilike("nome", `%${p}%`);
        const { data } = await q.limit(10);
        if (data && data.length > 0) return data;
        const maior = palavras.reduce((a, b) => a.length >= b.length ? a : b);
        const { data: d2 } = await supabase.from("produtos").select("id, nome").neq("id", resolved.id).ilike("nome", `%${maior}%`).limit(10);
        return d2 || [];
      }

      if (fallbacks.length > 0) {
        const vistos = new Set<number>();
        const ilikeResults = await Promise.all(
          fallbacks.map(async (fb) => {
            if (vistos.has(fb.resolved.id)) return null;
            vistos.add(fb.resolved.id);
            const termo = (fb.produto.nome || fb.resolved.nome).trim().toUpperCase();
            const palavras = termo.split(/\s+/).filter(p => p.length >= 3).slice(0, 5);
            if (palavras.length < 2) return null;
            const similares = await buscarIlike(fb.resolved, palavras);
            if (similares.length === 0) return null;
            return { produtoId: fb.resolved.id, nomeOriginal: fb.resolved.nome, similares: similares.map(s => ({ id: s.id, nome: s.nome })) };
          })
        );
        for (const r of ilikeResults) {
          if (r && r.similares.length > 0) {
            const jaExiste = resultados.some(ex => ex.produtoId === r.produtoId && ex.similares.some(s => s.id === r.similares[0].id));
            if (!jaExiste) {
              resultados.push(r);
              for (const s of r.similares) similarIds.add(s.id);
            }
          }
        }
      }

      // Buscar nomes dos equivalentes (se ainda não foram preenchidos pelo ILIKE)
      if (similarIds.size > 0) {
        const { data: nomes } = await supabase
          .from("produtos")
          .select("id, nome")
          .in("id", [...similarIds]);
        if (nomes) {
          const nomeMap = new Map(nomes.map(n => [n.id, n.nome]));
          for (const r of resultados) {
            for (const s of r.similares) {
              if (!s.nome) s.nome = nomeMap.get(s.id) || '';
            }
          }
        }
      }

      // Buscar preços dos equivalentes no mesmo período
      let precosSimilares: any[] = [];
      if (similarIds.size > 0) {
        const { data } = await supabase
          .from("precos")
          .select("produto_id, supermercado_id, preco")
          .in("produto_id", [...similarIds])
          .gte("data_coleta", diasLimite);
        if (data) precosSimilares = data;
      }

      // Indexar preços similares por produto + mercado
      const similarPriceMap: Record<string, number> = {};
      for (const p of precosSimilares) {
        const key = `${p.produto_id}_${p.supermercado_id}`;
        if (similarPriceMap[key] === undefined || p.preco < similarPriceMap[key]) {
          similarPriceMap[key] = p.preco;
        }
      }

      // Segunda passada: preencher fallbacks nos mercados faltantes
      // Ordena equivalentes por: quem tem preco no mercado alvo primeiro, depois score
      for (const r of resultados) {
        for (const mercado of mercados) {
          const jaTem = acc[mercado.id].produtos.some(
            (p: any) => p.nome === fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.nome && !p.naoEncontrado
          );
          if (jaTem) continue;

          const similaresOrdenados = [...r.similares].sort((a, b) => {
            const temA = similarPriceMap[`${a.id}_${mercado.id}`] ? 1 : 0;
            const temB = similarPriceMap[`${b.id}_${mercado.id}`] ? 1 : 0;
            return temB - temA;
          });

          let encontrado = false;
          for (const s of similaresOrdenados) {
            const preco = similarPriceMap[`${s.id}_${mercado.id}`];
            if (preco && preco > 0) {
              encontrado = true;
              acc[mercado.id].total += preco * (fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.quantidade || 1);
              acc[mercado.id].itens++;
              const placeholderIdx = acc[mercado.id].produtos.findLastIndex(
                (p: any) => p.naoEncontrado && p.nome === (fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.nome)
              );
              if (placeholderIdx >= 0) {
                acc[mercado.id].produtos[placeholderIdx] = {
                  nome: fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.nome,
                  nomeEncontrado: s.nome,
                  tipoBusca: 'similar',
                  similarInfo: { nomeOriginal: r.nomeOriginal, motivo: 'equivalente' },
                  quantidade: fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.quantidade || 1,
                  precoUnitario: preco,
                  subtotal: preco * (fallbacks.find(f => f.resolved.id === r.produtoId)?.produto.quantidade || 1),
                  naoEncontrado: false,
                };
              }
              break;
            }
          }
        }
      }
    }

    // 4c. Slow path: ILIKE progressivo + filtro por mercado
    //     Para cada produto ainda sem preco, busca via ILIKE (indice GIN)
    //     e filtra por presenca no mercado alvo
    const buracosPorProduto = new Map<number, { nome: string; resolved: typeof produtosResolvidos[0]['resolved']; nomeOriginal: string }>();
    for (const mercado of mercados) {
      for (const p of acc[mercado.id].produtos) {
        if (!p.naoEncontrado) continue;
        const resolved = produtosResolvidos.find(r => r.produto.nome === p.nome);
        if (!resolved) continue;
        if (!buracosPorProduto.has(resolved.resolved.id)) {
          buracosPorProduto.set(resolved.resolved.id, { nome: p.nome, resolved: resolved.resolved, nomeOriginal: resolved.produto.nome });
        }
      }
    }

    if (buracosPorProduto.size > 0) {
      const slowResults: Map<string, { id: number; nome: string; preco: number }> = new Map();
      const entries = [...buracosPorProduto.entries()];
      const CONCORRENCIA = 10;

      const foundCandidates = new Map<number, { id: number; nome: string }[]>();

      for (let i = 0; i < entries.length; i += CONCORRENCIA) {
        const batch = entries.slice(i, i + CONCORRENCIA);
        const batchResults = await Promise.all(batch.map(async ([produtoId, info]) => {
          const termo = info.resolved.nome.trim().toUpperCase();
          const palavras = termo.split(/\s+/).filter(w => w.length >= 3).slice(0, 5);
          if (palavras.length < 2) return { produtoId, candidatos: [] };

          for (let n = palavras.length; n >= 2; n--) {
            const combo = palavras.slice(0, n);
            let q = supabase.from("produtos").select("id, nome").neq("id", produtoId);
            for (const w of combo) q = q.ilike("nome", `%${w}%`);
            const { data } = await q.limit(20);
            if (data && data.length > 0) return { produtoId, candidatos: data };
          }

          const maior = palavras.reduce((a, b) => a.length >= b.length ? a : b);
          const { data } = await supabase.from("produtos").select("id, nome").neq("id", produtoId).ilike("nome", `%${maior}%`).limit(20);
          return { produtoId, candidatos: data || [] };
        }));

        for (const r of batchResults) {
          if (r.candidatos.length > 0) foundCandidates.set(r.produtoId, r.candidatos);
        }
      }

      const allCandidateIds = [...new Set([...foundCandidates.values()].flatMap(c => c.map(x => x.id)))];
      if (allCandidateIds.length > 0) {
        const { data: precosCandidatos } = await supabase
          .from("precos")
          .select("produto_id, supermercado_id, preco")
          .in("produto_id", allCandidateIds)
          .gte("data_coleta", diasLimite);

        if (precosCandidatos && precosCandidatos.length > 0) {
          const precosPorMercado: Record<number, Map<number, number>> = {};
          for (const pc of precosCandidatos) {
            if (!precosPorMercado[pc.supermercado_id]) precosPorMercado[pc.supermercado_id] = new Map();
            if (!precosPorMercado[pc.supermercado_id].has(pc.produto_id)) {
              precosPorMercado[pc.supermercado_id].set(pc.produto_id, pc.preco);
            }
          }

          for (const [produtoId, candidatos] of foundCandidates) {
            for (const cand of candidatos) {
              for (const mercado of mercados) {
                const key = `${produtoId}_${mercado.id}`;
                if (slowResults.has(key)) continue;
                const preco = precosPorMercado[mercado.id]?.get(cand.id);
                if (preco && preco > 0) {
                  const temPlaceholder = acc[mercado.id].produtos.some(
                    (px: any) => px.naoEncontrado && px.nome === buracosPorProduto.get(produtoId)?.nomeOriginal
                  );
                  if (temPlaceholder) {
                    slowResults.set(key, { id: cand.id, nome: cand.nome, preco });
                  }
                }
              }
              if (slowResults.size >= entries.length * mercados.length) break;
            }
          }
        }
      }

      // Aplicar resultados nos placeholders
      for (const [key, encontrado] of slowResults) {
        const [produtoIdStr, mercadoIdStr] = key.split('_');
        const mercadoId = parseInt(mercadoIdStr);
        const info = buracosPorProduto.get(parseInt(produtoIdStr));
        if (!info) continue;

        const placeholderIdx = acc[mercadoId].produtos.findLastIndex(
          (px: any) => px.naoEncontrado && px.nome === info.nomeOriginal
        );
        if (placeholderIdx < 0) continue;
        acc[mercadoId].produtos[placeholderIdx] = {
          nome: info.nomeOriginal,
          nomeEncontrado: encontrado.nome,
          tipoBusca: 'similar',
          similarInfo: { nomeOriginal: info.resolved.nome, motivo: 'trigram' },
          quantidade: produtos.find(p => p.nome === info.nomeOriginal)?.quantidade || 1,
          precoUnitario: encontrado.preco,
          subtotal: encontrado.preco * (produtos.find(p => p.nome === info.nomeOriginal)?.quantidade || 1),
          naoEncontrado: false,
        };
        acc[mercadoId].itens++;
        acc[mercadoId].total += encontrado.preco * (produtos.find(p => p.nome === info.nomeOriginal)?.quantidade || 1);
      }
    }

    // 4d. Slow path camada 3: trigram RPC com indice GIN + filtro por mercado
    //     Para pares (produto, mercado) que ainda ficaram sem preco
    const buracosRestantes: { nome: string; nomeOriginal: string; produtoId: number; termo: string; mercadoId: number }[] = [];
    for (const mercado of mercados) {
      for (const p of acc[mercado.id].produtos) {
        if (!p.naoEncontrado) continue;
        const resolved = produtosResolvidos.find(r => r.produto.nome === p.nome);
        if (!resolved) continue;
        buracosRestantes.push({
          nome: p.nome,
          nomeOriginal: resolved.resolved.nome,
          produtoId: resolved.resolved.id,
          termo: resolved.resolved.nome,
          mercadoId: mercado.id,
        });
      }
    }

    if (buracosRestantes.length > 0) {
      const TRIGRAM_CONCORRENCIA = 30;

      async function executarTrigrama(buraco: typeof buracosRestantes[0]) {
        try {
          const { data } = await supabase.rpc("buscar_trigram_mercado", {
            p_termo: buraco.termo,
            p_mercado_id: buraco.mercadoId,
            p_excluir_id: buraco.produtoId,
            p_limite: 3,
          });
          if (data && data.length > 0 && data[0].preco && data[0].preco > 0) {
            return { ...buraco, encontrado: data[0] };
          }
        } catch { /* ignora timeout */ }
        return null;
      }

      const trigramResults: { nome: string; nomeOriginal: string; produtoId: number; termo: string; mercadoId: number; encontrado: any }[] = [];
      for (let i = 0; i < buracosRestantes.length; i += TRIGRAM_CONCORRENCIA) {
        const batch = buracosRestantes.slice(i, i + TRIGRAM_CONCORRENCIA);
        const results = await Promise.all(batch.map(executarTrigrama));
        for (const r of results) { if (r) trigramResults.push(r); }
      }

      for (const sr of trigramResults) {
        const { nome, nomeOriginal, mercadoId, encontrado } = sr;
        const placeholderIdx = acc[mercadoId].produtos.findLastIndex(
          (px: any) => px.naoEncontrado && px.nome === nome
        );
        if (placeholderIdx < 0) continue;
        acc[mercadoId].produtos[placeholderIdx] = {
          nome,
          nomeEncontrado: encontrado.nome,
          tipoBusca: 'similar',
          similarInfo: { nomeOriginal, motivo: 'trigram' },
          quantidade: produtos.find(p => p.nome === nome)?.quantidade || 1,
          precoUnitario: encontrado.preco,
          subtotal: encontrado.preco * (produtos.find(p => p.nome === nome)?.quantidade || 1),
          naoEncontrado: false,
        };
        acc[mercadoId].itens++;
        acc[mercadoId].total += encontrado.preco * (produtos.find(p => p.nome === nome)?.quantidade || 1);
      }
    }

    // 4e. Substituto por categoria: se nada achou, busca o mais barato
    //     da mesma categoria com preco no mercado alvo
    const precisaSubstituto: { nome: string; produtoId: number; categoria_id: number; mercadoId: number }[] = [];
    for (const mercado of mercados) {
      for (const p of acc[mercado.id].produtos) {
        if (!p.naoEncontrado) continue;
        const resolved = produtosResolvidos.find(r => r.produto.nome === p.nome);
        if (!resolved || !resolved.resolved.categoria_id) continue;
        precisaSubstituto.push({
          nome: p.nome,
          produtoId: resolved.resolved.id,
          categoria_id: resolved.resolved.categoria_id,
          mercadoId: mercado.id,
        });
      }
    }

    if (precisaSubstituto.length > 0) {
      // Agrupar por (categoria, mercado) pra minimizar queries
      const grupos = new Map<string, { cat: number; mercadoId: number; produtos: typeof precisaSubstituto }>();
      for (const ps of precisaSubstituto) {
        const key = `${ps.categoria_id}_${ps.mercadoId}`;
        if (!grupos.has(key)) grupos.set(key, { cat: ps.categoria_id, mercadoId: ps.mercadoId, produtos: [] });
        grupos.get(key)!.produtos.push(ps);
      }

      for (const [, grupo] of grupos) {
        const excluirIds = new Set(grupo.produtos.map(p => p.produtoId));
        const palavrasGrupo = [...new Set(
          grupo.produtos.flatMap(p =>
            p.nome.toUpperCase().split(/\s+/).filter((w: string) => w.length >= 4)
          )
        )];

        // ── 4a. Keyword + categoria (substituto preciso) ────────────────
        // Busca pela âncora (1ª palavra forte) de cada produto
        // Antes usava TODAS as palavras + limit 50 — perdia bons candidatos
        const anchors = [...new Set(
          grupo.produtos.map(p =>
            (p.nome.toUpperCase().split(/\s+/).find((w: string) => w.length >= 3) || '')
          ).filter(Boolean)
        )];
        if (anchors.length > 0) {
          const orConditions = anchors
            .slice(0, 8)
            .map(w => `nome.ilike.%${w}%`)
            .join(',');
          const { data: catTodos } = await supabase
            .from("produtos")
            .select("id, nome")
            .eq("categoria_id", grupo.cat)
            .or(orConditions)
            .limit(200);

          const catMatch = (catTodos || []).filter(p => !excluirIds.has(p.id));

          if (catMatch.length > 0) {
            const idsMatch = catMatch.map(p => p.id);
            const catNomeMap = new Map(catMatch.map(p => [p.id, p.nome]));
            const { data: precosSub } = await supabase
              .from("precos")
              .select("produto_id, preco")
              .in("produto_id", idsMatch)
              .eq("supermercado_id", grupo.mercadoId)
              .gte("data_coleta", diasLimite)
              .gt("preco", 0)
              .order("preco", { ascending: true });

            if (precosSub && precosSub.length > 0) {
              const usado = new Set<number>();
              for (const ps of grupo.produtos) {
                if (usado.has(ps.produtoId)) continue;
                const palavras = ps.nome.toUpperCase().split(/\s+/).filter((w: string) => w.length >= 4);
                if (palavras.length === 0) continue;

                let melhor: { id: number; nome: string; preco: number } | null = null;
                for (const sub of precosSub) {
                  if (usado.has(sub.produto_id)) continue;
                  const nomeSub = catNomeMap.get(sub.produto_id) || '';
                  if (isSubstitutoValido(ps.nome, nomeSub)) {
                    melhor = { id: sub.produto_id, nome: nomeSub, preco: sub.preco };
                    usado.add(sub.produto_id);
                    break;
                  }
                }
                if (!melhor) continue;
                usado.add(ps.produtoId);
                const idx = acc[ps.mercadoId].produtos.findLastIndex(
                  (px: any) => px.naoEncontrado && px.nome === ps.nome
                );
                if (idx < 0) continue;
                acc[ps.mercadoId].produtos[idx] = {
                  nome: ps.nome, nomeEncontrado: melhor.nome, tipoBusca: 'substituto',
                  similarInfo: { nomeOriginal: melhor.nome, motivo: 'substituto' },
                  quantidade: produtos.find(p => p.nome === ps.nome)?.quantidade || 1,
                  precoUnitario: melhor.preco, subtotal: melhor.preco * (produtos.find(p => p.nome === ps.nome)?.quantidade || 1),
                  naoEncontrado: false,
                };
                acc[ps.mercadoId].itens++;
                acc[ps.mercadoId].total += melhor.preco * (produtos.find(p => p.nome === ps.nome)?.quantidade || 1);
              }
            }
          }
        }

        // ── 4b. Substituto amplo DESLIGADO — gera mais erro que acerto
        //     Melhor "não encontrado" honesto do que CIF no lugar de Sabão
      }
    }

    // ── 4f. Pós-processamento: remover similarInfo se nome for igual ──
    //     Evita mostrar "Similar" pra produtos com match exato
    for (const mercado of mercados) {
      for (const p of acc[mercado.id].produtos) {
        if (p.naoEncontrado || !p.similarInfo) continue;
        if (p.nome === p.nomeEncontrado || p.nome === p.similarInfo?.nomeOriginal) {
          delete p.similarInfo;
          if (p.tipoBusca === 'similar' || p.tipoBusca === 'trigram' || p.tipoBusca === 'equivalente') {
            p.tipoBusca = 'nome';
          }
        }
      }
    }

    // ── 5. Montar resposta ────────────────────────────────────────────
    const resposta = mercados.map((m) => ({
      id: m.id,
      nome: m.nome,
      total: Math.round(acc[m.id].total * 100) / 100,
      itensEncontrados: acc[m.id].itens,
      totalProdutos: produtos.length,
      produtos: acc[m.id].produtos,
    }));

    resposta.sort((a, b) => {
      if (a.total === 0) return 1;
      if (b.total === 0) return -1;
      return a.total - b.total;
    });

    return NextResponse.json({
      sucesso: true,
      mercados: resposta,
      totalProdutos: produtos.length,
    }, { headers: CORS_HEADERS });

  } catch (error) {
    console.error("Erro no comparador:", error);
    return NextResponse.json(
      { sucesso: false, erro: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
