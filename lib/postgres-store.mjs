import {neon} from '@neondatabase/serverless';

export function createPostgresStore(url=process.env.DATABASE_URL){
  if(!url)throw new Error('DATABASE_URL is required');
  const sql=neon(url);
  return {
    async setup(){
      await sql`CREATE TABLE IF NOT EXISTS touchline_rooms (
        code text PRIMARY KEY, version integer NOT NULL DEFAULT 0,
        data jsonb NOT NULL, expires_at timestamptz NOT NULL)`;
      await sql`CREATE INDEX IF NOT EXISTS touchline_rooms_expiry ON touchline_rooms(expires_at)`;
      await sql`CREATE TABLE IF NOT EXISTS touchline_limits (
        key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL)`;
    },
    async ping(){await sql`SELECT code FROM touchline_rooms LIMIT 1`;},
    async allowCreate(key,now){
      const bucket=`${key}:${Math.floor(now/60000)}`;
      const rows=await sql`INSERT INTO touchline_limits (key,count,expires_at)
        VALUES (${bucket},1,to_timestamp(${now/1000})+interval '2 minutes')
        ON CONFLICT (key) DO UPDATE SET count=touchline_limits.count+1 RETURNING count`;
      return rows[0].count<=8;
    },
    async create(code,room,now){
      const time=now/1000;
      const results=await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(824619312)`,
        sql`DELETE FROM touchline_rooms WHERE expires_at<=to_timestamp(${time})`,
        sql`DELETE FROM touchline_limits WHERE expires_at<=to_timestamp(${time})`,
        sql`INSERT INTO touchline_rooms (code,data,expires_at)
          SELECT ${code},${JSON.stringify(room)}::jsonb,to_timestamp(${time})+interval '20 minutes'
          WHERE (SELECT count(*) FROM touchline_rooms)<128
          ON CONFLICT (code) DO NOTHING RETURNING code`
      ]);
      return results[3].length===1;
    },
    async read(code,now){
      const rows=await sql`SELECT version,data FROM touchline_rooms
        WHERE code=${code} AND expires_at>to_timestamp(${now/1000})`;
      return rows[0]?{version:rows[0].version,room:rows[0].data}:null;
    },
    async compareAndSet(code,version,room,now){
      const rows=await sql`UPDATE touchline_rooms SET data=${JSON.stringify(room)}::jsonb,
        version=version+1,expires_at=to_timestamp(${now/1000})+interval '20 minutes'
        WHERE code=${code} AND version=${version} AND expires_at>to_timestamp(${now/1000})
        RETURNING version`;
      return rows.length===1;
    }
  };
}
