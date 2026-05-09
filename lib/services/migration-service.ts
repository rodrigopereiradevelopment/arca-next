// lib/services/migration-service.ts
import { getMongoDb } from "@/lib/db/mongodb";
import { getSupabaseServerClient } from "@/lib/db/supabase";

// Valida se é um EAN real (8 ou 13 dígitos, apenas números)
function isEanValido(ean?: string): boolean {
  if (!ean) return false;
  return /^\d{8}$|^\d{13}$/.test(ean);
}

// Extrai marca real do nome do produto
function extrairMarca(nome: string, marcaMongo?: string): string {
  if (marcaMongo && marcaMongo !== "N/A") return marcaMongo;
  return nome.split(" ").slice(0, 2).join(" ");
}

// Normaliza categoria de qualquer mercado para o categoria_id do Supabase
function normalizarCategoria(categoria: string, mercado: string): number | null {
  if (!categoria) return null;

  const catLower = categoria.toLowerCase().trim();

  const mapaDireto: Record<string, number> = {
    // Carnes / Açougue
    "acougue": 2,
    "acougue-47": 2,
    "carnes aves peixes": 2,
    "carnes": 2,
    "peixaria-82": 2,
    "peixaria": 2,
    "rotisserie": 2,

    // Padaria
    "padaria": 5,
    "padaria-50": 5,
    "padaria e matinais": 5,

    // Hortifruti
    "hortifruti": 6,
    "hortifrutigranjeiro-1": 6,
    "frutas e verduras": 6,
    "f.l.v": 6,
    "hortifrutigranjeiro": 6,
    "hortifrúti": 6,
    "flores": 6,

    // Frios e Laticínios
    "laticinios": 1,
    "frios e laticinios": 1,
    "frios-laticinios": 1,
    "frios e laticínios": 1,
    "frios-laticinios-9": 1,
    "frios-e-laticinios": 1,
    "frios-e-laticinios-9": 1,
    "frios": 1,
    "frios e congelados": 1,
    "frios laticinios": 1,
    "produtos geladeira": 1,

    // Bebidas
    "bebidas": 3,
    "bebidas alcoolicas": 3,
    "bebidas alcoólicas": 3,
    "bebidas-alcoolicas": 3,
    "agua": 3,
    "cerveja": 3,
    "energetico": 3,
    "sucos": 3,
    "vinho": 3,

    // Higiene / Limpeza / Pet / Bebê
    "higiene": 4,
    "higiene e beleza": 4,
    "higiene-beleza": 4,
    "higiene-e-beleza": 4,
    "higiene e limpeza": 4,
    "higiene pessoal| limpeza": 4,
    "higiene e perfumaria": 4,
    "limpeza": 4,
    "petshop": 4,
    "mundo pet": 4,
    "pet-shop-14": 4,
    "mamae e bebe": 4,
    "mamae-e-bebe": 4,
    "cabelo": 4,
    "descartaveis": 4,
    "descartáveis e embalagens": 4,
    "higiene beleza": 4,
    "limpeza casa": 4,
    "limpeza roupas": 4,
    "pet shop": 4,
    "produtos pets": 4,

    // Grãos / Mercearia seca / Café
    "graos": 7,
    "cereais": 7,
    "feijao": 7,
    "feijão": 7,
    "cafe da manha": 7,
    "café da manhã": 7,
    "cafe-da-manha": 7,
    "cafe": 7,
    "café": 7,
    "saudaveis organicos": 7,
    "saudáveis orgânicos": 7,
    "açúcar": 7,
    "acucar": 7,
    "alimentos secos": 7,
    "condimentos": 7,
    "conservas": 7,
    "farinaceos": 7,
    "fermento": 7,
    "massas": 7,
    "macarrao sopas e cremes": 7,
    "matinais": 7,
    "mercearia seca doce": 7,
    "oleos para cozinhar": 7,
    "paes industrializados": 7,
    "pao": 7,
    "temperos": 7,

    // Óleos
    "oleo": 7,
    "óleo": 7,

    // Macarrão
    "macarrao": 9,
    "macarrão": 9,

    // Congelados
    "congelados": 8,
    "congelados-6": 8,
    "ilha congelados": 8,
    "pereciveis": 8,

    // Mercearia geral / Bazar / Utilidades
    "mercearia": 9,
    "mercearia-3": 9,
    "bazar": 9,
    "bazar-utilidades": 9,
    "bazar utilidades": 9,
    "magazine-16": 9,
    "festivos": 9,
    "lanchonete": 9,
    "promocoes-99999": 9,
    "utilidades domesticas": 9,
    "utilidades domésticas": 9,
    "alimento infantil": 9,
    "automotivo": 9,
    "calcados": 9,
    "eletro e eletronicos": 9,
    "eletrônicos e eletroportáteis": 9,
    "embalagem": 9,
    "esporte e lazer": 9,
    "insumos": 9,
    "jardinagem": 9,
    "kits": 9,
    "latarias e vidros": 9,
    "magazine": 9,
    "papelaria": 9,
    "produtos dieteticos e light": 9,
    "produtos naturais": 9,
    "produtos para automoveis": 9,
    "produtos para churrasco": 9,
    "produtos para jardinagem": 9,
    "utilidades em geral": 9,
    "vestuário": 9,
    "vestuario": 9,
    "ofertas": 9,
    "promocoes": 9,

    // Snacks
    "snacks": 10,
    "biscoitos salgadinhos": 10,
    "doces sobremesas": 10,
    "biscoitos": 10,
    "bolos": 10,
    "bomboniere": 10,
    "cafeteria": 10,
    "chocolates": 10,
    "confeitaria": 10,
    "doces": 10,
    "sobremesa": 10,
  };

  if (mapaDireto[catLower] !== undefined) return mapaDireto[catLower];

  // Códigos numéricos do Ponto Novo
  if (/^\d+$/.test(catLower)) {
    const mapaPontoNovo: Record<number, number> = {
      4112: 9,  // mercearia
      2015: 3,  // bebidas
      3382: 4,  // higiene-e-beleza
      1348: 4,  // limpeza
      1292: 9,  // bazar
      1009: 1,  // frios-e-laticinios
      1072: 7,  // cafe-da-manha
      576:  8,  // congelados
      823:  4,  // mamae-e-bebe
      425:  4,  // petshop
      314:  2,  // acougue
      249:  6,  // hortifruti
      419:  9,  // festivos
    };
    const codigo = parseInt(catLower);
    if (mapaPontoNovo[codigo] !== undefined) return mapaPontoNovo[codigo];
  }

  // Códigos string do Atacadão ("012", "002", etc.)
  const mapaAtacadao: Record<string, number> = {
    "012": 9,  // Mercearia
    "002": 3,  // Bebidas
    "003": 3,  // Bebidas Alcoolicas
    "010": 6,  // Hortifruti
    "005": 2,  // Carnes Aves Peixes
    "008": 1,  // Frios Laticinios
    "006": 8,  // Congelados
    "009": 4,  // Higiene Beleza
    "011": 4,  // Limpeza
    "004": 10, // Biscoitos Salgadinhos
    "007": 10, // Doces Sobremesas
    "015": 5,  // Padaria
    "016": 7,  // Saudaveis Organicos
    "001": 9,  // Bazar Utilidades
    "014": 4,  // Mundo Pet
  };
  if (mapaAtacadao[catLower] !== undefined) return mapaAtacadao[catLower];

  return null;
}

