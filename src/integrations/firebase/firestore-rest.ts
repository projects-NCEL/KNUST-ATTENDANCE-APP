import firebaseConfig from "../../../firebase-applet-config.json";

const PROJECT_ID = firebaseConfig.projectId;
const API_KEY = firebaseConfig.apiKey;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId || "(default)";

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

/** Convert a JS value to Firestore REST Value format */
export function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    return Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/** Convert a Firestore REST Value to plain JS value */
export function fromFirestoreValue(val: any): any {
  if (!val || typeof val !== "object") return null;
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return parseInt(val.integerValue, 10);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("booleanValue" in val) return Boolean(val.booleanValue);
  if ("timestampValue" in val) return val.timestampValue;
  if ("nullValue" in val) return null;
  if ("arrayValue" in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ("mapValue" in val) {
    const res: Record<string, any> = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return null;
}

/** Convert a Firestore Document response to plain JS object with ID */
export function fromFirestoreDoc(doc: any): any {
  if (!doc || !doc.fields) return null;
  const id = doc.name ? doc.name.split("/").pop() : "";
  const result: Record<string, any> = { id };
  for (const [k, v] of Object.entries(doc.fields)) {
    result[k] = fromFirestoreValue(v);
  }
  return result;
}

/** Cache store to minimize read units and gracefully survive quota limits */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const queryCache = new Map<string, CacheEntry<any[]>>();
const docCache = new Map<string, CacheEntry<any>>();

export function extractFirestoreErrorMessage(errPayload: any, fallback: string): string {
  if (!errPayload) return fallback;
  const item = Array.isArray(errPayload) ? errPayload[0] : errPayload;
  const msg = item?.error?.message || item?.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

export function isFirestoreQuotaError(status: number, message: string): boolean {
  if (status === 429) return true;
  const lower = (message || "").toLowerCase();
  return (
    lower.includes("quota limit exceeded") ||
    lower.includes("quota exceeded") ||
    lower.includes("resource_exhausted") ||
    lower.includes("free daily read units") ||
    lower.includes("read units per project")
  );
}

/** Invalidate cached queries for a given collection */
export function invalidateCache(collection: string) {
  for (const key of queryCache.keys()) {
    if (key.startsWith(`${collection}:`)) {
      queryCache.delete(key);
    }
  }
}

/** Get a single document by collection and ID */
export async function getDocRest(collection: string, docId: string): Promise<any | null> {
  const cacheKey = `${collection}/${docId}`;
  const now = Date.now();
  const cached = docCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  const url = `${BASE_URL}/${collection}/${encodeURIComponent(docId)}?key=${API_KEY}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const rawMsg = extractFirestoreErrorMessage(err, `Failed to fetch doc ${collection}/${docId}`);
    if (isFirestoreQuotaError(res.status, rawMsg)) {
      if (cached) {
        console.warn(`[Firestore REST] Serving cached doc ${cacheKey} due to quota limit.`);
        return cached.data;
      }
      throw new Error(`Firestore quota exceeded: Free daily read units limit reached.`);
    }
    throw new Error(rawMsg);
  }
  const data = await res.json();
  const doc = fromFirestoreDoc(data);
  if (doc) {
    docCache.set(cacheKey, { data: doc, expiresAt: now + 45000 });
  }
  return doc;
}

/** Set or update a single document */
export async function setDocRest(
  collection: string,
  docId: string,
  data: Record<string, any>,
  merge = true,
): Promise<any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }

  let url = `${BASE_URL}/${collection}/${encodeURIComponent(docId)}?key=${API_KEY}`;
  if (merge) {
    // In Firestore REST, updateMask defines which fields to write without clearing others
    const fieldParams = Object.keys(fields)
      .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
      .join("&");
    if (fieldParams) url += `&${fieldParams}`;
  }

  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const rawMsg = extractFirestoreErrorMessage(err, `Failed to save doc ${collection}/${docId}`);
    if (isFirestoreQuotaError(res.status, rawMsg)) {
      throw new Error(`Firestore quota exceeded: Write failed due to project quota limit.`);
    }
    throw new Error(rawMsg);
  }
  const saved = await res.json();
  const doc = fromFirestoreDoc(saved);

  // Invalidate caches
  invalidateCache(collection);
  if (doc) {
    docCache.set(`${collection}/${docId}`, { data: doc, expiresAt: Date.now() + 45000 });
  }

  return doc;
}

/** Delete a document */
export async function deleteDocRest(collection: string, docId: string): Promise<boolean> {
  const url = `${BASE_URL}/${collection}/${encodeURIComponent(docId)}?key=${API_KEY}`;
  const res = await fetch(url, { method: "DELETE" });
  if (res.ok) {
    invalidateCache(collection);
    docCache.delete(`${collection}/${docId}`);
  }
  return res.ok;
}

/** Run a query against a collection */
export async function queryCollectionRest(
  collectionId: string,
  options?: {
    where?: Array<{ field: string; op: "EQUAL" | "GREATER_THAN" | "LESS_THAN"; value: any }>;
    limit?: number;
  },
): Promise<any[]> {
  const queryKey = `${collectionId}:${JSON.stringify(options || {})}`;
  const now = Date.now();
  const cached = queryCache.get(queryKey);
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  const structuredQuery: any = {
    from: [{ collectionId }],
  };

  if (options?.where && options.where.length > 0) {
    if (options.where.length === 1) {
      const w = options.where[0];
      structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: w.field },
          op: w.op,
          value: toFirestoreValue(w.value),
        },
      };
    } else {
      structuredQuery.where = {
        compositeFilter: {
          op: "AND",
          filters: options.where.map((w) => ({
            fieldFilter: {
              field: { fieldPath: w.field },
              op: w.op,
              value: toFirestoreValue(w.value),
            },
          })),
        },
      };
    }
  }

  if (options?.limit) {
    structuredQuery.limit = options.limit;
  }

  const url = `${BASE_URL}:runQuery?key=${API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const rawMsg = extractFirestoreErrorMessage(err, `Query on ${collectionId} failed`);
    if (isFirestoreQuotaError(res.status, rawMsg)) {
      if (cached) {
        console.warn(`[Firestore REST] Serving cached query for ${collectionId} due to quota limit.`);
        return cached.data;
      }
      throw new Error(
        `Firestore quota exceeded: Quota exceeded for quota metric 'Free daily read units per project (free tier database)'. Limits reset daily at 00:00 UTC.`,
      );
    }
    throw new Error(rawMsg);
  }

  const list = await res.json();
  const results: any[] = [];
  for (const item of list) {
    if (item.document) {
      const doc = fromFirestoreDoc(item.document);
      if (doc) {
        results.push(doc);
        // Also prime single doc cache
        docCache.set(`${collectionId}/${doc.id}`, { data: doc, expiresAt: now + 45000 });
      }
    }
  }

  // TTL: 10 minutes for departments (almost static), 60 seconds for others
  const ttl = collectionId === "departments" ? 600000 : 60000;
  queryCache.set(queryKey, { data: results, expiresAt: now + ttl });

  return results;
}
