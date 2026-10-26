import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createGame,step,action} from './public/engine.js';

export function createServer(){
  const rooms=new Map();const root=new URL('./public/',import.meta.url);
  function fail(status,message){return Object.assign(new Error(message),{status});}
  async function body(req){const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>4096)throw fail(413,'Request too large');chunks.push(part);}let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw fail(400,'Invalid JSON');}if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'Expected a JSON object');return data;}
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  function auth(req,url){const r=rooms.get(url.searchParams.get('room'));if(!r)throw fail(404,'Room not found. Create a new match.');const token=req.headers.authorization?.replace(/^Bearer /,'')||url.searchParams.get('token');const team=r.members.findIndex(m=>m?.token===token);if(team<0)throw fail(403,'Invalid player session');return [r,team];}
  function broadcast(r){const payload=JSON.stringify({game:r.game,connected:r.members.map(m=>!!m?.stream),room:r.code,rematch:r.votes,status:r.members.every(m=>m?.stream)?'connected':r.members[1]?'paused':'waiting'});for(const m of r.members)if(m?.stream&&!m.stream.writableNeedDrain)m.stream.write(`data: ${payload}\n\n`);}
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    try{
      if(req.method==='POST'&&req.headers.origin){const o=new URL(req.headers.origin);if(o.host!==req.headers.host)throw fail(403,'Use this game’s own page');}
      if(req.method==='POST'&&url.pathname==='/api/create'){
        await body(req);
        if(rooms.size>=128)throw fail(503,'All rooms are busy. Try again shortly.');
        let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));
        const token=randomBytes(24).toString('hex');rooms.set(code,{code,game:createGame(),members:[{token,input:{},seen:Date.now(),stream:null},null],votes:[false,false],touched:Date.now()});return json(res,200,{room:code,token,team:0});
      }
      if(req.method==='POST'&&url.pathname==='/api/join'){
        const data=await body(req),r=rooms.get(String(data.room||'').trim().toUpperCase());if(!r)throw fail(404,'Room not found. Check the six-character code.');if(r.members[1])throw fail(409,'This room already has two players.');
        const token=randomBytes(24).toString('hex');r.members[1]={token,input:{},seen:Date.now(),stream:null};r.touched=Date.now();return json(res,200,{room:r.code,token,team:1});
      }
      if(req.method==='GET'&&url.pathname==='/api/events'){
        const [r,t]=auth(req,url),m=r.members[t];if(m.stream)m.stream.end();
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','Referrer-Policy':'no-referrer'});res.write('retry: 1000\n\n');m.stream=res;r.touched=Date.now();broadcast(r);
        req.on('close',()=>{if(m.stream===res){m.stream=null;m.input={};broadcast(r);}});return;
      }
      if(req.method==='POST'&&['/api/input','/api/action','/api/rematch','/api/leave'].includes(url.pathname)){
        const [r,t]=auth(req,url),data=await body(req),m=r.members[t];r.touched=Date.now();m.seen=Date.now();
        if(url.pathname==='/api/action'&&(!['pass','through','shoot','switch','tackle'].includes(data.kind)||['x','y','power'].some(key=>data[key]!==undefined&&!Number.isFinite(data[key]))))throw fail(400,'Invalid action or direction');
        if(url.pathname==='/api/input')m.input={x:Number.isFinite(data.x)?Math.max(-1,Math.min(1,data.x)):0,y:Number.isFinite(data.y)?Math.max(-1,Math.min(1,data.y)):0,sprint:!!data.sprint};
        if(url.pathname==='/api/action'&&r.members.every(m=>m?.stream)){if(Date.now()-(m.lastAction||0)>80){action(r.game,t,data.kind,data.x,data.y,data.power);m.lastAction=Date.now();}}
        if(url.pathname==='/api/rematch'&&r.game.phase==='ended'){r.votes[t]=true;if(r.votes.every(Boolean)){r.game=createGame();r.votes=[false,false];}}
        if(url.pathname==='/api/leave'){m.input={};m.stream?.end();m.stream=null;}
        return json(res,200,{ok:true});
      }
      if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true});
      if(req.method==='GET'&&url.pathname==='/api/config')return json(res,200,{transport:'sse'});
      const allowed={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/client.js':'client.js','/engine.js':'engine.js','/view-3d.js':'view-3d.js','/three-LICENSE.txt':'three-LICENSE.txt'};
      const name=allowed[url.pathname];if(req.method!=='GET'||!name)throw fail(404,'Not found');
      const data=await readFile(new URL(name,root));res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'text/plain; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(data);
    }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Something went wrong. Please try again.'});else res.end();}
  });
  const timer=setInterval(()=>{const now=Date.now();for(const [code,r] of rooms){if(!r.members.some(m=>m?.stream)&&now-r.touched>20*60*1000){rooms.delete(code);continue;}if(r.members.every(m=>m?.stream)){for(const m of r.members)if(now-m.seen>400)m.input={};step(r.game,r.members.map(m=>m.input),1/30);}broadcast(r);}},1000/30);
  timer.unref();server.on('close',()=>clearInterval(timer));return {server,rooms};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {server}=createServer();server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Touchline Duel running on port ${server.address().port}`));}