// Mapeia tipo do produto baseado na categoria_id
function mapearTipo(categoria: string, categoriaId: number | null): string {
  if (categoriaId) {
    const tipoPorCategoria: Record<number, string> = {
      2: "acougue",
      5: "padaria",
      6: "hortifruti",
    };
    if (tipoPorCategoria[categoriaId]) return tipoPorCategoria[categoriaId];
  }

  const catLower = categoria?.toLowerCase() || "";
  if (catLower.includes("acougue") || catLower.includes("carne") || catLower.includes("peixe")) return "acougue";
  if (catLower.includes("padaria") || catLower.includes("pao") || catLower.includes("pão")) return "padaria";
  if (catLower.includes("hortifruti") || catLower.includes("fruta") || catLower.includes("verdura")) return "hortifruti";
  if (catLower.includes("lanchonete")) return "lanchonete";

  return "industrializado";
}

type MongoProduct = {
  _id: any;
  id_origem: string;
  mercado: string;
  nome: string;
  nome_normalizado: string;
  preco_atual: number;
  preco_original?: number;
  historico_precos: Array<{ data: string; preco: number }>;
  total_coletas: number;
  menor_preco_historico: number;
  maior_preco_historico: number;
  categoria: string;
  marca?: string;
  ean?: string;
  url_imagem?: string;
  data_ultima_coleta: Date | string;
  unidade?: string;
  is_kg?: number;
};

const mercadoParaSupermercadoId: Record<string, number> = {
  Imperial: 1,
  "Ponto Novo": 2,
  GoodBom: 3,
  Atacadão: 4,
  "Pague Menos": 5,
  PagueMenos: 5,
  "São Vicente": 6,
};

/**
 * Migração completa: produtos + preço atual + histórico
 * Rode TRUNCATE TABLE produtos CASCADE; no Supabase antes de executar novamente
 */
