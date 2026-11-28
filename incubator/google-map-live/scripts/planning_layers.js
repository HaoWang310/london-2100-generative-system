// The planning layers of the London map (v3.44.0): colour by height, the London Green Belt, AONB, rail by service,
// HS1 and HS2. They come from incubator/loop-city-real-map (v13) and are drawn here as analysis layers, cut to the
// 70 km study circle like the flood and drainage layers (HS1 and HS2 are kept whole on purpose).
//
// This module owns its sources and layers (every id starts with "l2100-") and their look; the page owns the panel.
// Nothing is loaded until a layer is first switched on.
import {createReliefLoader,reliefTileUrl,reliefStops,RELIEF_RAMPS,RELIEF_MIN_ZOOM,RELIEF_MAX_ZOOM,RELIEF_TILE_SIZE,
  DEM_TILE_URL,DEM_MAX_ZOOM}
  from './relief_local.js?v=3.46.2';

export {RELIEF_RAMPS,reliefStops};
export const PLANNING_PREFIX='l2100-';
export const HEIGHT_TILES='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const RAIL_KINDS=['national','overground','elizabeth','dlr','tram','underground'];   // drawn in this order
export const RAIL_COLOURS={national:'#c9c9c9',overground:'#EE7C0E',elizabeth:'#6950A1',dlr:'#00AFAD',tram:'#5FB526',
  underground:'#E32017'};
// National Rail by line speed (mph): the stops of the real-map app.
export const SPEED_STOPS=[[20,'#3b6fd4'],[60,'#35c26b'],[90,'#f2d53c'],[110,'#f08a2c'],[125,'#e0362c'],[186,'#c04be0']];
const SHADE='#3b7cff';
const GREEN_BELT='#849474',AONB='#4f6b45';
const GB_EDGE=[1.3,2.2,3],AONB_EDGE=[1.2,1.8,2.4];

const RELIEF='l2100-relief';
// v3.46.2: 3D relief. The ground itself rises (MapLibre terrain) inside the study circle; every draped layer follows.
const DEM='l2100-dem';
export const RELIEF3D_RANGE=[1,8,0.5];   // exaggeration: least, most, step (London is low: 1 is hard to see)
const GB_SOURCE='l2100-green-belt',GB_FILL='l2100-green-belt-fill',GB_LINE='l2100-green-belt-line';
const AONB_SOURCE='l2100-aonb',AONB_FILL='l2100-aonb-fill',AONB_LINE='l2100-aonb-line';
const RAIL_SOURCE='l2100-rail',railLayer=kind=>'l2100-rail-'+kind;
const HS_SOURCE='l2100-highspeed',HS1='l2100-hs1',HS2='l2100-hs2',HS2_TUNNEL='l2100-hs2-tunnel';
// v3.44.1: where the high-speed lines go. Zoomed out (below zoom 9) the ends and where the trains run on; zoomed in,
// the stations. English, as the basemap's own place names (its font has no Chinese and no arrows).
const HS_PLACES='l2100-hs-places',HS_ENDS='l2100-hs-ends',HS_DOTS='l2100-hs-stations',HS_NAMES='l2100-hs-station-names';
const HS_LABEL_ZOOM=9;
const place=(name,kind,line,lngLat,anchor)=>({type:'Feature',properties:{name,kind,line,anchor},
  geometry:{type:'Point',coordinates:lngLat}});
const HS_PLACE_DATA={type:'FeatureCollection',features:[
  place('HS2 to Birmingham','end','hs2',[-1.8848,52.4814],'right'),
  place('to Manchester · Glasgow\n(West Coast Main Line)','beyond','hs2',[-1.86401,52.73764],'bottom'),
  place('London','end','both',[-0.13,51.53],'top'),
  place('HS1 to Paris · Brussels\n(Channel Tunnel)','beyond','hs1',[1.15584,51.09697],'top'),
  place('London Euston','station','hs2',[-0.13391,51.52683],''),
  place('Old Oak Common','station','hs2',[-0.24829,51.52461],''),
  place('Birmingham Interchange','station','hs2',[-1.7155,52.448],''),
  place('Birmingham Curzon Street','station','hs2',[-1.8848,52.4814],''),
  place('London St Pancras','station','hs1',[-0.12812,51.53454],''),
  place('Stratford International','station','hs1',[-0.0087,51.5448],''),
  place('Ebbsfleet International','station','hs1',[0.32089,51.44322],''),
  place('Ashford International','station','hs1',[0.87777,51.14261],'')]};
const SOURCES={relief:RELIEF,relief3d:DEM,greenBelt:GB_SOURCE,aonb:AONB_SOURCE,rail:RAIL_SOURCE,highSpeed:HS_SOURCE};

