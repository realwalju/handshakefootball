import {createPostgresStore} from '../lib/postgres-store.mjs';

await createPostgresStore().setup();
console.log('Touchline Duel room storage is ready.');
