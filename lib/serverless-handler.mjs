import {createRoomService,fail} from './room-service.mjs';

export function createServerlessHandler(store,{clock=Date.now}={}){
  const perform=store?createRoomService(store,{clock}):null;
  return async function handler(req,res){
    const reply=(status,data)=>{
      res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
      res.end(JSON.stringify(data));
    };
    try{
      const url=new URL(req.url,'http://localhost'),operation=url.searchParams.get('operation')||url.pathname.split('/').pop();
      if(req.method==='GET'&&operation==='config')return reply(200,{transport:'poll',interval:50});
      if(req.method==='GET'&&operation==='health'){
        if(!store)throw fail(503,'Online matches are temporarily unavailable. Please try warm-up.');
        await store.ping();return reply(200,{ok:true,transport:'poll'});
      }
      if(req.method!=='POST'||!['create','join','sync','input','action','rematch','leave'].includes(operation))throw fail(404,'Not found');
      if(req.headers.origin){
        let origin;try{origin=new URL(req.headers.origin);}catch{throw fail(403,'Use this game\u2019s own page');}
        if(origin.host!==req.headers.host)throw fail(403,'Use this game\u2019s own page');
      }
      let data=req.body;
      if(data===undefined){
        const chunks=[];let bytes=0;
        for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)throw fail(413,'Request too large');chunks.push(chunk);}
        data=Buffer.concat(chunks).toString('utf8')||'{}';
      }
      if(Buffer.isBuffer(data))data=data.toString('utf8');
      if(typeof data==='string'){
        if(Buffer.byteLength(data)>4096)throw fail(413,'Request too large');
        try{data=JSON.parse(data);}catch{throw fail(400,'Invalid JSON');}
      }
      if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'Expected a JSON object');
      if(Buffer.byteLength(JSON.stringify(data))>4096)throw fail(413,'Request too large');
      if(!perform)throw fail(503,'Online matches are temporarily unavailable. Please try warm-up.');
      const token=req.headers.authorization?.replace(/^Bearer /,''),room=url.searchParams.get('room');
      const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
      reply(200,await perform(operation,data,{room,token},ip));
    }catch(error){
      if(!error.status)console.error('Room storage request failed:',error.name);
      reply(error.status||503,{error:error.status?error.message:'Online matches are temporarily unavailable. Please try again shortly.'});
    }
  };
}
