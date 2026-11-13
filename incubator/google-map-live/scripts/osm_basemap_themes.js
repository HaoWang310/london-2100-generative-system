/* London Map basemap colours. MapLibre paint-only themes: never call map.setStyle().
 * Capture Liberty base layer IDs and native fill-pattern / outline paints
 * BEFORE project analysis layers are added. Both architectural palettes
 * neutralise Liberty's wetland / pavement sprite textures and park outlines
 * while preserving true feature positions, filters, DEM, EA, flood and tensor.
 * Neither mode resets MapLibre sources or calls setStyle(). */
/* Colour themes (paint-only). "planning" is the Mono white/light-grey
   architectural reference and stays the default on every first load; "dark"
   is kept for the local-flood viewer's own theme switch. */
export const BASEMAP_THEMES=Object.freeze({
  default:Object.freeze({
    id:'default',name:'Default',dots:['#3d6cf0','#ffffff','#8fc98a'],extrusion:'#e9e6e0',
    background:'#f2f1ec',land:'#f2f1ec',residential:'#ecebe5',park:'#cfe8c4',water:'#9ccbf0',building:'#e2e0da',buildingEdge:'#cfccc4',motorway:'#f7d38c',primaryRoad:'#ffffff',road:'#ffffff',rail:'#c9c6bf',boundary:'#b8b2c8',text:'#4a4a4a',textHalo:'#ffffff',poi:'#7a7a7a'
  }),
  faded:Object.freeze({
    id:'faded',name:'Faded',dots:['#9aa6bd','#d9d2c3','#b8c4a8'],extrusion:'#eae7e0',
    background:'#ecebe6',land:'#ecebe6',residential:'#e6e4de',park:'#dbe3d2',water:'#c6d4dc',building:'#e3e0d8',buildingEdge:'#d4d0c6',motorway:'#e9dfca',primaryRoad:'#f7f6f2',road:'#f7f6f2',rail:'#d2cfc8',boundary:'#c9c4cc',text:'#7a7a78',textHalo:'#f4f3ef',poi:'#a3a29d'
  }),
  planning:Object.freeze({
    id:'planning',name:'Mono',dots:['#5c5c5c','#a8a8a8','#d6d6d6'],extrusion:'#ffffff',
    background:'#f9f9f9',land:'#f9f9f9',residential:'#fafafa',park:'#f6f6f6',water:'#f4f4f4',building:'#ffffff',buildingEdge:'#e8e8e8',motorway:'#e6e6e6',primaryRoad:'#eaeaea',road:'#eeeeee',rail:'#dcdcdc',boundary:'#e5e5e5',text:'#999999',textHalo:'#ffffff',poi:'#b5b5b5'
  }),
  ocean:Object.freeze({
    id:'ocean',name:'Ocean',dots:['#1f6a9e','#27a6b5','#7fd0c8'],extrusion:'#eef4f7',
    background:'#d9e6ec',land:'#dde8ee',residential:'#d4e1e8',park:'#c3ddd8',water:'#3e7ea8',building:'#e6eef2',buildingEdge:'#c7d6de',motorway:'#9cc7d4',primaryRoad:'#f2f7f9',road:'#f2f7f9',rail:'#a9c0cc',boundary:'#8fb0c2',text:'#2f5568',textHalo:'#eef5f8',poi:'#5f8ea3'
  }),
  warm:Object.freeze({
    id:'warm',name:'Warm',dots:['#c97a3a','#d9a066','#8a5a3a'],extrusion:'#f5e9da',
    background:'#f3e6d6',land:'#f3e7d8',residential:'#eedfcc',park:'#dfdcb8',water:'#b9cdd0',building:'#f1e2cf',buildingEdge:'#dcc7ab',motorway:'#e5a868',primaryRoad:'#fbf3e8',road:'#fbf3e8',rail:'#cdb79c',boundary:'#c9a98a',text:'#6b4a32',textHalo:'#fbf3e8',poi:'#a5764f'
  }),
  vivid:Object.freeze({
    id:'vivid',name:'Vivid',dots:['#ff4d4d','#2ee07a','#3d7bff'],extrusion:'#f3f0ea',
    background:'#f4f4ef',land:'#f4f4ef',residential:'#efefe8',park:'#9fe0a6',water:'#5aa9ff',building:'#eeeae2',buildingEdge:'#d6d0c4',motorway:'#ff8a5c',primaryRoad:'#ffd35a',road:'#ffffff',rail:'#b5b0aa',boundary:'#c58ef0',text:'#2b2b2b',textHalo:'#ffffff',poi:'#e2504a'
  }),
  dark:Object.freeze({
    id:'dark',name:'Dark tech',dots:['#161616','#555a5f','#9a9a9a'],extrusion:'#2b2f33',
    background:'#161616',land:'#1f1f1f',residential:'#242424',park:'#202020',water:'#0f0f10',building:'#2b2f33',buildingEdge:'#3b4045',motorway:'#6e7378',primaryRoad:'#62676c',road:'#555a5f',rail:'#4a4f54',boundary:'#34383c',text:'#9a9a9a',textHalo:'#161616',poi:'#8a8a8a'
  }),
});
export const normaliseBasemapTheme=value=>
  Object.prototype.hasOwnProperty.call(BASEMAP_THEMES,value)?value:'planning';
