import { ObjectId } from "mongodb";
import { getMongoDb } from "@/lib/db/mongodb";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export type Product = {
  nome: string;
  mercado?: string;
  cidade?: string;
  preco?: number;
  createdAt?: string;
};

const RAW_COLLECTION = "produtos_raw";
const APP_COLLECTION = "produtos";
const APP_TABLE = "produtos";

export async function saveRawProductInMongo(product: Product) {
  const db = await getMongoDb();
  const payload = {
    ...product,
    createdAt: product.createdAt ?? new Date().toISOString(),
  };
  const result = await db.collection(RAW_COLLECTION).insertOne(payload);
  return { insertedId: result.insertedId.toString(), collection: RAW_COLLECTION };
}

export async function saveProductInMongo(product: Product) {
  const db = await getMongoDb();
  const payload = {
    ...product,
    createdAt: product.createdAt ?? new Date().toISOString(),
  };
  const result = await db.collection(APP_COLLECTION).insertOne(payload);
  return { insertedId: result.insertedId.toString(), collection: APP_COLLECTION };
}

export async function saveProductInSupabase(product: Product) {
  const supabase = getSupabaseServerClient();
  const payload = {
    nome: product.nome,
  };
  const { data, error } = await supabase.from(APP_TABLE).insert(payload).select();
  if (error) {
    throw new Error(error.message);
  }
  return { data, table: APP_TABLE };
}

export async function listProductsFromSupabase(limit = 20) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from(APP_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function runSetupTest() {
  const testProduct: Product = {
    nome: "Arroz 5kg",
    createdAt: new Date().toISOString(),
  };

  const status = {
    ok: true,
    product: testProduct,
    mongo: null as null | Record<string, unknown>,
    supabase: null as null | Record<string, unknown>,
  };

  try {
    const mongoResult = await saveProductInMongo(testProduct);
    status.mongo = { ok: true, ...mongoResult };
  } catch (error) {
    status.ok = false;
    status.mongo = {
      ok: false,
      error: error instanceof Error ? error.message : "Erro no MongoDB",
    };
  }

  try {
    const supabaseResult = await saveProductInSupabase(testProduct);
    status.supabase = { ok: true, ...supabaseResult };
  } catch (error) {
    status.ok = false;
    status.supabase = {
      ok: false,
      error: error instanceof Error ? error.message : "Erro no Supabase",
    };
  }

  return status;
}

export function normalizeLimit(value: string | null, fallback = 20) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 100);
}

export function isObjectId(value: string) {
  return ObjectId.isValid(value);
}
