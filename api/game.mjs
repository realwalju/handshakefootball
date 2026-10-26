import {createPostgresStore} from '../lib/postgres-store.mjs';
import {createServerlessHandler} from '../lib/serverless-handler.mjs';

export default createServerlessHandler(process.env.DATABASE_URL?createPostgresStore():null);