export async function migrateProductsToSupabase(batchSize: number = 100) {
  const mongoDb = await getMongoDb();
  const supabase = getSupabaseServerClient();
  const collection = mongoDb.collection<MongoProduct>("produtos");

  const total = await collection.countDocuments();
  let migrados = 0;
  let jaExistiam = 0;
  let errosProduto = 0;
  let precosInseridos = 0;
  let historicoInserido = 0;
  let errosPreco = 0;

  const categoriasNaoMapeadas = new Set<string>();
  const mercadosNaoMapeados = new Set<string>();

  console.log(`🔄 Iniciando migração de ${total} produtos...`);

  for (let skip = 0; skip < total; skip += batchSize) {
    const batch = await collection.find({}).skip(skip).limit(batchSize).toArray();
    console.log(`\n📦 Lote ${skip / batchSize + 1}: ${batch.length} produtos`);

    for (const mongoProduct of batch) {
      try {
        // 1. Buscar produto existente por nome normalizado
        const { data: existingList, error: selectError } = await supabase
          .from("produtos")
          .select("id")
          .eq("nome", mongoProduct.nome_normalizado)
          .limit(1);

        const existing = existingList?.[0] ?? null;

        if (selectError) {
          console.error(`❌ Erro ao buscar produto ${mongoProduct.nome}:`, selectError.message);
          errosProduto++;
          continue;
        }

        let produtoId: number;

        // 2. Inserir produto se não existir
        if (!existing) {
          const categoriaId = normalizarCategoria(mongoProduct.categoria, mongoProduct.mercado);

          if (categoriaId === null && mongoProduct.categoria) {
            categoriasNaoMapeadas.add(`"${mongoProduct.categoria}" (${mongoProduct.mercado})`);
          }

          // Verifica se o EAN já está em uso por outro produto (nome diferente, mesmo EAN)
          // Ex: "SUCO AURORA 1.5L" e "SUCO AURORA 1.5L TP." com mesmo EAN
          let eanParaUsar: string | null = null;
          if (isEanValido(mongoProduct.ean)) {
            const { data: eanExists } = await supabase
              .from("produtos")
              .select("id")
              .eq("codigo_barras", mongoProduct.ean)
              .maybeSingle();

            if (!eanExists) {
              eanParaUsar = mongoProduct.ean ?? null; // EAN livre, usa
            }
            // Se já existe, insere o produto com codigo_barras: null
          }

          const { data: newProduct, error: productError } = await supabase
            .from("produtos")
            .insert({
              nome: mongoProduct.nome_normalizado,
              marca: extrairMarca(mongoProduct.nome, mongoProduct.marca),
              codigo_barras: eanParaUsar,
              imagem_url: mongoProduct.url_imagem,
              categoria_id: categoriaId,
              tipo: mapearTipo(mongoProduct.categoria, categoriaId),
              ativo: true,
            })
            .select("id")
            .single();

          if (productError) {
            console.error(`❌ Erro ao inserir produto ${mongoProduct.nome}:`, productError.message);
            errosProduto++;
            continue;
          }

          produtoId = newProduct.id;
          migrados++;
        } else {
          produtoId = existing.id;
          jaExistiam++;
        }

        // 3. Montar todos os preços: atual + histórico
        const supermercadoId = mercadoParaSupermercadoId[mongoProduct.mercado];
        if (!supermercadoId) {
          mercadosNaoMapeados.add(mongoProduct.mercado);
          continue;
        }

        const todosOsPrecos: any[] = [];

        // Preço atual
        if (mongoProduct.preco_atual) {
          const dataAtual =
            typeof mongoProduct.data_ultima_coleta === "string"
              ? new Date(mongoProduct.data_ultima_coleta)
              : mongoProduct.data_ultima_coleta;

          todosOsPrecos.push({
            preco: mongoProduct.preco_atual,
            data_coleta: dataAtual.toISOString(),
            promocao: false,
            fonte_dados: "scraping",
            produto_id: produtoId,
            supermercado_id: supermercadoId,
          });
        }

        // Histórico de preços
        if (mongoProduct.historico_precos?.length > 0) {
          for (const h of mongoProduct.historico_precos) {
            if (!h.preco || !h.data) continue;

            const dataHist = new Date(h.data);
            const dataAtualStr =
              typeof mongoProduct.data_ultima_coleta === "string"
                ? mongoProduct.data_ultima_coleta.split("T")[0]
                : mongoProduct.data_ultima_coleta instanceof Date
                ? mongoProduct.data_ultima_coleta.toISOString().split("T")[0]
                : "";

            if (dataHist.toISOString().split("T")[0] === dataAtualStr) continue;

            todosOsPrecos.push({
              preco: h.preco,
              data_coleta: dataHist.toISOString(),
              promocao: false,
              fonte_dados: "scraping",
              produto_id: produtoId,
              supermercado_id: supermercadoId,
            });
          }
        }

        // 4. Inserir todos os preços em batch
        if (todosOsPrecos.length > 0) {
          const { error: precoError } = await supabase
            .from("precos")
            .insert(todosOsPrecos);

          if (precoError) {
            console.error(`❌ Erro ao inserir preços de ${mongoProduct.nome}:`, precoError.message);
            errosPreco++;
          } else {
            precosInseridos += 1;
            historicoInserido += todosOsPrecos.length - 1;
          }
        }
      } catch (error) {
        console.error(`❌ Erro inesperado no produto ${mongoProduct.nome}:`, error);
        errosProduto++;
      }
    }

    console.log(
      `✅ Lote concluído. Progresso: ${Math.min(skip + batch.length, total)}/${total}`
    );
  }

  console.log(`\n🎉 Migração concluída!`);
  console.log(`  📦 Produtos novos:      ${migrados}`);
  console.log(`  ♻️  Já existiam:         ${jaExistiam}`);
  console.log(`  💰 Preços inseridos:    ${precosInseridos}`);
  console.log(`  📜 Histórico inserido:  ${historicoInserido}`);
  console.log(`  ❌ Erros produto:       ${errosProduto}`);
  console.log(`  ❌ Erros preço:         ${errosPreco}`);

  if (categoriasNaoMapeadas.size > 0) {
    console.log(`\n⚠️  Categorias não mapeadas (${categoriasNaoMapeadas.size} únicas):`);
    [...categoriasNaoMapeadas].sort().forEach(c => console.log(`   - ${c}`));
  } else {
    console.log(`\n✅ Todas as categorias foram mapeadas!`);
  }

  if (mercadosNaoMapeados.size > 0) {
    console.log(`\n⚠️  Mercados não mapeados (${mercadosNaoMapeados.size} únicos):`);
    [...mercadosNaoMapeados].sort().forEach(m => console.log(`   - ${m}`));
  } else {
    console.log(`✅ Todos os mercados foram mapeados!`);
  }

  return { migrados, jaExistiam, precosInseridos, historicoInserido, errosProduto, errosPreco, total };
}

