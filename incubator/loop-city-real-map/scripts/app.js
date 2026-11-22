// Loop City on the real map · v13, the base map: the real city with all its data layers, dark and light.
// (v9 plus the rail colour choice of v12. The mould + growth engine of v10 to v12 is not in this version.): the real OpenStreetMap city, dark, with its own look panel.
// Map library, basemap, building and terrain methods follow Hao Wang's incubator/google-map-live
// (see ../SOURCE.md). Nothing is imported from his folders: the pieces used are copies in this folder.

import {PALETTES,createBasemapThemeController,picksFromPalette,paletteFromPicks,mixHex} from './osm_basemap_themes.js';
import {createTerrainLocalLoader,TERRAIN_MIN_ZOOM,TERRAIN_MAX_ZOOM,TERRAIN_TILE_SIZE} from './terrain_local.js';

const VERSION='v13';
const AONB_COLOUR='#4f6b45';
const SAP_GREEN='#849474';   // the light-mode green the user chose (20 Nov)
const MAPLIBRE_VERSION='6.13.0';                                  // the same as Hao's google-map-live
const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';    // OpenFreeMap Liberty, as Hao's
const TILES_FALLBACK='https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf';
const DEM_TILES='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
// The 70 km frame round Charing Cross that Hao's terrain covers (assets/terrain/metadata.json).
const LOOP_BOUNDS=[[-1.1478,50.8583],[0.9211,52.1484]];
const TERRAIN_3857={left:-127813.8696191665,right:102461.98815442335,bottom:6596204.025752107,top:6827041.923624865};
const LANG_KEY='loopCityMap.uiLanguage';
const MODE_KEY='loopCityMap.mode';
const FIRST_PALETTE={dark:'dark',light:'print'};
let startMode='dark';
try{if(localStorage.getItem(MODE_KEY)==='light')startMode='light';}catch(_){}

// ---------- words ----------
const T={
  en:{title:'Loop City · real map',sub:'The real city and its data',look:'Look',view:'View',plan:'Plan',tilt:'Tilt',fit:'Whole loop',
    labels:'Labels',labelSize:'Label size',buildings:'Buildings',off:'Off',flat:'Flat',b3d:'3D',terrain:'Terrain',
    terrainColour:'EA terrain picture (70 km only)',topo:'Topography (colour by height)',topoMax:'Top of the scale',
    topoShade:'Hill shading',topoRamp:'Colours',rClassic:'Classic',rMuted:'Muted',topoHint:'Click the map to read a height.',opacity:'Opacity',relief:'3D relief',exag:'Exaggeration',layers:'Map layers',
    roads:'Roads',water:'Water',landuse:'Land use',rail:'Rail',places:'Places',colours:'Colours',palette:'Palette',
    pDark:'Dark (Hao’s Dark tech)',pNight:'Night blue',pBlack:'Black',pCustom:'Own colours',
    mode:'Mode',dark:'Dark',light:'Light',weights:'Line weights',
    railNets:'Rail networks (existing)',rNational:'National Rail',rUnderground:'Underground',rOverground:'Overground',
    rElizabeth:'Elizabeth line',rDlr:'DLR',rTram:'Trams',rHs1:'HS1',rHs2:'HS2 (planned route; tunnels dashed)',hsColour:'High speed colour',
    railColours:'Rail colours',rcLines:'Own colours',rcShades:'Three shades',shadeColour:'Shade colour',stations:'Stations',railSpeed:'National Rail by line speed',
    nrColour:'National Rail colour',railFail:'The rail file did not load.',
    railHint:'Covers the site frame (70 km round London). Outside it, the plain Rail switch still draws all railways.',wGb:'Green Belt edge',wAonb:'AONB edge',greenBelt:'Green Belt',gbFill:'Fill',gbColour:'Colour',
    majorOnly:'Zoomed out: main roads only',majorZoom:'More roads from zoom',gbFail:'The Green Belt file did not load.',
    roadHint:'Main = M roads + Primary A roads (as Zoomstack). Then other A roads, B roads (+1.5), streets (+2.5), all (+3.5).',
    aonb:'AONB (National Landscapes)',aonbFail:'The AONB file did not load.',pMono:'Mono (Hao)',pPrint:'Light print',pFaded:'Faded (Hao)',pDefault:'Default (Hao)',
    cLand:'Land',cWater:'Water',cGreen:'Green',cRoads:'Roads',cRail:'Rail',cBuild:'Buildings',cText:'Labels',
    zoom:'zoom',pitch:'tilt',north:'North up',fold:'Fold the panel',
    loading:'Loading the map…',ready:'Ready.',bZoom:'Buildings show from zoom 13: zoom in.',
    styleFail:'The map did not load. Check the internet connection, then reload.',
    terrainFail:'Terrain colour needs the launcher: open with “Open Loop City map.cmd”.',
    demFail:'The height tiles did not load (internet).',
    hint:'Right-drag or Ctrl-drag to tilt and turn.'},
  zh:{title:'Loop City · 真实地图',sub:'真实城市及其数据',look:'外观',view:'视角',plan:'平面',tilt:'倾斜',fit:'整个环线',
    labels:'标注',labelSize:'标注大小',buildings:'建筑',off:'关',flat:'平面',b3d:'3D',terrain:'地形',
    terrainColour:'EA 地形图（仅 70 km 范围）',topo:'地形（按高程着色）',topoMax:'色标上限',
    topoShade:'山体阴影',topoRamp:'色带',rClassic:'经典',rMuted:'柔和',topoHint:'点击地图读取高程。',opacity:'不透明度',relief:'3D 起伏',exag:'夸张倍数',layers:'地图图层',
    roads:'道路',water:'水体',landuse:'土地利用',rail:'铁路',places:'地点',colours:'颜色',palette:'配色',
    pDark:'深色（Hao 的 Dark tech）',pNight:'夜蓝',pBlack:'纯黑',pCustom:'自定颜色',
    mode:'模式',dark:'深色',light:'浅色',weights:'线宽',
    railNets:'铁路网络（现状）',rNational:'国家铁路',rUnderground:'地铁',rOverground:'地上铁',
    rElizabeth:'伊丽莎白线',rDlr:'码头区轻轨 DLR',rTram:'有轨电车',rHs1:'HS1 高铁',rHs2:'HS2（规划线路；隧道为虚线）',hsColour:'高铁颜色',
    railColours:'铁路颜色',rcLines:'各线原色',rcShades:'同色三档',shadeColour:'色调',stations:'车站',railSpeed:'国家铁路按线路速度着色',
    nrColour:'国家铁路颜色',railFail:'铁路文件未能加载。',
    railHint:'覆盖场地范围（伦敦周围 70 km）。范围之外，普通“铁路”开关仍会画出所有铁路。',wGb:'绿带边线',wAonb:'AONB 边线',greenBelt:'绿带',gbFill:'填充',gbColour:'颜色',
    majorOnly:'缩小时只显示主干道',majorZoom:'从此缩放级别起增加道路',gbFail:'绿带文件未能加载。',
    roadHint:'主干道 = M 级 + 主要 A 级道路（与 Zoomstack 相同）。之后依次加入其他 A 级、B 级（+1.5）、街道（+2.5）、全部（+3.5）。',
    aonb:'杰出自然风景区 AONB（国家景观区）',aonbFail:'AONB 文件未能加载。',pMono:'Mono（Hao）',pPrint:'浅色打印',pFaded:'Faded（Hao）',pDefault:'Default（Hao）',
    cLand:'陆地',cWater:'水体',cGreen:'绿地',cRoads:'道路',cRail:'铁路',cBuild:'建筑',cText:'标注',
    zoom:'缩放',pitch:'倾斜',north:'正北朝上',fold:'收起面板',
    loading:'正在加载地图…',ready:'就绪。',bZoom:'建筑从缩放级别 13 起显示：请放大。',
    styleFail:'地图未能加载。请检查网络连接后刷新。',
    terrainFail:'地形色彩需要通过启动器打开：“Open Loop City map.cmd”。',
    demFail:'高程数据未能加载（网络）。',
    hint:'右键拖动或 Ctrl+拖动可倾斜和旋转。'}
};

