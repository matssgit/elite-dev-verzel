import { connect } from '../db/client.js';
import { processDue } from './service.js';

// No HTTP call to Render: the scheduled invocation executes the existing DB
// transactions and publishes the same durable outbox even while Render sleeps.
export default {
  async fetch(request:Request):Promise<Response> {
    if(request.method!=='POST')return new Response('Method not allowed',{status:405});
    if(!request.headers.get('x-neon-trigger-invocation-id'))return new Response('Forbidden',{status:403});
    if(process.env.FINANCIAL_MAINTENANCE==='true')return Response.json({ok:false,maintenance:true},{status:503});
    const url=process.env.DATABASE_URL_UNPOOLED??process.env.DATABASE_URL;
    if(!url)throw new Error('Missing scheduled settlement database');
    const {db,pool}=connect(url);let failures=0;
    try {
      await processDue(db,()=>{failures++;});
      const body=await request.json() as {data?:{scheduled_at?:string}};
      console.log(JSON.stringify({job:'settlement',scheduledAt:body.data?.scheduled_at,failures}));
      return Response.json({ok:failures===0,failures},{status:failures?503:200});
    }finally{await pool.end();}
  },
};