const mix=(a,b,t)=>{
  const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),x=p(a),y=p(b);
  return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');
};
const edgeWidth=(w,k)=>['interpolate',['linear'],['zoom'],8,w[0]*k,12,w[1]*k,15,w[2]*k];

/* The four corners (west, south, east, north) of the study circle, for the bounds of the height tiles. */
function circleBounds(center,radius){
  const dLat=radius/6378137*180/Math.PI,dLng=dLat/Math.cos(center.lat*Math.PI/180);
  return [center.lng-dLng*1.01,center.lat-dLat*1.01,center.lng+dLng*1.01,center.lat+dLat*1.01];
}

export function createPlanningLayers({map,maplibregl,assetUrl,center,radius,getTheme,onStatus=()=>{},reorder=()=>{}}){
  const state={
    relief:{on:false,opacity:0.75,top:300,ramp:'classic',shade:0.35},
    relief3d:{on:false,exaggeration:3},
    greenBelt:{on:false,fill:0.25,width:1},
    aonb:{on:false,fill:0.12,width:1},
    rail:{on:false,mode:'lines',width:1,
      kinds:{national:true,overground:true,elizabeth:true,dlr:true,tram:true,underground:true}},
    highSpeed:{on:false,hs1:true,hs2:true,colour:'#ff2d95'}
  };
  const errors={};
  const dark=()=>getTheme()==='dark';
  const data=name=>new URL(assetUrl('assets/planning/'+name+'.geojson'),location.href).href;
  const has=id=>!!map.getLayer(id);
  const show=(id,on)=>{
    if(!has(id))return;
    const value=on?'visible':'none';
    if(map.getLayoutProperty(id,'visibility')!==value)map.setLayoutProperty(id,'visibility',value);
  };
  const firstSymbol=()=>(map.getStyle()?.layers||[]).find(layer=>layer.type==='symbol')?.id;
  // Colour by height sits low: over the land-use fills, under water, roads, the EA terrain picture and everything
  // else. In the raster fallback style there is no water layer; then it goes under that style's labels.
  const underWater=()=>(map.getStyle()?.layers||[])
    .find(layer=>/^(water|waterway)$/.test(String(layer['source-layer']||'')))?.id
    ||(map.getLayer('osm-light-labels-layer')?'osm-light-labels-layer':firstSymbol());

  maplibregl.addProtocol('l2100-relief',createReliefLoader({tiles:HEIGHT_TILES,center,radius}));

  /* ---------- colour by height ---------- */
  function applyRelief(){
    const s=state.relief;
    if(s.on&&!map.getSource(RELIEF)){
      map.addSource(RELIEF,{type:'raster',tiles:[reliefTileUrl(s)],tileSize:RELIEF_TILE_SIZE,
        minzoom:RELIEF_MIN_ZOOM,maxzoom:RELIEF_MAX_ZOOM,bounds:circleBounds(center,radius),
        attribution:'Heights: Terrain Tiles (Mapzen, AWS Open Data)'});
      map.addLayer({id:RELIEF,type:'raster',source:RELIEF,
        paint:{'raster-opacity':s.opacity,'raster-fade-duration':0,'raster-resampling':'linear'}},underWater());
    }
    if(!has(RELIEF))return;
    show(RELIEF,s.on);
    map.setPaintProperty(RELIEF,'raster-opacity',s.opacity);
    const url=reliefTileUrl(s),source=map.getSource(RELIEF);
    if(source.tiles?.[0]!==url)source.setTiles([url]);
  }

  /* ---------- 3D relief: the ground rises inside the study circle ---------- */
  function applyRelief3d(){
    const s=state.relief3d;
    if(s.on&&!map.getSource(DEM)){
      const [west,south,east,north]=circleBounds(center,radius+3000);
      map.addSource(DEM,{type:'raster-dem',tiles:[DEM_TILE_URL],tileSize:RELIEF_TILE_SIZE,encoding:'terrarium',
        maxzoom:DEM_MAX_ZOOM,bounds:[west,south,east,north],attribution:'Heights: Terrain Tiles (Mapzen, AWS Open Data)'});
    }
    const now=map.getTerrain?.();
    if(s.on){
      const exaggeration=Math.min(RELIEF3D_RANGE[1],Math.max(RELIEF3D_RANGE[0],Number(s.exaggeration)||1));
      if(!now||now.source!==DEM||now.exaggeration!==exaggeration)map.setTerrain({source:DEM,exaggeration});
    }else if(now&&now.source===DEM)map.setTerrain(null);
  }

  /* ---------- Green Belt, AONB ---------- */
  function applyGreenBelt(){
    const s=state.greenBelt;
    if(s.on&&!map.getSource(GB_SOURCE)){
      map.addSource(GB_SOURCE,{type:'geojson',data:data('green_belt'),
        attribution:'Green Belt: MHCLG 2024/25 · Open Government Licence'});
      map.addLayer({id:GB_FILL,type:'fill',source:GB_SOURCE,paint:{'fill-color':GREEN_BELT,'fill-opacity':s.fill}},
        firstSymbol());
      map.addLayer({id:GB_LINE,type:'line',source:GB_SOURCE,layout:{'line-join':'round'},
        paint:{'line-color':mix(GREEN_BELT,'#000000',0.15),'line-width':edgeWidth(GB_EDGE,s.width)}},firstSymbol());
      reorder();
    }
    if(!has(GB_FILL))return;
    show(GB_FILL,s.on);show(GB_LINE,s.on);
    map.setPaintProperty(GB_FILL,'fill-opacity',s.fill);
    map.setPaintProperty(GB_LINE,'line-width',edgeWidth(GB_EDGE,s.width));
    map.setPaintProperty(GB_LINE,'line-color',dark()?mix(GREEN_BELT,'#ffffff',0.2):mix(GREEN_BELT,'#000000',0.25));
  }
  function applyAonb(){
    const s=state.aonb;
    if(s.on&&!map.getSource(AONB_SOURCE)){
      map.addSource(AONB_SOURCE,{type:'geojson',data:data('aonb'),
        attribution:'AONB: Natural England · Open Government Licence'});
      map.addLayer({id:AONB_FILL,type:'fill',source:AONB_SOURCE,paint:{'fill-color':AONB,'fill-opacity':s.fill}},
        firstSymbol());
      map.addLayer({id:AONB_LINE,type:'line',source:AONB_SOURCE,layout:{'line-join':'round'},
        paint:{'line-color':AONB,'line-dasharray':[3,2],'line-width':edgeWidth(AONB_EDGE,s.width)}},firstSymbol());
      reorder();
    }
    if(!has(AONB_FILL))return;
    show(AONB_FILL,s.on);show(AONB_LINE,s.on);
    map.setPaintProperty(AONB_FILL,'fill-opacity',s.fill);
    map.setPaintProperty(AONB_LINE,'line-width',edgeWidth(AONB_EDGE,s.width));
    map.setPaintProperty(AONB_LINE,'line-color',dark()?mix(AONB,'#ffffff',0.35):AONB);
  }

  /* ---------- rail by service ---------- */
  function railColour(kind){
    const mode=state.rail.mode,national=dark()?'#c9c9c9':'#1c1c1e';
    if(mode==='shades'){
      // One colour, three shades: National Rail dark, Underground and DLR as it is, the others light.
      if(kind==='national')return mix(SHADE,'#000000',dark()?0.38:0.55);
      if(kind==='underground'||kind==='dlr')return SHADE;
      return mix(SHADE,'#ffffff',dark()?0.55:0.45);
    }
    if(kind==='national'){
      if(mode!=='speed')return national;
      return ['case',['has','mph'],['interpolate',['linear'],['get','mph'],...SPEED_STOPS.flat()],'#8a8a8a'];
    }
    // Each line in its own colour (property c); the black Northern line turns light on the dark map.
    return ['case',['==',['get','c'],'#000000'],dark()?'#e8e8e8':'#000000',
      ['has','c'],['to-color',['get','c']],RAIL_COLOURS[kind]];
  }
  function railWidth(kind){
    const m=kind==='national'?['case',['==',['get','u'],'main'],1.35,1]:1.2,w=state.rail.width;
    return ['interpolate',['linear'],['zoom'],8,['*',0.8*w,m],12,['*',1.7*w,m],16,['*',4*w,m]];
  }
  function applyRail(){
    const s=state.rail;
    if(s.on&&!map.getSource(RAIL_SOURCE)){
      map.addSource(RAIL_SOURCE,{type:'geojson',data:data('rail'),
        attribution:'Rail lines © OpenStreetMap contributors'});
      for(const kind of RAIL_KINDS){
        map.addLayer({id:railLayer(kind),type:'line',source:RAIL_SOURCE,filter:['==',['get','k'],kind],
          layout:{'line-join':'round','line-cap':'round'},
          paint:{'line-color':railColour(kind),'line-width':railWidth(kind)}},firstSymbol());
      }
      reorder();
    }
    if(!has(railLayer('national')))return;
    for(const kind of RAIL_KINDS){
      show(railLayer(kind),s.on&&s.kinds[kind]);
      map.setPaintProperty(railLayer(kind),'line-color',railColour(kind));
      map.setPaintProperty(railLayer(kind),'line-width',railWidth(kind));
    }
  }

  /* ---------- HS1, HS2 (whole lines, not cut to the circle) ---------- */
  const hsWidth=()=>['interpolate',['linear'],['zoom'],5,1.2,8,1.9,12,3,16,6];
  function applyHighSpeed(){
    const s=state.highSpeed;
    if(s.on&&!map.getSource(HS_SOURCE)){
      map.addSource(HS_SOURCE,{type:'geojson',data:data('highspeed'),
        attribution:'HS2 route: HS2 Ltd · Open Government Licence'});
      const round={'line-join':'round','line-cap':'round'};
      map.addLayer({id:HS1,type:'line',source:HS_SOURCE,filter:['==',['get','k'],'hs1'],layout:round,
        paint:{'line-color':s.colour,'line-width':hsWidth()}},firstSymbol());
      map.addLayer({id:HS2,type:'line',source:HS_SOURCE,
        filter:['all',['==',['get','k'],'hs2'],['!=',['get','t'],'tunnel']],layout:round,
        paint:{'line-color':s.colour,'line-width':hsWidth()}},firstSymbol());
      map.addLayer({id:HS2_TUNNEL,type:'line',source:HS_SOURCE,
        filter:['all',['==',['get','k'],'hs2'],['==',['get','t'],'tunnel']],layout:{'line-join':'round'},
        paint:{'line-color':s.colour,'line-width':hsWidth(),'line-dasharray':[2,1.4]}},firstSymbol());
      reorder();
    }
    if(!has(HS1))return;
    show(HS1,s.on&&s.hs1);show(HS2,s.on&&s.hs2);show(HS2_TUNNEL,s.on&&s.hs2);
    for(const id of [HS1,HS2,HS2_TUNNEL])map.setPaintProperty(id,'line-color',s.colour);
    applyHighSpeedPlaces();
  }
  // The names need the style's glyphs: the raster fallback style has none, and then only the lines are drawn.
  function applyHighSpeedPlaces(){
    const s=state.highSpeed;
    if(s.on&&!map.getSource(HS_PLACES)&&map.getStyle()?.glyphs){
      const font=(map.getStyle().layers.find(l=>l.type==='symbol'&&/label_city|place/i.test(l.id))?.layout?.['text-font'])
        ||['Noto Sans Regular'];
      const bold=font.map(f=>f.replace(/Regular|Italic/,'Bold'));
      map.addSource(HS_PLACES,{type:'geojson',data:HS_PLACE_DATA});
      map.addLayer({id:HS_DOTS,type:'circle',source:HS_PLACES,minzoom:HS_LABEL_ZOOM,filter:['==',['get','kind'],'station'],
        paint:{'circle-radius':['interpolate',['linear'],['zoom'],9,3,13,5.5],'circle-stroke-width':2}});
      map.addLayer({id:HS_NAMES,type:'symbol',source:HS_PLACES,minzoom:HS_LABEL_ZOOM,filter:['==',['get','kind'],'station'],
        layout:{'text-field':['get','name'],'text-font':font,'text-size':12,'text-variable-anchor':['left','right','top','bottom'],
          'text-radial-offset':0.75,'text-max-width':12},
        paint:{'text-halo-width':1.8}});
      map.addLayer({id:HS_ENDS,type:'symbol',source:HS_PLACES,maxzoom:HS_LABEL_ZOOM,filter:['!=',['get','kind'],'station'],
        layout:{'text-field':['get','name'],'text-font':bold,'text-size':['match',['get','kind'],'end',14,12],
          'text-anchor':['get','anchor'],
          'text-offset':['match',['get','anchor'],'right',['literal',[-0.9,0]],'bottom',['literal',[0,-0.6]],
            'top',['literal',[0,0.8]],['literal',[0,0]]],
          'text-allow-overlap':true,'text-max-width':20},
        paint:{'text-halo-width':2}});
    }
    if(!has(HS_ENDS))return;
    const lines=['both',...(s.hs1?['hs1']:[]),...(s.hs2?['hs2']:[])];
    const onLine=['in',['get','line'],['literal',(s.hs1||s.hs2)?lines:[]]];
    map.setFilter(HS_DOTS,['all',['==',['get','kind'],'station'],onLine]);
    map.setFilter(HS_NAMES,['all',['==',['get','kind'],'station'],onLine]);
    map.setFilter(HS_ENDS,['all',['!=',['get','kind'],'station'],onLine]);
    for(const id of [HS_DOTS,HS_NAMES,HS_ENDS])show(id,s.on);
    const text=dark()?mix(s.colour,'#ffffff',0.35):mix(s.colour,'#000000',0.25),halo=dark()?'#161616':'#ffffff';
    map.setPaintProperty(HS_DOTS,'circle-color',halo);
    map.setPaintProperty(HS_DOTS,'circle-stroke-color',s.colour);
    for(const id of [HS_NAMES,HS_ENDS]){
      map.setPaintProperty(id,'text-color',text);
      map.setPaintProperty(id,'text-halo-color',halo);
    }
  }

  const APPLY={relief:applyRelief,relief3d:applyRelief3d,greenBelt:applyGreenBelt,aonb:applyAonb,rail:applyRail,highSpeed:applyHighSpeed};

  /* ---------- status: 'off' | 'loading' | 'loaded' | 'error' ---------- */
  function status(group){
    if(!state[group].on)return 'off';
    if(errors[group])return 'error';
    const id=SOURCES[group];
    return map.getSource(id)&&map.isSourceLoaded(id)?'loaded':'loading';
  }
  const groupOfSource=id=>Object.keys(SOURCES).find(group=>SOURCES[group]===id);
  map.on('sourcedata',event=>{const group=groupOfSource(event.sourceId);if(group)onStatus(group,status(group));});
  map.on('error',event=>{
    const group=groupOfSource(event.sourceId);
    if(!group||!state[group].on)return;
    errors[group]=event.error?.message||'Load failed';
    onStatus(group,'error');
  });

  /* ---------- the height under a click, read from the height tile itself (zoom 12, about 30 m) ---------- */
  const heightTiles=new Map();
  async function heightAt(lngLat){
    const z=12,n=2**z,x=(lngLat.lng+180)/360*n,la=lngLat.lat*Math.PI/180;
    const y=(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*n,tx=Math.floor(x),ty=Math.floor(y),key=tx+'/'+ty;
    if(!heightTiles.has(key)){
      const response=await fetch(HEIGHT_TILES.replace('{z}',z).replace('{x}',tx).replace('{y}',ty));
      if(!response.ok)throw new Error('HTTP '+response.status);
      const bitmap=await createImageBitmap(await response.blob(),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
      const ctx=new OffscreenCanvas(256,256).getContext('2d',{willReadFrequently:true});
      ctx.drawImage(bitmap,0,0);
      heightTiles.set(key,ctx);
      if(heightTiles.size>24)heightTiles.delete(heightTiles.keys().next().value);
    }
    const d=heightTiles.get(key).getImageData(Math.min(255,Math.floor((x-tx)*256)),Math.min(255,Math.floor((y-ty)*256)),1,1).data;
    return d[0]*256+d[1]+d[2]/256-32768;
  }
  function insideCircle(lngLat){
    const R=6378137,la1=center.lat*Math.PI/180,la2=lngLat.lat*Math.PI/180;
    const h=Math.sin((la2-la1)/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin((lngLat.lng-center.lng)*Math.PI/360)**2;
    return 2*R*Math.asin(Math.sqrt(Math.min(1,h)))<=radius;
  }

  return {
    state,
    status,
    heightAt,
    insideCircle,
    /* Change one layer: set('rail',{mode:'speed'}) or set('rail',{kinds:{tram:false}}). */
    set(group,patch){
      const s=state[group];
      if(!s)return;
      for(const [key,value] of Object.entries(patch)){
        if(value&&typeof value==='object'&&!Array.isArray(value))Object.assign(s[key],value);
        else s[key]=value;
      }
      if('on' in patch)delete errors[group];
      APPLY[group]();
      onStatus(group,status(group));
    },
    /* The colours that follow the map's colour theme. */
    applyTheme(){applyGreenBelt();applyAonb();applyRail();applyHighSpeedPlaces();},
    /* The page keeps one order for every analysis layer (keepDrainageAboveTerrain): the two faint fills go under the
       flood picture, the edges and lines over the drainage network and under the 3D buildings. */
    moveFills(before){for(const id of [AONB_FILL,GB_FILL])if(has(id))map.moveLayer(id,before);},
    moveLines(before){
      for(const id of [GB_LINE,AONB_LINE,...RAIL_KINDS.map(railLayer),HS1,HS2,HS2_TUNNEL])
        if(has(id))map.moveLayer(id,before);
    },
    layerIds:()=>[RELIEF,AONB_FILL,GB_FILL,GB_LINE,AONB_LINE,...RAIL_KINDS.map(railLayer),HS1,HS2,HS2_TUNNEL,HS_DOTS,HS_NAMES,HS_ENDS]
  };
}