const $=id=>document.getElementById(id);
const state={
  lang:'en',labels:true,labelScale:1,buildings:'off',
  terrainColour:false,terrainOpacity:0.55,relief:false,exag:3,
  topo:false,topoOpacity:0.75,topoMax:300,topoShade:0.35,topoRamp:'classic',
  roadsW:1,railW:1,gbWidth:1,aonbWidth:1,
  rail:{national:true,overground:true,elizabeth:true,dlr:true,tram:true,underground:true},stations:true,railSpeed:false,nrColour:'#c9c9c9',hs1:true,hs2:true,hsColour:'#ff2d95',railMode:'lines',shade:'#4d8dff',
  groups:{roads:true,water:true,landuse:true,rail:true,places:true},
  majorOnly:true,majorZoom:11,gb:true,gbOpacity:0.25,gbColour:SAP_GREEN,aonb:true,aonbOpacity:0.12,aonbColour:AONB_COLOUR,
  mode:startMode,paletteName:FIRST_PALETTE[startMode],palette:{...PALETTES[FIRST_PALETTE[startMode]]},
  message:'loading'
};
let map=null,styleReady=false,theme=null;
const t=k=>(T[state.lang]&&T[state.lang][k])||T.en[k]||k;

// ---------- language (the same contract as Hao's catalogue "embed" block) ----------
function setLang(lang){
  state.lang=lang==='zh'?'zh':'en';
  document.documentElement.lang=state.lang==='zh'?'zh-CN':'en';
  document.documentElement.dataset.uiLanguage=state.lang;
  try{localStorage.setItem(LANG_KEY,state.lang);}catch(_){/* private mode */}
  document.querySelectorAll('#langbar button').forEach(b=>b.classList.toggle('on',b.dataset.lang===state.lang));
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{el.title=t(el.dataset.i18nTitle);});
  updateStatus();
}
document.querySelectorAll('#langbar button').forEach(b=>b.addEventListener('click',()=>setLang(b.dataset.lang)));
addEventListener('message',e=>{
  if(e.origin!==location.origin)return;
  if(e.data&&e.data.type==='l2100:lang')setLang(e.data.lang);
});
let startLang='en';
try{startLang=localStorage.getItem(LANG_KEY)||'en';}catch(_){}
setLang(startLang);

function setMessage(key){state.message=key;updateStatus();}
function updateStatus(){
  const el=$('status');if(!el)return;
  let view='';
  if(map)view=`${t('zoom')} ${map.getZoom().toFixed(1)} · ${t('pitch')} ${Math.round(map.getPitch())}°`;
  const msg=state.message?t(state.message):'';
  el.textContent=[view,msg].filter(Boolean).join(' · ');
  el.classList.toggle('warn',/Fail$/.test(state.message||''));
}

// ---------- the map library (Hao's loading pattern: unpkg, then jsDelivr) ----------
let maplibregl;
try{
  maplibregl=await import(`https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.mjs`);
}catch(primaryError){
  console.warn('unpkg unavailable; trying jsDelivr.',primaryError);
  try{maplibregl=await import(`https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.mjs`);}
  catch(secondaryError){setMessage('styleFail');throw secondaryError;}
}
if(maplibregl.default&&!maplibregl.Map)maplibregl=maplibregl.default;
// As in Hao's initOSM: the terrain protocol is registered before the map starts; its worker starts on the first tile.
maplibregl.addProtocol('ea-terrain-local',createTerrainLocalLoader({
  imageUrl:new URL('assets/terrain/overview.webp',location.href).href,bounds:TERRAIN_3857,tileSize:TERRAIN_TILE_SIZE}));

const panelPad=()=>({top:40,bottom:60,left:40,right:($('panel')?.offsetWidth||0)+40});

map=new maplibregl.Map({
  container:'map',style:STYLE_URL,bounds:LOOP_BOUNDS,fitBoundsOptions:{padding:panelPad()},
  maxPitch:75,attributionControl:false
});
// OpenStreetMap / OpenFreeMap attribution stays on the map (bottom left, clear of the panel).
map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-left');
map.addControl(new maplibregl.ScaleControl({maxWidth:140,unit:'metric'}),'bottom-left');

const styleWatchdog=setTimeout(()=>{if(!styleReady)setMessage('styleFail');},20000);
const baseLayers=[];   // the original Liberty layers, with their group, first visibility and label size

