// Basemap colours, paint-only (never map.setStyle()).
// Copied and trimmed from Hao Wang's london-2100-generative-system,
// incubator/google-map-live/scripts/osm_basemap_themes.js (commit e22bf500):
// colorFor(), mixHex() and the capture/apply controller are his. Changes here:
// the controller takes a palette object (so the colour pickers can drive it),
// the light palettes are left out, and two more dark palettes are added.
// "dark" is his "Dark tech" palette and "mono", "faded" and "default" are his light ones, unchanged.
// "print" follows the light print sheets of this project (main roads #7a7476, rail black), with the sap green #849474. See ../SOURCE.md.

export const PALETTES=Object.freeze({
  dark:Object.freeze({ // Hao's "Dark tech"
    background:'#161616',land:'#1f1f1f',residential:'#242424',park:'#202020',water:'#0f0f10',
    building:'#2b2f33',buildingEdge:'#3b4045',extrusion:'#2b2f33',motorway:'#6e7378',primaryRoad:'#62676c',
    road:'#555a5f',rail:'#4a4f54',boundary:'#34383c',text:'#9a9a9a',textHalo:'#161616',poi:'#8a8a8a'
  }),
  night:Object.freeze({
    background:'#0e1116',land:'#12161c',residential:'#161b22',park:'#142019',water:'#0a1a2a',
    building:'#262c34',buildingEdge:'#343b45',extrusion:'#2a313a',motorway:'#8a8f96',primaryRoad:'#5d636b',
    road:'#3f454d',rail:'#6b7078',boundary:'#2a3039',text:'#a7adb5',textHalo:'#0e1116',poi:'#8a9099'
  }),
  black:Object.freeze({
    background:'#000000',land:'#050505',residential:'#0a0a0a',park:'#0b0f0b',water:'#0b0d12',
    building:'#1c1c1c',buildingEdge:'#2a2a2a',extrusion:'#222222',motorway:'#7a7a7a',primaryRoad:'#555555',
    road:'#3a3a3a',rail:'#666666',boundary:'#222222',text:'#9a9a9a',textHalo:'#000000',poi:'#888888'
  }),
  mono:Object.freeze({ // Hao's "Mono" (planning)
    background:'#f9f9f9',land:'#f9f9f9',residential:'#fafafa',park:'#f6f6f6',water:'#f4f4f4',building:'#ffffff',
    buildingEdge:'#e8e8e8',extrusion:'#ffffff',motorway:'#e6e6e6',primaryRoad:'#eaeaea',road:'#eeeeee',rail:'#dcdcdc',
    boundary:'#e5e5e5',text:'#999999',textHalo:'#ffffff',poi:'#b5b5b5'
  }),
  print:Object.freeze({
    background:'#ffffff',land:'#ffffff',residential:'#f7f7f7',park:'#849474',water:'#dde8f0',building:'#ececec',
    buildingEdge:'#d6d6d6',extrusion:'#f4f4f4',motorway:'#7a7476',primaryRoad:'#9a9597',road:'#cfcccd',rail:'#000000',
    boundary:'#d0d0d0',text:'#4a4a4a',textHalo:'#ffffff',poi:'#7a7a7a'
  }),
  faded:Object.freeze({ // Hao's "Faded"
    background:'#ecebe6',land:'#ecebe6',residential:'#e6e4de',park:'#dbe3d2',water:'#c6d4dc',building:'#e3e0d8',
    buildingEdge:'#d4d0c6',extrusion:'#eae7e0',motorway:'#e9dfca',primaryRoad:'#f7f6f2',road:'#f7f6f2',rail:'#d2cfc8',
    boundary:'#c9c4cc',text:'#7a7a78',textHalo:'#f4f3ef',poi:'#a3a29d'
  }),
  default:Object.freeze({ // Hao's "Default"
    background:'#f2f1ec',land:'#f2f1ec',residential:'#ecebe5',park:'#cfe8c4',water:'#9ccbf0',building:'#e2e0da',
    buildingEdge:'#cfccc4',extrusion:'#e9e6e0',motorway:'#f7d38c',primaryRoad:'#ffffff',road:'#ffffff',rail:'#c9c6bf',
    boundary:'#b8b2c8',text:'#4a4a4a',textHalo:'#ffffff',poi:'#7a7a7a'
  })
});

