export function memoryStore(){
  const rooms=new Map();let conflicts=0;
  return {rooms,get conflicts(){return conflicts;},async ping(){},async allowCreate(){return true;},
    async create(code,room,now){if(rooms.has(code))return false;rooms.set(code,{version:0,room:structuredClone(room),expires:now+1200000});return true;},
    async read(code,now){const saved=rooms.get(code);return saved&&saved.expires>now?structuredClone(saved):null;},
    async compareAndSet(code,version,room,now){const saved=rooms.get(code);if(!saved||saved.version!==version){conflicts++;return false;}rooms.set(code,{version:version+1,room:structuredClone(room),expires:now+1200000});return true;}
  };
}
