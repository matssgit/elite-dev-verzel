import { defineConfig } from 'tsup';
export default defineConfig({entry:{server:'src/server.ts',migrate:'src/db/migrate.ts',seed:'src/db/seed.ts','check-storage':'src/audit/check-storage.ts'},format:['esm'],platform:'node',target:'node22',splitting:false,external:['pg'],noExternal:['@elite/shared'],clean:true});
