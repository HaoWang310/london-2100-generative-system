// The colour-by-height tiles of the London map (v3.44.0): a MapLibre protocol in front of scripts/relief_worker.js.
// Tile address: l2100-relief://tiles/{ramp}/{top height, m}/{shade, %}/{z}/{x}/{y}. The ramp, the top height and
// the shade are in the address, so changing one makes new tiles (the heights themselves stay in the Worker).
export const RELIEF_MIN_ZOOM=6;
export const RELIEF_MAX_ZOOM=12;   // the height tiles are read up to zoom 12 (about 30 m); MapLibre enlarges beyond
export const RELIEF_TILE_SIZE=256;
export const RELIEF_RAMPS={
  classic:['#3d9be9','#35c3f0','#30e0e0','#2fe6a8','#2fe66f','#4be64a','#7bea3f','#a6ee3c','#cdf23a','#f0f53a',
    '#ffe838','#ffcf36','#ffb234','#ff9432','#ff7030','#ff4a30','#ff5f5f','#ff8f8f','#ffc0c0','#fff0f0'],
  muted:['#16323a','#1b4042','#235048','#30614b','#44724d','#5d8150','#788c54','#929458','#a8985b','#b6935a',
    '#ba8758','#b77a56','#b16e56','#b06a5c','#b87a6e','#c28e84','#cda59c','#d9bdb6','#e5d4cf','#efe6e2']
};
// The heights of the twenty colour steps: closer together near sea level.
export const reliefStops=top=>RELIEF_RAMPS.classic.map((_,i)=>-3+(top+3)*Math.pow(i/19,1.5));
export const reliefTileUrl=({ramp,top,shade})=>
  'l2100-relief://tiles/'+(RELIEF_RAMPS[ramp]?ramp:'classic')+'/'+Math.round(top)+'/'+Math.round(shade*100)+'/{z}/{x}/{y}';

export function createReliefLoader(config){
  let worker=null,nextId=0;
  const pending=new Map();

  function start(){
    if(worker)return;
    worker=new Worker(new URL('./relief_worker.js?v=3.44.0-english',import.meta.url),{type:'module'});
    worker.postMessage({type:'init',config});
    worker.onmessage=({data})=>{
      const request=pending.get(data.id);
      if(!request)return;
      pending.delete(data.id);
      request.cleanup();
      if(data.error)request.reject(new Error(data.error));
      else request.resolve({data:data.data,cacheControl:'max-age=86400'});
    };
    worker.onerror=(event)=>{
      const error=new Error(event?.message||'Height tiles failed to load');
      for(const request of pending.values()){request.cleanup();request.reject(error);}
      pending.clear();
      worker.terminate();
      worker=null;
    };
  }

  return (request,controller)=>{
    const match=/^l2100-relief:\/\/tiles\/([a-z]+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/.exec(request.url);
    if(!match)return Promise.reject(new Error('Invalid relief tile URL'));
    const signal=controller.signal;
    if(signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
    start();
    const id=++nextId;
    const [top,shade,z,x,y]=match.slice(2).map(Number);
    return new Promise((resolve,reject)=>{
      const cancel=()=>{
        pending.delete(id);
        worker?.postMessage({type:'cancel',id});
        cleanup();
        reject(new DOMException('Aborted','AbortError'));
      };
      const cleanup=()=>signal.removeEventListener('abort',cancel);
      pending.set(id,{resolve,reject,cleanup});
      signal.addEventListener('abort',cancel,{once:true});
      worker.postMessage({type:'tile',id,z,x,y,ramp:match[1],top,shade:shade/100});
    });
  };
}
