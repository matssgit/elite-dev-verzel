import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import type { CatalogItem, ItemSnapshot } from '@elite/shared';
import type { Database } from '../db/client.js';
import { catalogItems } from '../db/schema.js';
import { AppError } from '../errors.js';

const searchResponse=z.object({docs:z.array(z.object({
  key:z.string(),title:z.string().max(1000),author_name:z.array(z.string()).optional(),
  first_publish_year:z.number().int().optional(),cover_i:z.number().int().positive().optional(),
}))});
const userAgent='EliteDevVerzel/1.0 (technical challenge; book catalog)';
async function coverImage(id:number|undefined):Promise<string|null> {
  if(!id)return null;
  try {
    const response=await fetch(`https://covers.openlibrary.org/b/id/${id}-M.jpg?default=false`,{signal:AbortSignal.timeout(4000),headers:{'User-Agent':userAgent}});
    if(!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg'))return null;
    // Stream with a strict size limit instead of buffering an unbounded external body.
    const reader=response.body?.getReader();if(!reader)return null;
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>250_000){await reader.cancel();return null;}chunks.push(part.value);}
    const buffer=Buffer.concat(chunks);
    if(buffer[0]!==0xff || buffer[1]!==0xd8)return null;
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch {return null;}
}
export async function searchCatalog(db:Database,query:string):Promise<{items:CatalogItem[];cached:boolean}> {
  try {
    const url=new URL('https://openlibrary.org/search.json');
    url.search=new URLSearchParams({q:query,limit:'8',fields:'key,title,author_name,first_publish_year,cover_i'}).toString();
    const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':userAgent}});
    if(!response.ok)throw new Error('Catalog unavailable');
    const data=searchResponse.parse(await response.json());
    const items:CatalogItem[]=[];
    // Sequential cover downloads respect the public provider's rate limit.
    for(const doc of data.docs) {
      const id=doc.key.replace(/^\/works\//,'');if(!/^OL\d+W$/.test(id))continue;
      const [existing]=await db.select().from(catalogItems).where(eq(catalogItems.id,id));
      if(existing){items.push({id,item:existing.item});continue;}
      const item:ItemSnapshot={catalogId:id,title:doc.title,authors:(doc.author_name??[]).slice(0,10),firstPublishYear:doc.first_publish_year??null,image:await coverImage(doc.cover_i),sourceUrl:`https://openlibrary.org/works/${id}`,importedAt:new Date().toISOString()};
      await db.insert(catalogItems).values({id,item}).onConflictDoNothing();
      items.push({id,item});
    }
    return {items,cached:false};
  } catch {
    const pattern=`%${query.replace(/[\\%_]/g,'\\$&')}%`;
    const cached=await db.select().from(catalogItems).where(sql`(${catalogItems.item}->>'title' ILIKE ${pattern} OR ${catalogItems.item}->>'authors' ILIKE ${pattern})`).limit(8);
    if(cached.length)return {items:cached.map(c=>({id:c.id,item:c.item})),cached:true};
    throw new AppError(503,'CATALOG_UNAVAILABLE','Catálogo indisponível. Tente novamente em instantes. Os lotes já publicados continuam disponíveis.');
  }
}