// MapLibre expression values are JSON-compatible; avoid structuredClone so
// style capture works in older browsers and lightweight test environments.
const clonePaintValue=value=>
  value==null?value:JSON.parse(JSON.stringify(value));

function colorFor(layer,palette){
  const id=String(layer.id||'').toLowerCase();
  const src=String(layer['source-layer']||'').toLowerCase();
  const label=id+' '+src;
  const has=pattern=>pattern.test(label);
  if(layer.type==='background')return {'background-color':palette.background};
  if(layer.type==='fill'||layer.type==='fill-extrusion'){
    const isBuilding=has(/buildings?|house|structure/);
    const color=isBuilding?palette.building:
      has(/water|river|lake|basin|dock|stream|canal/)?palette.water:
      has(/park|garden|forest|wood|grass|green|landcover|cemetery|meadow|allotment|farmland|vegetation/)?palette.park:
      has(/motorway|trunk|expressway|highway/)?palette.motorway:
      has(/primary|secondary|major|arterial|bridge/)?palette.primaryRoad:
      has(/road|street|transportation|tunnel|pedestrian|path|aeroway|airport/)?palette.road:
      has(/residential|commercial|industrial|landuse|construction/)?palette.residential:
      palette.land;
    const prop=layer.type==='fill-extrusion'?'fill-extrusion-color':'fill-color';
    const props={[prop]:color};
    if(isBuilding&&layer.type==='fill')props['fill-outline-color']=palette.buildingEdge;
    return props;
  }
  if(layer.type==='line'){
    const c=has(/water|river|stream|canal/)?palette.water:
      has(/rail|transit|subway|metro/)?palette.rail:
      has(/admin|boundary|border/)?palette.boundary:
      has(/motorway|trunk|expressway/)?palette.motorway:
      has(/primary|secondary|major|arterial|bridge/)?palette.primaryRoad:
      has(/road|street|path|pedestrian|transportation|tunnel/)?palette.road:
      has(/building/)?palette.buildingEdge:
      palette.boundary;
    return {'line-color':c};
  }
  if(layer.type==='circle'){
    return {'circle-color':has(/poi|place|station|transit/)?palette.poi:palette.rail};
  }
  if(layer.type==='symbol'){
    return {'text-color':palette.text,
      'text-halo-color':palette.textHalo,
      'text-halo-width':1.2};
  }
  return {}; // Raster terrain/EA layers are always managed by their own controls.
}

/* Lighting/weather tint: mix every palette colour except label text towards
   the tint colours, so night or fog darkens the basemap but labels stay legible. */