// ---------- layer groups (by the style's own source-layers) ----------
function groupOf(layer){
  const sl=String(layer['source-layer']||'').toLowerCase(),id=String(layer.id).toLowerCase();
  if(layer.type==='background')return 'base';
  if(sl==='building')return 'building';
  if(sl==='transportation'||sl==='transportation_name')return /rail|transit/.test(id)?'rail':'roads';
  if(/^(water|waterway|water_name)$/.test(sl))return 'water';
  if(/^(landuse|landcover|park|aeroway)$/.test(sl))return 'landuse';
  if(/^(place|poi|boundary|housenumber|mountain_peak|aerodrome_label)$/.test(sl))return 'places';
  return 'other';
}
function captureLayers(){
  for(const l of map.getStyle().layers){
    baseLayers.push({id:l.id,type:l.type,group:groupOf(l),symbol:l.type==='symbol',
      visible:(l.layout&&l.layout.visibility)!=='none',
      size:l.layout?l.layout['text-size']:undefined,hasText:!!(l.layout&&l.layout['text-field']),
      minzoom:l.minzoom??0,maxzoom:l.maxzoom??24,filter:l.filter,
      lw:l.paint?l.paint['line-width']:undefined,lgw:l.paint?l.paint['line-gap-width']:undefined});
  }
}
function setVis(id,on){
  if(!map.getLayer(id))return;
  const v=on?'visible':'none';
  if(map.getLayoutProperty(id,'visibility')!==v)map.setLayoutProperty(id,'visibility',v);
}
function applyVisibility(){
  if(!styleReady)return;
  for(const l of baseLayers){
    let on=l.visible;
    if(l.group==='building')on=false;            // replaced by this app's own building layers
    else if(l.group in state.groups)on=on&&state.groups[l.group];
    if(l.symbol)on=on&&state.labels;
    setVis(l.id,on);
  }
}

// Road detail grows with zoom. Zoomed out: the main roads only, as OS Open Zoomstack draws them:
// M roads (OSM motorway) + Primary A roads (OSM trunk = the Primary Route Network). From zoom Z the
// other A roads (primary); Z+1.5 B roads (secondary, tertiary); Z+2.5 streets; Z+3.5 everything.
// Each road layer (lines and their labels alike) gets a class filter, changed only when a step is crossed.
const ROAD_CLASSES=['motorway','trunk','primary','secondary','tertiary','minor','service','track','path','busway',
  'bus_guideway','raceway','ferry','motorway_construction','trunk_construction','primary_construction',
  'secondary_construction','tertiary_construction','minor_construction','service_construction','track_construction','path_construction'];
