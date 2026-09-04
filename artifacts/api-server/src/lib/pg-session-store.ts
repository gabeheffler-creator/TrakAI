import session from "express-session";
import { pool } from "@workspace/db";

/** Minimal PostgreSQL backed store; keeping sessions outside process memory makes
 * cookie authentication usable across API instances. */
export class PgSessionStore extends session.Store {
  override get(sid: string, callback: (error?: unknown, session?: session.SessionData | null) => void): void {
    pool.query("select sess from express_sessions where sid = $1 and expire > now()", [sid])
      .then(result => callback(undefined, (result.rows[0]?.sess as session.SessionData | undefined) ?? null))
      .catch(error => callback(error));
  }

  override set(sid: string, value: session.SessionData, callback?: (error?: unknown) => void): void {
    const maxAge = value.cookie?.maxAge ?? 7 * 24 * 60 * 60 * 1000;
    const expires = value.cookie?.expires ?? new Date(Date.now() + maxAge);
    pool.query(
      `insert into express_sessions (sid, sess, expire) values ($1, $2::jsonb, $3)
       on conflict (sid) do update set sess = excluded.sess, expire = excluded.expire`,
      [sid, JSON.stringify(value), expires],
    ).then(() => callback?.()).catch(error => callback?.(error));
  }

  override destroy(sid: string, callback?: (error?: unknown) => void): void {
    pool.query("delete from express_sessions where sid = $1", [sid])
      .then(() => callback?.()).catch(error => callback?.(error));
  }

  override touch(sid: string, value: session.SessionData, callback?: () => void): void {
    this.set(sid, value, () => callback?.());
  }
}