import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from "mysql2/promise";

type Conn = Pool | PoolConnection;
const g = globalThis as unknown as { __jujPool?: Pool };

export function pool(): Pool {
  if (!g.__jujPool) {
    g.__jujPool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: 10,
      charset: "UTF8MB4_UNICODE_CI",
      timezone: "Z",
      decimalNumbers: true,
      supportBigNumbers: true,
      typeCast: (field, next) => (field.type === "TINY" && field.length === 1 ? field.string() === "1" : next()),
    });
    (g.__jujPool as unknown as { pool: { on: (e: string, f: (c: { query: (s: string) => void }) => void) => void } }).pool.on(
      "connection",
      (c) => c.query("SET time_zone = '+00:00'"),
    );
  }
  return g.__jujPool;
}

export async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = [], c: Conn = pool()) {
  const [r] = await c.query(sql, params);
  return r as T[];
}

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = [], c: Conn = pool()) {
  return (await rows<T>(sql, params, c))[0] ?? null;
}

export async function exec(sql: string, params: unknown[] = [], c: Conn = pool()) {
  const [r] = await c.query(sql, params);
  return r as ResultSetHeader;
}

export async function tx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const c = await pool().getConnection();
  try {
    await c.beginTransaction();
    const out = await fn(c);
    await c.commit();
    return out;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