/**
 * Sincronização diária — roda após o scraper
 * Insere apenas produtos/preços das últimas 24h
 */
export async function syncUpdatedPrices() {
  const mongoDb = await getMongoDb();
  const supabase = getSupabaseServerClient();
  const collection = mongoDb.collection<MongoProduct>("produtos");

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  const produtosAtualizados = await collection
    .find({ data_ultima_coleta: { $gte: ontem } })
    .toArray();

  console.log(`🔄 Sincronizando ${produtosAtualizados.length} produtos atualizados...`);

  let precosInseridos = 0;
  let erros = 0;

  for (const produto of produtosAtualizados) {
    try {
      const { data: supabaseProduto } = await supabase
        .from("produtos")
        .select("id")
        .eq("nome", produto.nome_normalizado)
        .maybeSingle();

      if (!supabaseProduto) continue;

      const supermercadoId = mercadoParaSupermercadoId[produto.mercado];
      if (!supermercadoId || !produto.preco_atual) continue;

      const dataColeta =
        typeof produto.data_ultima_coleta === "string"
          ? new Date(produto.data_ultima_coleta)
          : produto.data_ultima_coleta;

      const hoje = dataColeta.toISOString().split("T")[0];
      const { data: jaExiste } = await supabase
        .from("precos")
        .select("id")
        .eq("produto_id", supabaseProduto.id)
        .eq("supermercado_id", supermercadoId)
        .gte("data_coleta", `${hoje}T00:00:00`)
        .lt("data_coleta", `${hoje}T23:59:59`)
        .maybeSingle();

      if (jaExiste) continue;

      const { error } = await supabase.from("precos").insert({
        preco: produto.preco_atual,
        data_coleta: dataColeta.toISOString(),
        promocao: false,
        fonte_dados: "scraping",
        produto_id: supabaseProduto.id,
        supermercado_id: supermercadoId,
      });

      if (error) {
        console.error(`❌ Erro ao sincronizar ${produto.nome}:`, error.message);
        erros++;
      } else {
        precosInseridos++;
      }
    } catch (error) {
      console.error(`❌ Erro inesperado em ${produto.nome}:`, error);
      erros++;
    }
  }

  if (precosInseridos > 0) {
    console.log(`💰 ${precosInseridos} novos preços sincronizados`);
  }
  console.log(`✅ Sync concluído! Preços inseridos: ${precosInseridos} | Erros: ${erros}`);
  return { precosInseridos, erros, totalProcessados: produtosAtualizados.length };
}