function mixHex(a,b,t){
  const parse=h=>{let x=String(h).replace('#','');if(x.length===3)x=x.split('').map(c=>c+c).join('');const n=parseInt(x,16);return [(n>>16)&255,(n>>8)&255,n&255];};
  const A=parse(a),B=parse(b);
  return '#'+A.map((v,i)=>Math.max(0,Math.min(255,Math.round(v+(B[i]-v)*t))).toString(16).padStart(2,'0')).join('');
}
const TINT_ROLE_OF={
  background:'ground',land:'ground',residential:'ground',park:'ground',water:'ground',boundary:'ground',
  motorway:'road',primaryRoad:'road',road:'road',rail:'road',
  building:'building',buildingEdge:'building'
};
export function tintPalette(palette,tints){
  if(!tints||!tints.length)return palette;
  const out={};
  for(const [key,value] of Object.entries(palette)){
    if(key==='text'||typeof value!=='string'||!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)){out[key]=value;continue;}
    const role=TINT_ROLE_OF[key];
    let c=value;
    for(const t of tints){
      if(!t)continue;
      const a=role&&t.roles&&t.roles[role]!=null?t.roles[role]:t.amount;
      if(a>0)c=mixHex(c,t.color,a);
    }
    out[key]=c;
  }
  return out;
}

/** All captured layer IDs are from the ORIGINAL OpenFreeMap style. */
export function createBasemapThemeController(map){
  const baseLayers=new Map();
  const applied=new Map();
  let active='planning',captured=false,tints=[];
  function capture(){
    if(captured)return;
    const style=map.getStyle?.();
    if(!style?.layers?.length)return;
    for(const layer of style.layers){
      if(!layer?.id)continue;
      const originalPaint=layer.paint||{};
      const hasFillPattern=layer.type==='fill'&&
        Object.prototype.hasOwnProperty.call(originalPaint,'fill-pattern');
      const originalFillPattern=hasFillPattern?
        clonePaintValue(originalPaint['fill-pattern']):null;
      // Liberty's 'park' layer contains a BRIGHT GREEN outline unrelated to
      // its fill color; it must be reset when using a monochrome palette.
      const hasFillOutline=layer.type==='fill'&&
        Object.prototype.hasOwnProperty.call(originalPaint,'fill-outline-color');
      const originalFillOutline=hasFillOutline?
        clonePaintValue(originalPaint['fill-outline-color']):null;
      baseLayers.set(layer.id,{
        id:layer.id,type:layer.type,'source-layer':layer['source-layer']||'',
        hasFillPattern,originalFillPattern,hasFillOutline,originalFillOutline
      });
    }
    captured=true;
  }
  function apply(mode='planning'){
    capture();
    active=normaliseBasemapTheme(mode);
    if(!captured)return false;
    const palette=tintPalette(BASEMAP_THEMES[active],tints);
    for(const layer of baseLayers.values()){
      if(!map.getLayer?.(layer.id))continue;
      const paint=colorFor(layer,palette);
      if(layer.type==='fill'){
        // A fill-pattern sprite overrides fill-color. The OpenFreeMap Liberty
        // wetlands sprite contains bright green reeds. BOTH themes are flat
        // grayscale, so never reinstate the original coloured sprite.
        if(layer.hasFillPattern)paint['fill-pattern']=null;
        // 'park' originally has a vivid green outline independent of fill.
        // Preserve its geometry but neutralise the outline in both styles.
        if(layer.hasFillOutline&&!/buildings?|house|structure/i.test(
          layer.id+' '+layer['source-layer'])){
          paint['fill-outline-color']=
            (/park|garden|forest|wood|grass|green|landcover|wetland|cemetery|meadow/i
              .test(layer.id+' '+layer['source-layer'])?palette.park:palette.boundary);
        }
      }
      for(const [key,value] of Object.entries(paint)){
        const identity=layer.id+'|'+key;
        if(applied.get(identity)===value)continue;
        try{
          // null removes MapLibre's sprite pattern paint property; no source,
          // layer, filter or underlying OSM feature is deleted.
          map.setPaintProperty(layer.id,key,value);
          applied.set(identity,value);
        }catch(error){
          // A rare style-specific layer may reject a generic property. Preserve
          // its existing geometry and continue with the remaining base layers.
          console.warn('Basemap colour not supported:',layer.id,key,error);
        }
      }
    }
    return true;
  }
  return {capture,apply,isBaseLayer:id=>baseLayers.has(id),
    setTint(next){tints=Array.isArray(next)?next:[];},
    getMode:()=>active,getCapturedCount:()=>baseLayers.size};
}