const ROAD_STEPS=[['motorway','trunk'],['primary'],['secondary','tertiary'],['minor','busway','raceway']];
function roadStage(){
  if(!state.majorOnly)return 4;
  const z=map.getZoom(),Z=state.majorZoom;
  return z<Z?0:z<Z+1.5?1:z<Z+2.5?2:z<Z+3.5?3:4;
}
const isExprFilter=f=>/\["(get|geometry-type|match|case|coalesce|to-string)"/.test(JSON.stringify(f||''));
let roadStageNow=-1;
function applyRoadZoom(force){
  if(!styleReady)return;
  const stage=roadStage();
  if(stage===roadStageNow&&force!==true)return;
  roadStageNow=stage;
  const allowed=new Set(ROAD_STEPS.slice(0,stage+1).flat());
  const hidden=stage>=4?[]:ROAD_CLASSES.filter(c=>!allowed.has(c));
  for(const l of baseLayers){
    if(l.group!=='roads'||!map.getLayer(l.id))continue;
    let f=l.filter;
    if(hidden.length){
      const cut=isExprFilter(l.filter)?['!',['in',['get','class'],['literal',hidden]]]:['!in','class',...hidden];
      f=l.filter?['all',l.filter,cut]:cut;
    }
    try{map.setFilter(l.id,f??null);}catch(e){console.warn('Road filter not applied:',l.id,e);}
  }
}

// Label size: multiply the style's own sizes. Zoom curves must stay at the top of an expression,
// so their stops are scaled one by one rather than wrapped.
function scaleSize(v,k){
  if(v==null)return 16*k;
  if(typeof v==='number')return Math.round(v*k*10)/10;
  if(Array.isArray(v)){
    if(v[0]==='interpolate'||v[0]==='interpolate-hcl'||v[0]==='interpolate-lab')
      return v.map((x,i)=>i>=4&&i%2===0?scaleSize(x,k):x);
    if(v[0]==='step')return v.map((x,i)=>i>=2&&i%2===0?scaleSize(x,k):x);
    return ['*',v,k];
  }
  if(typeof v==='object'&&Array.isArray(v.stops))
    return {...v,stops:v.stops.map(([z,s])=>[z,typeof s==='number'?Math.round(s*k*10)/10:s])};
  return v;
}
function applyLabelSize(){
  if(!styleReady)return;
  for(const l of baseLayers){
    if(!l.hasText||!map.getLayer(l.id))continue;
    try{map.setLayoutProperty(l.id,'text-size',scaleSize(l.size,state.labelScale));}
    catch(e){console.warn('Label size not applied:',l.id,e);}
  }
}

// ---------- line weights: multiply the style's own road and rail widths (their zoom curves are kept) ----------
function scaleWidth(v,k){
  if(v==null)return k;                                   // the style default is 1
  if(typeof v==='number')return Math.round(v*k*100)/100;
  if(Array.isArray(v)){
    if(v[0]==='interpolate'||v[0]==='interpolate-hcl'||v[0]==='interpolate-lab')
      return v.map((x,i)=>i>=4&&i%2===0?scaleWidth(x,k):x);
    if(v[0]==='step')return v.map((x,i)=>i>=2&&i%2===0?scaleWidth(x,k):x);
    return ['*',v,k];
  }
  if(typeof v==='object'&&Array.isArray(v.stops))
    return {...v,stops:v.stops.map(([z,s])=>[z,typeof s==='number'?Math.round(s*k*100)/100:s])};
  return v;
}
function applyLineWeights(){
  if(!styleReady)return;
  for(const l of baseLayers){
    if(l.type!=='line'||(l.group!=='roads'&&l.group!=='rail')||!map.getLayer(l.id))continue;
    const k=l.group==='roads'?state.roadsW:state.railW;
    try{
      map.setPaintProperty(l.id,'line-width',scaleWidth(l.lw,k));
      if(l.lgw!=null)map.setPaintProperty(l.id,'line-gap-width',scaleWidth(l.lgw,k));
    }catch(e){console.warn('Line weight not applied:',l.id,e);}
  }
}
// The Green Belt and AONB edges: three widths (zoom 8, 12, 15) times their own slider.
const edgeWidth=(w,k)=>['interpolate',['linear'],['zoom'],8,w[0]*k,12,w[1]*k,15,w[2]*k];
const GB_EDGE=[1.3,2.2,3],AONB_EDGE=[1.2,1.8,2.4];

// ---------- buildings: off, flat or 3D (Hao's dedicated z13–z14 source, so a tilted far field is never blank) ----------
const B_SRC='lc-buildings',B_FLAT='lc-buildings-flat',B_3D='lc-buildings-3d';
const firstSymbolId=()=>map.getStyle().layers.find(l=>l.type==='symbol')?.id;
function buildingTilesUrl(){
  try{
    for(const id of Object.keys(map.getStyle()?.sources||{})){
      if(id===B_SRC)continue;
      const s=map.getSource(id);
      if(s&&s.type==='vector'&&/tiles\.openfreemap\.org\/planet/.test(String(s.url||''))&&Array.isArray(s.tiles)&&s.tiles[0])return s.tiles[0];
    }
  }catch(_){}
  return TILES_FALLBACK;
}
// Taller buildings are lighter; all are lifted off the near-black palette so walls and roofs read apart.
// On a light map the white buildings get slightly greyer with height instead.
const buildingRamp=p=>{
  const light=state.mode==='light',to=light?'#000000':'#ffffff',k=light?[0,0.04,0.08,0.14]:[0.12,0.2,0.32,0.48];
  return ['interpolate',['linear'],['max',0,['to-number',['get','render_height'],5]],
    0,mixHex(p.extrusion,to,k[0]),20,mixHex(p.extrusion,to,k[1]),60,mixHex(p.extrusion,to,k[2]),150,mixHex(p.extrusion,to,k[3])];
};
function ensureBuildings(){
  if(map.getSource(B_SRC))return;
  map.addSource(B_SRC,{type:'vector',tiles:[buildingTilesUrl()],minzoom:13,maxzoom:14,
    attribution:'OpenFreeMap © OpenMapTiles © OpenStreetMap contributors'});
  const filter=['!',['boolean',['get','hide_3d'],false]];
  const before=firstSymbolId();
  map.addLayer({id:B_FLAT,type:'fill',source:B_SRC,'source-layer':'building',minzoom:13,filter,
    layout:{visibility:'none'},
    paint:{'fill-color':state.palette.building,'fill-outline-color':state.palette.buildingEdge,'fill-opacity':0.96}},before);
  map.addLayer({id:B_3D,type:'fill-extrusion',source:B_SRC,'source-layer':'building',minzoom:13,filter,
    layout:{visibility:'none'},
    paint:{'fill-extrusion-color':buildingRamp(state.palette),
      'fill-extrusion-height':['max',0,['to-number',['get','render_height'],5]],
      'fill-extrusion-base':['max',0,['to-number',['get','render_min_height'],0]],
      'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}},before);
}
function applyBuildings(){
  if(!styleReady)return;
  if(state.buildings!=='off')ensureBuildings();
  setVis(B_FLAT,state.buildings==='flat');
  setVis(B_3D,state.buildings==='3d');
  const tiltTo=state.buildings==='3d'&&map.getPitch()<45?60:map.getPitch();
  if(state.buildings!=='off'&&map.getZoom()<13)map.easeTo({zoom:14.5,pitch:tiltTo,duration:1400});
  else if(tiltTo!==map.getPitch())map.easeTo({pitch:tiltTo,duration:800});
  zoomHint();
}
function zoomHint(){
  const need=state.buildings!=='off'&&map.getZoom()<13;
  if(need&&state.message!=='bZoom')setMessage('bZoom');
  else if(!need&&state.message==='bZoom')setMessage('ready');
  else updateStatus();
}

// ---------- terrain: Hao's EA LiDAR colour terrain (local tiles, needs the launcher) + optional 3D relief ----------
const T_SRC='lc-terrain-colour',T_LAYER='lc-terrain-colour',DEM_SRC='lc-dem';
const mercToLngLat=(x,y)=>[x/6378137*180/Math.PI,(2*Math.atan(Math.exp(y/6378137))-Math.PI/2)*180/Math.PI];
function ensureTerrainColour(){
  if(map.getSource(T_SRC))return;
  const [w,s]=mercToLngLat(TERRAIN_3857.left,TERRAIN_3857.bottom),[e,n]=mercToLngLat(TERRAIN_3857.right,TERRAIN_3857.top);
  map.addSource(T_SRC,{type:'raster',tiles:['ea-terrain-local://tiles/{z}/{x}/{y}'],tileSize:TERRAIN_TILE_SIZE,
    minzoom:TERRAIN_MIN_ZOOM,maxzoom:TERRAIN_MAX_ZOOM,bounds:[w,s,e,n],
    attribution:'© Environment Agency 2022 · Open Government Licence'});
  // Under water, roads and labels: above the land-use fills only.
  const before=[AONB_FILL,GB_FILL].find(id=>map.getLayer(id))||baseLayers.find(l=>l.group==='water')?.id||firstSymbolId();
  map.addLayer({id:T_LAYER,type:'raster',source:T_SRC,
    paint:{'raster-opacity':state.terrainOpacity,'raster-fade-duration':0,'raster-resampling':'linear'}},before);
}
function applyTerrain(){
  if(!styleReady)return;
  if(state.terrainColour)ensureTerrainColour();
  setVis(T_LAYER,state.terrainColour);
  if(map.getLayer(T_LAYER))map.setPaintProperty(T_LAYER,'raster-opacity',state.terrainOpacity);
  if(state.relief){
    if(!map.getSource(DEM_SRC))map.addSource(DEM_SRC,{type:'raster-dem',tiles:[DEM_TILES],tileSize:256,
      encoding:'terrarium',maxzoom:15,attribution:'Terrain Tiles: Mapzen, AWS Open Data'});
    map.setTerrain({source:DEM_SRC,exaggeration:state.exag});
  }else if(map.getTerrain&&map.getTerrain()){
    map.setTerrain(null);
  }
}

// ---------- Green Belt (England Green Belt 2024/25, the London belt merged; assets/green_belt.geojson) ----------
const GB_SRC='lc-green-belt',GB_FILL='lc-green-belt-fill',GB_LINE='lc-green-belt-line';
const gbLineColour=()=>mixHex(state.gbColour,'#000000',0.15);
function ensureGreenBelt(){
  if(map.getSource(GB_SRC))return;
  map.addSource(GB_SRC,{type:'geojson',data:new URL('assets/green_belt.geojson',location.href).href,
    attribution:'Green Belt: MHCLG 2024/25 · Open Government Licence'});
  // The faint fill sits over land use and the terrain colour, under water and roads; the edge sits under the labels only.
  map.addLayer({id:GB_FILL,type:'fill',source:GB_SRC,
    paint:{'fill-color':state.gbColour,'fill-opacity':state.gbOpacity}},baseLayers.find(l=>l.group==='water')?.id||firstSymbolId());
  map.addLayer({id:GB_LINE,type:'line',source:GB_SRC,layout:{'line-join':'round'},
    paint:{'line-color':gbLineColour(),'line-width':edgeWidth(GB_EDGE,state.gbWidth)}},firstSymbolId());
}
function applyGreenBelt(){
  if(!styleReady)return;
  if(state.gb)ensureGreenBelt();
  setVis(GB_FILL,state.gb);setVis(GB_LINE,state.gb);
  if(map.getLayer(GB_FILL)){
    map.setPaintProperty(GB_FILL,'fill-color',state.gbColour);
    map.setPaintProperty(GB_FILL,'fill-opacity',state.gbOpacity);
    map.setPaintProperty(GB_LINE,'line-color',gbLineColour());
    map.setPaintProperty(GB_LINE,'line-width',edgeWidth(GB_EDGE,state.gbWidth));
  }
}

// ---------- AONB / National Landscapes (Natural England; assets/aonb.geojson) ----------
const AONB_SRC='lc-aonb',AONB_FILL='lc-aonb-fill',AONB_LINE='lc-aonb-line';
function ensureAonb(){
  if(map.getSource(AONB_SRC))return;
  map.addSource(AONB_SRC,{type:'geojson',data:new URL('assets/aonb.geojson',location.href).href,
    attribution:'AONB: Natural England · Open Government Licence'});
  // Under the Green Belt fill; the dashed edge under the labels only.
  const before=map.getLayer(GB_FILL)?GB_FILL:(baseLayers.find(l=>l.group==='water')?.id||firstSymbolId());
  map.addLayer({id:AONB_FILL,type:'fill',source:AONB_SRC,
    paint:{'fill-color':state.aonbColour,'fill-opacity':state.aonbOpacity}},before);
  map.addLayer({id:AONB_LINE,type:'line',source:AONB_SRC,layout:{'line-join':'round'},
    paint:{'line-color':state.aonbColour,'line-dasharray':[3,2],
      'line-width':edgeWidth(AONB_EDGE,state.aonbWidth)}},firstSymbolId());
}
function applyAonb(){
  if(!styleReady)return;
  if(state.aonb)ensureAonb();
  setVis(AONB_FILL,state.aonb);setVis(AONB_LINE,state.aonb);
  if(map.getLayer(AONB_FILL)){
    map.setPaintProperty(AONB_FILL,'fill-color',state.aonbColour);
    map.setPaintProperty(AONB_FILL,'fill-opacity',state.aonbOpacity);
    map.setPaintProperty(AONB_LINE,'line-color',state.aonbColour);
    map.setPaintProperty(AONB_LINE,'line-width',edgeWidth(AONB_EDGE,state.aonbWidth));
  }
}

// ---------- rail networks: the existing lines by service (OpenStreetMap, fetched once for the frame) ----------
// assets/rail.geojson: k = national | overground | elizabeth | underground | dlr | tram; c = the line's own colour;
// mph = line speed (National Rail); u = usage. assets/stations.geojson: n = name, k = network.
const RAIL_SRC='lc-rail',ST_SRC='lc-stations',ST_DOTS='lc-station-dots',ST_NAMES='lc-station-names';
const RAIL_KINDS=['national','overground','elizabeth','dlr','tram','underground'];   // drawn in this order, the tube on top
const RAIL_COLOUR={overground:'#EE7C0E',elizabeth:'#6950A1',dlr:'#00AFAD',tram:'#5FB526',underground:'#8a8a8a'};
const NR_DEFAULT={dark:'#c9c9c9',light:'#000000'};
const SPEED_STOPS=[[20,'#3b6fd4'],[60,'#35c26b'],[90,'#f2d53c'],[110,'#f08a2c'],[125,'#e0362c'],[186,'#c04be0']];
const railLayer=k=>'lc-rail-'+k;
function railColour(k){
  if(state.railMode==='shades'&&!(k==='national'&&state.railSpeed)){
    // One colour, three shades: National Rail dark, Underground (+ DLR) as picked, Overground (+ Elizabeth line, trams) light.
    const dark=state.mode==='dark';
    if(k==='national')return mixHex(state.shade,'#000000',dark?0.38:0.55);
    if(k==='underground'||k==='dlr')return state.shade;
    return mixHex(state.shade,'#ffffff',dark?0.55:0.45);
  }
  if(k==='national'){
    if(!state.railSpeed)return state.nrColour;
    return ['case',['has','mph'],['interpolate',['linear'],['get','mph'],...SPEED_STOPS.flat()],'#8a8a8a'];
  }
  // Each line's own colour; black (the Northern line) turns light on the dark map.
  return ['case',['==',['get','c'],'#000000'],state.mode==='dark'?'#e8e8e8':'#000000',['has','c'],['to-color',['get','c']],RAIL_COLOUR[k]];
}
function railWidth(k){
  const m=k==='national'?['case',['==',['get','u'],'main'],1.35,1]:1.2,w=state.railW;
  return ['interpolate',['linear'],['zoom'],8,['*',0.8*w,m],12,['*',1.7*w,m],16,['*',4*w,m]];
}
function ensureRail(){
  if(map.getSource(RAIL_SRC))return;
  map.addSource(RAIL_SRC,{type:'geojson',data:new URL('assets/rail.geojson',location.href).href,
    attribution:'Rail lines and stations © OpenStreetMap contributors'});
  map.addSource(ST_SRC,{type:'geojson',data:new URL('assets/stations.geojson',location.href).href});
  const before=firstSymbolId();
  for(const k of RAIL_KINDS){
    map.addLayer({id:railLayer(k),type:'line',source:RAIL_SRC,filter:['==',['get','k'],k],
      layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':railColour(k),'line-width':railWidth(k)}},before);
  }
  map.addLayer({id:ST_DOTS,type:'circle',source:ST_SRC,minzoom:9.5,
    paint:{'circle-radius':['interpolate',['linear'],['zoom'],9.5,1.4,13,3.2,16,6],'circle-color':state.palette.background,
      'circle-stroke-color':state.palette.text,'circle-stroke-width':['interpolate',['linear'],['zoom'],9.5,0.8,14,1.6]}},before);
  map.addLayer({id:ST_NAMES,type:'symbol',source:ST_SRC,minzoom:11.5,
    layout:{'text-field':['get','n'],'text-font':['Noto Sans Regular'],'text-size':11*state.labelScale,
      'text-anchor':'top','text-offset':[0,0.7],'text-optional':true},
    paint:{'text-color':state.palette.text,'text-halo-color':state.palette.textHalo,'text-halo-width':1.3}});
}
function applyRail(){
  if(!styleReady)return;
  if(RAIL_KINDS.some(k=>state.rail[k])||state.stations)ensureRail();
  if(!map.getSource(RAIL_SRC))return;
  for(const k of RAIL_KINDS){
    setVis(railLayer(k),state.rail[k]);
    map.setPaintProperty(railLayer(k),'line-color',railColour(k));
    map.setPaintProperty(railLayer(k),'line-width',railWidth(k));
  }
  setVis(ST_DOTS,state.stations);setVis(ST_NAMES,state.stations&&state.labels);
  map.setPaintProperty(ST_DOTS,'circle-color',state.palette.background);
  map.setPaintProperty(ST_DOTS,'circle-stroke-color',state.palette.text);
  map.setPaintProperty(ST_NAMES,'text-color',state.palette.text);
  map.setPaintProperty(ST_NAMES,'text-halo-color',state.palette.textHalo);
  map.setLayoutProperty(ST_NAMES,'text-size',11*state.labelScale);
}
function drawSpeedLegend(){
  $('speedBar').style.background='linear-gradient(to right,'+SPEED_STOPS.map(([v,c],i)=>`${c} ${i*20}%`).join(',')+')';
  $('speedTicks').textContent='';
  for(const [v] of SPEED_STOPS){const s=document.createElement('span');s.textContent=v;$('speedTicks').append(s);}
}

// ---------- high-speed lines over their whole length: HS1 (OpenStreetMap, by name) and HS2 (the official
// HS2_Route_Detailed dataset, Phase One London to the West Midlands; tunnels dashed). assets/highspeed.geojson ----------
const HS_SRC='lc-highspeed',HS1_LAYER='lc-hs1',HS2_LAYER='lc-hs2',HS2_TUNNEL='lc-hs2-tunnel';
const hsWidth=()=>['interpolate',['linear'],['zoom'],5,1.2*state.railW,8,1.9*state.railW,12,3*state.railW,16,6*state.railW];
function ensureHs(){
  if(map.getSource(HS_SRC))return;
  map.addSource(HS_SRC,{type:'geojson',data:new URL('assets/highspeed.geojson',location.href).href,
    attribution:'HS2 route: HS2 Ltd · Open Government Licence'});
  const before=firstSymbolId(),round={'line-join':'round','line-cap':'round'};
  map.addLayer({id:HS1_LAYER,type:'line',source:HS_SRC,filter:['==',['get','k'],'hs1'],layout:round,
    paint:{'line-color':state.hsColour,'line-width':hsWidth()}},before);
  map.addLayer({id:HS2_LAYER,type:'line',source:HS_SRC,filter:['all',['==',['get','k'],'hs2'],['!=',['get','t'],'tunnel']],layout:round,
    paint:{'line-color':state.hsColour,'line-width':hsWidth()}},before);
  map.addLayer({id:HS2_TUNNEL,type:'line',source:HS_SRC,filter:['all',['==',['get','k'],'hs2'],['==',['get','t'],'tunnel']],
    layout:{'line-join':'round'},paint:{'line-color':state.hsColour,'line-width':hsWidth(),'line-dasharray':[2,1.4]}},before);
}
function applyHs(){
  if(!styleReady)return;
  if(state.hs1||state.hs2)ensureHs();
  if(!map.getSource(HS_SRC))return;
  setVis(HS1_LAYER,state.hs1);setVis(HS2_LAYER,state.hs2);setVis(HS2_TUNNEL,state.hs2);
  for(const id of [HS1_LAYER,HS2_LAYER,HS2_TUNNEL]){
    map.setPaintProperty(id,'line-color',state.hsColour);
    map.setPaintProperty(id,'line-width',hsWidth());
  }
}

// ---------- topography: colour by height, anywhere (the same open heights as the 3D relief) ----------
// MapLibre's own colour-relief and hillshade layers on the AWS Terrain Tiles: streamed like the map
// itself, so there is no patch edge and nothing is stored in the app folder.
const TOPO_SRC='lc-dem-draw',TOPO_LAYER='lc-topo',SHADE_LAYER='lc-hillshade';
const RAMPS={
  classic:['#3d9be9','#35c3f0','#30e0e0','#2fe6a8','#2fe66f','#4be64a','#7bea3f','#a6ee3c','#cdf23a','#f0f53a',
    '#ffe838','#ffcf36','#ffb234','#ff9432','#ff7030','#ff4a30','#ff5f5f','#ff8f8f','#ffc0c0','#fff0f0'],
  muted:['#16323a','#1b4042','#235048','#30614b','#44724d','#5d8150','#788c54','#929458','#a8985b','#b6935a',
    '#ba8758','#b77a56','#b16e56','#b06a5c','#b87a6e','#c28e84','#cda59c','#d9bdb6','#e5d4cf','#efe6e2']
};
// Twenty steps from -3 m to the chosen top, closer together near sea level (as on topographic-map.com).
const topoHeights=()=>RAMPS.classic.map((_,i)=>Math.round((-3+(state.topoMax+3)*Math.pow(i/19,1.5))*10)/10);
function topoColour(){
  const h=topoHeights(),c=RAMPS[state.topoRamp]||RAMPS.classic,e=['interpolate',['linear'],['elevation']];
  h.forEach((v,i)=>e.push(v,c[i]));
  return e;
}
function drawLegend(){
  const c=RAMPS[state.topoRamp]||RAMPS.classic,h=topoHeights();
  $('topoBar').style.background='linear-gradient(to right,'+c.map((x,i)=>`${x} ${i*5}% ${(i+1)*5}%`).join(',')+')';
  $('topoTicks').textContent='';
  for(const i of [0,5,10,15,19]){const s=document.createElement('span');s.textContent=Math.round(h[i])+' m';$('topoTicks').append(s);}
}
function ensureTopo(){
  if(map.getSource(TOPO_SRC))return;
  map.addSource(TOPO_SRC,{type:'raster-dem',tiles:[DEM_TILES],tileSize:256,encoding:'terrarium',maxzoom:12,
    attribution:'Heights: Terrain Tiles (Mapzen, AWS Open Data)'});
  // Over land use; under the EA picture, AONB, Green Belt, water, roads and labels.
  const before=[T_LAYER,AONB_FILL,GB_FILL].find(id=>map.getLayer(id))||baseLayers.find(l=>l.group==='water')?.id||firstSymbolId();
  map.addLayer({id:TOPO_LAYER,type:'color-relief',source:TOPO_SRC,
    paint:{'color-relief-color':topoColour(),'color-relief-opacity':state.topoOpacity}},before);
  map.addLayer({id:SHADE_LAYER,type:'hillshade',source:TOPO_SRC,
    paint:{'hillshade-exaggeration':state.topoShade,'hillshade-shadow-color':'#000000',
      'hillshade-highlight-color':'#ffffff','hillshade-accent-color':'#000000'}},before);
}
function applyTopo(){
  drawLegend();
  if(!styleReady)return;
  if(state.topo)ensureTopo();
  setVis(TOPO_LAYER,state.topo);setVis(SHADE_LAYER,state.topo&&state.topoShade>0);
  if(map.getLayer(TOPO_LAYER)){
    map.setPaintProperty(TOPO_LAYER,'color-relief-color',topoColour());
    map.setPaintProperty(TOPO_LAYER,'color-relief-opacity',state.topoOpacity);
    map.setPaintProperty(SHADE_LAYER,'hillshade-exaggeration',state.topoShade);
  }
  if(!state.topo&&heightPopup){heightPopup.remove();heightPopup=null;}
}
// The height under a click, read from the height tile itself (zoom 12, about 30 m).
let heightPopup=null;
const demCache=new Map();
async function heightAt(lngLat){
  const z=12,n=2**z,x=(lngLat.lng+180)/360*n,la=lngLat.lat*Math.PI/180;
  const y=(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*n,tx=Math.floor(x),ty=Math.floor(y),key=tx+'/'+ty;
  if(!demCache.has(key)){
    const r=await fetch(DEM_TILES.replace('{z}',z).replace('{x}',tx).replace('{y}',ty));
    if(!r.ok)throw new Error('HTTP '+r.status);
    const bmp=await createImageBitmap(await r.blob());
    const g=new OffscreenCanvas(256,256).getContext('2d',{willReadFrequently:true});
    g.drawImage(bmp,0,0);
    demCache.set(key,g);
    if(demCache.size>24)demCache.delete(demCache.keys().next().value);
  }
  const d=demCache.get(key).getImageData(Math.min(255,Math.floor((x-tx)*256)),Math.min(255,Math.floor((y-ty)*256)),1,1).data;
  return d[0]*256+d[1]+d[2]/256-32768;
}

// ---------- colours ----------
const PICKS=['land','water','green','roads','rail','buildings','labels'];
function showPicks(){const k=picksFromPalette(state.palette);for(const n of PICKS)$('c_'+n).value=k[n];}
function applyPalette(){
  if(!styleReady)return;
  theme.apply(state.palette);
  if(map.getLayer(B_FLAT)){
    map.setPaintProperty(B_FLAT,'fill-color',state.palette.building);
    map.setPaintProperty(B_FLAT,'fill-outline-color',state.palette.buildingEdge);
  }
  if(map.getLayer(B_3D))map.setPaintProperty(B_3D,'fill-extrusion-color',buildingRamp(state.palette));
  document.documentElement.style.setProperty('--map-bg',state.palette.background);
  applyRail();
}

// ---------- start ----------
map.on('style.load',()=>{
  if(styleReady)return;
  styleReady=true;clearTimeout(styleWatchdog);
  captureLayers();
  theme=createBasemapThemeController(map);theme.capture();
  try{map.setLight({anchor:'map',color:'#ffffff',intensity:0.55,position:[1.2,210,35]});}catch(e){console.warn('Light not set',e);}
  applyPalette();applyVisibility();applyLabelSize();applyLineWeights();applyRoadZoom(true);applyGreenBelt();applyAonb();applyBuildings();applyTerrain();applyTopo();applyHs();
  $('map').classList.add('ready');
  setMessage('ready');
});
map.on('error',e=>{
  console.warn('Map error:',e&&(e.error||e));
  const id=e&&e.sourceId;
  if(id===T_SRC&&state.message!=='terrainFail')setMessage('terrainFail');
  else if((id===DEM_SRC||id===TOPO_SRC)&&state.message!=='demFail')setMessage('demFail');
  else if(id===GB_SRC&&state.message!=='gbFail')setMessage('gbFail');
  else if(id===AONB_SRC&&state.message!=='aonbFail')setMessage('aonbFail');
  else if((id===RAIL_SRC||id===ST_SRC||id===HS_SRC)&&state.message!=='railFail')setMessage('railFail');
});
map.on('move',updateStatus);
map.on('zoomend',zoomHint);
map.on('zoom',()=>applyRoadZoom());
map.on('click',async e=>{
  if(!state.topo)return;
  try{
    const h=await heightAt(e.lngLat);
    if(heightPopup)heightPopup.remove();
    heightPopup=new maplibregl.Popup({className:'lc-height',offset:6}).setLngLat(e.lngLat).setText(Math.round(h)+' m').addTo(map);
  }catch(err){console.warn('Height not read:',err);}
});
map.on('rotate',()=>{$('northRose').style.transform=`rotate(${-map.getBearing()}deg)`;});

// ---------- panel wiring ----------
const whenReady=fn=>fn;   // state always follows the panel; the apply functions wait for the style
$('btnPlan').onclick=()=>map.easeTo({pitch:0,bearing:0,duration:700});
$('btnTilt').onclick=()=>map.easeTo({pitch:60,duration:700});
$('btnFit').onclick=()=>map.fitBounds(LOOP_BOUNDS,{padding:panelPad(),bearing:0,pitch:0,duration:900});
$('north').onclick=()=>map.easeTo({bearing:0,duration:500});
$('fold').onclick=()=>$('panel').classList.toggle('folded');

$('labels').onchange=whenReady(e=>{state.labels=e.target.checked;applyVisibility();applyRail();});
$('labelSize').oninput=whenReady(e=>{state.labelScale=+e.target.value/100;$('labelSizeOut').textContent=e.target.value+'%';applyLabelSize();applyRail();});
document.querySelectorAll('#bmode button').forEach(b=>b.onclick=whenReady(()=>{
  state.buildings=b.dataset.mode;
  document.querySelectorAll('#bmode button').forEach(x=>x.classList.toggle('on',x===b));
  applyBuildings();
}));
$('terrainColour').onchange=whenReady(e=>{state.terrainColour=e.target.checked;if(state.message==='terrainFail')setMessage('ready');applyTerrain();});
$('terrainOpacity').oninput=whenReady(e=>{state.terrainOpacity=+e.target.value/100;$('opOut').textContent=e.target.value+'%';applyTerrain();});
$('relief').onchange=whenReady(e=>{
  state.relief=e.target.checked;if(state.message==='demFail')setMessage('ready');applyTerrain();
  if(state.relief&&map.getPitch()<15)map.easeTo({pitch:55,duration:800});
});
$('exag').oninput=whenReady(e=>{state.exag=+e.target.value;$('exagOut').textContent='×'+state.exag;applyTerrain();});
for(const g of Object.keys(state.groups)){
  $('g_'+g).onchange=whenReady(e=>{state.groups[g]=e.target.checked;applyVisibility();});
}
for(const k of RAIL_KINDS){$('r_'+k).onchange=e=>{state.rail[k]=e.target.checked;applyRail();};}
$('stationsOn').onchange=e=>{state.stations=e.target.checked;applyRail();};
$('railSpeed').onchange=e=>{state.railSpeed=e.target.checked;$('speedLegend').style.display=state.railSpeed?'':'none';applyRail();};
$('c_nr').oninput=e=>{state.nrColour=e.target.value;applyRail();};
document.querySelectorAll('#railMode button').forEach(b=>b.onclick=()=>{
  state.railMode=b.dataset.mode;
  document.querySelectorAll('#railMode button').forEach(x=>x.classList.toggle('on',x===b));
  applyRail();
});
$('c_shade').oninput=e=>{state.shade=e.target.value;applyRail();};
$('r_hs1').onchange=e=>{state.hs1=e.target.checked;applyHs();};
$('r_hs2').onchange=e=>{state.hs2=e.target.checked;applyHs();};
$('c_hs').oninput=e=>{state.hsColour=e.target.value;applyHs();};
drawSpeedLegend();
const weight=(id,set,apply)=>{$(id).oninput=e=>{set(+e.target.value/100);$(id+'Out').textContent=e.target.value+'%';apply();};};
weight('wRoads',v=>{state.roadsW=v;},applyLineWeights);
weight('wRail',v=>{state.railW=v;},()=>{applyLineWeights();applyRail();applyHs();});
weight('wGb',v=>{state.gbWidth=v;},applyGreenBelt);
weight('wAonb',v=>{state.aonbWidth=v;},applyAonb);
$('topoOn').onchange=e=>{state.topo=e.target.checked;if(state.message==='demFail')setMessage('ready');applyTopo();};
$('topoOpacity').oninput=e=>{state.topoOpacity=+e.target.value/100;$('topoOpacityOut').textContent=e.target.value+'%';applyTopo();};
$('topoMax').oninput=e=>{state.topoMax=+e.target.value;$('topoMaxOut').textContent=e.target.value+' m';applyTopo();};
$('topoShade').oninput=e=>{state.topoShade=+e.target.value/100;$('topoShadeOut').textContent=e.target.value+'%';applyTopo();};
$('topoRamp').onchange=e=>{state.topoRamp=e.target.value;applyTopo();};
drawLegend();
$('majorOnly').onchange=e=>{state.majorOnly=e.target.checked;applyRoadZoom();};
$('majorZoom').oninput=e=>{state.majorZoom=+e.target.value;$('majorZoomOut').textContent=e.target.value;applyRoadZoom();};
$('gbOn').onchange=e=>{state.gb=e.target.checked;applyGreenBelt();};
$('gbFill').oninput=e=>{state.gbOpacity=+e.target.value/100;$('gbFillOut').textContent=e.target.value+'%';applyGreenBelt();};
$('c_greenbelt').oninput=e=>{state.gbColour=e.target.value;applyGreenBelt();};
$('aonbOn').onchange=e=>{state.aonb=e.target.checked;applyAonb();};
$('aonbFill').oninput=e=>{state.aonbOpacity=+e.target.value/100;$('aonbFillOut').textContent=e.target.value+'%';applyAonb();};
$('c_aonb').oninput=e=>{state.aonbColour=e.target.value;applyAonb();};
$('palette').onchange=whenReady(e=>{
  state.paletteName=e.target.value;
  if(PALETTES[state.paletteName]){state.palette={...PALETTES[state.paletteName]};showPicks();applyPalette();}
});
for(const n of PICKS){
  $('c_'+n).oninput=whenReady(()=>{
    const k={};for(const m of PICKS)k[m]=$('c_'+m).value;
    state.palette=paletteFromPicks(k,state.mode==='light');state.paletteName='custom';$('palette').value='custom';
    applyPalette();
  });
}
// ---------- Dark | Light ----------
function setMode(mode){
  state.mode=mode==='light'?'light':'dark';
  document.documentElement.dataset.theme=state.mode;
  try{localStorage.setItem(MODE_KEY,state.mode);}catch(_){}
  document.querySelectorAll('#mode button').forEach(b=>b.classList.toggle('on',b.dataset.mode===state.mode));
  document.querySelectorAll('#palette option[data-for]').forEach(o=>{o.hidden=o.dataset.for!==state.mode;});
  const opt=document.querySelector(`#palette option[value="${state.paletteName}"]`);
  if(!opt||opt.dataset.for!==state.mode){state.paletteName=FIRST_PALETTE[state.mode];state.palette={...PALETTES[state.paletteName]};}
  $('palette').value=state.paletteName;
  state.nrColour=NR_DEFAULT[state.mode];$('c_nr').value=state.nrColour;
  showPicks();applyPalette();
}
document.querySelectorAll('#mode button').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
setMode(state.mode);
$('version').textContent=`${VERSION} · MapLibre ${MAPLIBRE_VERSION} · OpenFreeMap Liberty`;
updateStatus();
// For checks from the console only.
window.__loopCityMap={map,state};
