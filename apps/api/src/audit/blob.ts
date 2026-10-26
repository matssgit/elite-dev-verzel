import { get, put, list } from '@vercel/blob';

// Separate credentials/provider from PostgreSQL. This is write-once by application
// convention, not WORM: the provider token can still delete/overwrite objects.
export class BlobCheckpoints {
  constructor(private token:string,readonly prefix:string) {
    if(!token || !/^[a-zA-Z0-9/_-]+\/$/.test(prefix))throw new Error('Invalid Blob checkpoint configuration');
  }
  async read(path:string):Promise<string|null> {
    const result=await get(this.prefix+path,{access:'private',token:this.token,useCache:false,abortSignal:AbortSignal.timeout(15000)});
    if(!result)return null;
    if(result.statusCode!==200)throw new Error('Unexpected checkpoint storage response');
    return new Response(result.stream).text();
  }
  async writeOnce(path:string,body:string) {
    const previous=await this.read(path);
    if(previous!==null){if(previous!==body)throw new Error('Checkpoint/key conflict; existing evidence preserved');return;}
    try {
      await put(this.prefix+path,body,{token:this.token,access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'text/plain',abortSignal:AbortSignal.timeout(15000)});
    }catch(error){
      // A concurrent writer may win. Never overwrite; only accept identical bytes.
      if(await this.read(path)!==body)throw error;
    }
  }
  async names(path:string):Promise<string[]> {
    const prefix=this.prefix+path;const names:string[]=[];let cursor:string|undefined;
    const cursors=new Set<string>();
    do {
      const page=await list({token:this.token,prefix,limit:1000,cursor,abortSignal:AbortSignal.timeout(15000)});
      for(const blob of page.blobs){if(!blob.pathname.startsWith(prefix))throw new Error('Invalid checkpoint listing');names.push(blob.pathname.slice(prefix.length));}
      if(!page.hasMore)break;
      if(!page.cursor || cursors.has(page.cursor))throw new Error('Incomplete checkpoint listing');
      cursor=page.cursor;cursors.add(cursor);
    }while(cursor);
    return names;
  }
}