export function mixHex(a,b,t){
  const parse=h=>{let x=String(h).replace('#','');if(x.length===3)x=x.split('').map(c=>c+c).join('');const n=parseInt(x,16);return [(n>>16)&255,(n>>8)&255,n&255];};
  const A=parse(a),B=parse(b);
  return '#'+A.map((v,i)=>Math.max(0,Math.min(255,Math.round(v+(B[i]-v)*t))).toString(16).padStart(2,'0')).join('');
}

/** The seven colours the panel shows, read from a palette. */
export const picksFromPalette=p=>({land:p.land,water:p.water,green:p.park,roads:p.road,rail:p.rail,buildings:p.building,labels:p.text});

/** A full palette from the seven picked colours (the in-between greys are mixed from them). */
export function paletteFromPicks(k,light=false){
  const away=light?'#000000':'#ffffff';
  return {
    background:k.land,land:k.land,residential:mixHex(k.land,away,0.03),park:k.green,water:k.water,
    building:k.buildings,buildingEdge:mixHex(k.buildings,away,0.1),extrusion:mixHex(k.buildings,'#ffffff',0.04),
    motorway:mixHex(k.roads,away,0.25),primaryRoad:mixHex(k.roads,away,0.12),road:k.roads,rail:k.rail,
    boundary:mixHex(k.land,away,0.1),text:k.labels,textHalo:k.land,poi:mixHex(k.labels,k.land,0.1)
  };
}

const clonePaintValue=value=>value==null?value:JSON.parse(JSON.stringify(value));

// Hao's rule: which palette colour each Liberty layer takes, by its id and source-layer.
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
    return {'text-color':palette.text,'text-halo-color':palette.textHalo,'text-halo-width':1.2};
  }
  return {};
}

/** Capture the ORIGINAL Liberty layers once, then recolour them with apply(palette). */
export function createBasemapThemeController(map){
  const baseLayers=new Map();
  const applied=new Map();
  let captured=false;
  function capture(){
    if(captured)return;
    const style=map.getStyle?.();
    if(!style?.layers?.length)return;
    for(const layer of style.layers){
      if(!layer?.id)continue;
      const originalPaint=layer.paint||{};
      const hasFillPattern=layer.type==='fill'&&Object.prototype.hasOwnProperty.call(originalPaint,'fill-pattern');
      const hasFillOutline=layer.type==='fill'&&Object.prototype.hasOwnProperty.call(originalPaint,'fill-outline-color');
      baseLayers.set(layer.id,{
        id:layer.id,type:layer.type,'source-layer':layer['source-layer']||'',
        hasFillPattern,originalFillPattern:hasFillPattern?clonePaintValue(originalPaint['fill-pattern']):null,
        hasFillOutline,originalFillOutline:hasFillOutline?clonePaintValue(originalPaint['fill-outline-color']):null
      });
    }
    captured=true;
  }
  function apply(palette){
    capture();
    if(!captured||!palette)return false;
    for(const layer of baseLayers.values()){
      if(!map.getLayer?.(layer.id))continue;
      const paint=colorFor(layer,palette);
      if(layer.type==='fill'){
        // Liberty's wetland sprite and park outline are bright green: neutralise them (Hao).
        if(layer.hasFillPattern)paint['fill-pattern']=null;
        if(layer.hasFillOutline&&!/buildings?|house|structure/i.test(layer.id+' '+layer['source-layer'])){
          paint['fill-outline-color']=
            (/park|garden|forest|wood|grass|green|landcover|wetland|cemetery|meadow/i
              .test(layer.id+' '+layer['source-layer'])?palette.park:palette.boundary);
        }
      }
      for(const [key,value] of Object.entries(paint)){
        const identity=layer.id+'|'+key;
        if(applied.get(identity)===value)continue;
        try{map.setPaintProperty(layer.id,key,value);applied.set(identity,value);}
        catch(error){console.warn('Basemap colour not supported:',layer.id,key,error);}
      }
    }
    return true;
  }
  return {capture,apply,isBaseLayer:id=>baseLayers.has(id),getCapturedCount:()=>baseLayers.size};
}
