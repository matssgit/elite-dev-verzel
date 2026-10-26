import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import type { WebSocket } from 'ws';
import { z } from 'zod';

export async function registerRealtime(app:FastifyInstance,databaseUrl:string,webOrigin:string) {
  const rooms=new Map<string,Set<WebSocket>>();
  let client:pg.Client|undefined;let closing=false;let reconnect:ReturnType<typeof setTimeout>|undefined;
  function send(socket:WebSocket,payload:object) {
    if(socket.readyState!==1)return;
    if(socket.bufferedAmount>128_000){socket.terminate();return;}
    socket.send(JSON.stringify(payload));
  }
  async function listen() {
    if(closing)return;
    const connection=new pg.Client({connectionString:databaseUrl,connectionTimeoutMillis:5000});client=connection;
    connection.on('error',error=>app.log.warn({err:error},'Realtime PostgreSQL connection failed'));
    connection.on('end',()=>{
      if(!closing)reconnect=setTimeout(()=>{void listen();},2000);
    });
    connection.on('notification',message=>{
      try {
        const event=z.object({auctionId:z.uuid()}).parse(JSON.parse(message.payload??''));
        for(const socket of rooms.get(event.auctionId)??[])send(socket,{type:'auction.updated',auctionId:event.auctionId});
      } catch {app.log.warn('Invalid realtime notification ignored');}
    });
    try {await connection.connect();await connection.query('LISTEN auction_events');
      for(const sockets of rooms.values())for(const socket of sockets)send(socket,{type:'resync'});
    } catch(error) {
      app.log.warn({err:error},'Realtime listener unavailable; retrying');
      await connection.end().catch(()=>{});
    }
  }
  app.addHook('onReady',listen);
  const timer=setInterval(()=>{
    for(const sockets of rooms.values())for(const socket of sockets)send(socket,{type:'resync'});
  },15_000);
  timer.unref();
  app.addHook('preClose',async()=>{
    closing=true;clearInterval(timer);clearTimeout(reconnect);
    for(const sockets of rooms.values())for(const socket of sockets)socket.close(1001,'Server shutdown');
    rooms.clear();await client?.end().catch(()=>{});
  });
  app.get('/auctions/:id/events',{
    websocket:true,
    preValidation:async req=>{
      z.object({id:z.uuid()}).parse(req.params);
      // Public data only; reject cross-origin browser upgrades. Non-browser clients may omit Origin.
      if(req.headers.origin && req.headers.origin!==webOrigin)throw Object.assign(new Error('Origem não autorizada.'),{statusCode:403});
    },
  },(socket,req)=>{
    const {id}=req.params as {id:string};
    const members=rooms.get(id)??new Set<WebSocket>();members.add(socket);rooms.set(id,members);
    socket.on('error',()=>socket.terminate());
    socket.on('close',()=>{members.delete(socket);if(!members.size)rooms.delete(id);});
    // Read-only socket. Bids go through authenticated, rate-limited HTTP.
    send(socket,{type:'resync'});
  });
}
