// London map · the page's own code: the map, its layers, the panel and the Google / OSM switch.
// Was the inline <script type="module"> of index.html until v3.39.0; computation without the page lives in map_core.js.
import {createFloodDetailLoader,DETAIL_MIN_ZOOM,DETAIL_MAX_ZOOM,DETAIL_TILE_SIZE} from './flood_detail.js?v=3.46.3';
import {createPlaceSearch} from './place_search.js?v=3.46.3';
import {createDrainageDisplayLoader,AREA_MIN_ZOOM,AREA_MAX_ZOOM,AREA_TILE_SIZE} from './drainage_display.js?v=3.46.3';
import {createTerrainLocalLoader,TERRAIN_MIN_ZOOM,TERRAIN_MAX_ZOOM,TERRAIN_TILE_SIZE} from './terrain_local.js?v=3.46.3';
import {createBasemapThemeController,normaliseBasemapTheme,tintPalette,BASEMAP_THEMES} from './osm_basemap_themes.js?v=3.46.3';
import {createPlanningLayers,reliefStops,RELIEF_RAMPS,SPEED_STOPS} from './planning_layers.js?v=3.46.3';
import {FOCUS70_CENTER,FOCUS70_RADIUS_M,TERRAIN_BOUNDS,DRAINAGE_GRID_SIZE,DRAINAGE_3857,mercator3857ToLngLat,drainageTileCoordinates,contourMajorIntervalFor,networkCoordinates,makeCircleGeoJson,contourWorkerSource,mercatorFromLngLat,formatNetworkThreshold,normaliseFloodSelectionRing} from './map_core.js?v=3.46.3';
// Map rendering must not depend on a single CDN. Heavy analysis modules are
// loaded only AFTER the basemap has started.
let maplibregl;
try {
  maplibregl=await import('https://unpkg.com/maplibre-gl@6.13.0/dist/maplibre-gl.mjs');
} catch(primaryError) {
  console.warn('Primary MapLibre CDN unavailable; trying jsDelivr.',primaryError);
  try {
    maplibregl=await import('https://cdn.jsdelivr.net/npm/maplibre-gl@6.13.0/dist/maplibre-gl.mjs');
  } catch(secondaryError) {
    const status=document.getElementById('status');
    if(status){
      status.textContent='Map renderer failed to load from both CDNs. Check network access to unpkg.com and cdn.jsdelivr.net, then reload.';
      status.className='status error';
    }
    console.error('Both MapLibre CDN imports failed',primaryError,secondaryError);
    throw secondaryError;
  }
}

const APP_VERSION='3.46.3';
// Keep the header's version derived from exactly the same runtime build id.
document.getElementById('appVersionLabel').textContent='OpenStreetMap / OpenFreeMap · v'+APP_VERSION;
const CITY_BUILDINGS_SOURCE='osm-city-buildings-source';
const CITY_BUILDINGS_DRIVER_LAYER='osm-city-buildings-tile-driver';
const CITY_BUILDINGS_LAYER='osm-city-buildings-3d';
const CITY_BUILDINGS_BACKGROUND_FILL='osm-city-buildings-2d';
const assetUrl=path=>path+'?v='+APP_VERSION;

const API_KEY='AIzaSyANIQCOwWyl_-uJdc8JxLn7D5Y1AC55cY8';
const CENTER={lat:51.5074,lng:-0.1278};
const ZOOM=10;

// Environment Agency LiDAR Composite DTM 1 m source.
// v3.21.16 uses only the locally cached official terrain rendering at runtime.
// The browser builds WebMercator XYZ tiles in a worker, so no EA WMS/WMTS
// request is made while panning, zooming or pitching the map.
const TERRAIN_LOCAL_TILES=['ea-terrain-local://tiles/{z}/{x}/{y}'];
const TERRAIN_TILE_SOURCE='ea-terrain-local-source',TERRAIN_TILE_LAYER='ea-terrain-local-layer';



// Hydrology display uses the already reprojected EPSG:3857 raster directly.



const NETWORK_SOURCE='terrain-drainage-network-source';
const NETWORK_LAYER='terrain-drainage-network-layer';

const CONTOUR_SOURCE='os-terrain50-contours-source';
const CONTOUR_LINE_LAYER='os-terrain50-contours-line';
const CONTOUR_LABEL_LAYER='os-terrain50-contours-label';
const CONTOUR_DEFAULT_INTERVAL_M=10;
const CONTOUR_DEFAULT_MAJOR_INTERVAL_M=50;

// 25 m display: twice the base hydrology dimensions, split below 4096 px.
// Outer bounds and every image coordinate share the existing EPSG:3857 grid.
const FLOOD_GRID_SIZE=2;
const FLOOD_SOURCE_PREFIX='ea-flood-risk-source-';
const FLOOD_LAYER_PREFIX='ea-flood-risk-layer-';
const FLOOD_DETAIL_SOURCE='ea-flood-detail-source';
const FLOOD_DETAIL_LAYER='ea-flood-detail-layer';
const FLOOD_DETAIL_TILES=['ea-flood://tiles/{z}/{x}/{y}'];
function floodTileIds(row,col){
  const suffix=row+'-'+col;
  return {source:FLOOD_SOURCE_PREFIX+suffix,layer:FLOOD_LAYER_PREFIX+suffix};
}



let googleMap=null;
let osmMap=null;
let osmStyleReady=false;
let basemapTheme='planning'; // 03 is the default on every first load.
let basemapThemeController=null;
// Lighting / weather (scripts/map_atmosphere.js). Tints apply to the basemap,
// 3D buildings and vehicles only; analysis layers are never tinted.
let atmosphere=null;
let atmosphereTints=[];
// Ground shadows of the 3D buildings (scripts/building_shadows.js).
let buildingShadows=null;
// v3.40.1 · a phone: a touch screen whose short side is under 600 CSS px (iPhones; iPads start at 744). There the map
// draws at most 2 device pixels per CSS pixel and building shadows start off (the switch turns them on): iOS reloads
// a tab that takes too much graphics memory. Computers and iPads: as before.
const IS_PHONE=(()=>{try{return matchMedia('(pointer: coarse)').matches&&Math.min(screen.width,screen.height)<600;}catch(error){return false;}})();
// v3.41.0 · a touch screen (iPad, iPhone): ⓘ buttons for the layer notes (no hover there) and a button that shows or
// hides the display panel (hidden at first on phones and on an iPad held upright). Computers with a mouse: unchanged.
const TOUCH_UI=(()=>{try{return matchMedia('(pointer: coarse)').matches;}catch(error){return false;}})();
let buildingShadowsWanted=!IS_PHONE;
if(IS_PHONE&&document.getElementById('buildingShadowToggle'))document.getElementById('buildingShadowToggle').checked=false;   // ($ is defined further down)
let buildingShadowsActive=null;
// Procedural trees in green spaces (scripts/urban_trees.js); display only.
let urbanTrees=null;
let urbanTreesWanted=false;
let urbanTreesActive=null;
let lastAtmosphereSun=null;
let syncRasterBasemap=()=>{};
let googleMarker=null;
let osmMarker=null;
let googleLoading=false;
let currentProvider='osm';

// (27 Nov 2026) the opening film (scripts/intro.js) waits for this: the map is drawn and its controls are wired. To hand
// over, it asks where the map's own 70 km circle is on the screen, and moves the film's circle onto it.
window.londonMapIntro=window.londonMapIntro||{};
function markIntroReady(){
  const api=window.londonMapIntro;
  api.circle=()=>{
    if(!osmMap||currentProvider!=='osm')return null;
    const box=osmMap.getContainer().getBoundingClientRect();
    const dLat=FOCUS70_RADIUS_M/111320,dLng=dLat/Math.cos(FOCUS70_CENTER.lat*Math.PI/180);
    const north=osmMap.project([FOCUS70_CENTER.lng,FOCUS70_CENTER.lat+dLat]),south=osmMap.project([FOCUS70_CENTER.lng,FOCUS70_CENTER.lat-dLat]);
    const west=osmMap.project([FOCUS70_CENTER.lng-dLng,FOCUS70_CENTER.lat]),east=osmMap.project([FOCUS70_CENTER.lng+dLng,FOCUS70_CENTER.lat]);
    return {x:box.left+west.x,y:box.top+north.y,w:east.x-west.x,h:south.y-north.y};
  };
  api.ready=true;
}
let terrainEnabled=false;
let planning=null;   // v3.44.0: scripts/planning_layers.js, made when the map has loaded
let terrainOpacity=0.42;

let googleTerrainGround=null;
let googleTerrainBounds=null;

let terrainLocalError=null;
let terrainViewMode=null;

let contourEnabled=false;
let contourOpacity=0.72;
let contourIntervalM=CONTOUR_DEFAULT_INTERVAL_M;
let contourWorker=null;
let contourWorkerRequestId=0;
let contourPendingTimer=null;
let contourLastAppliedRequest=0;
let contourError=null;
let contourHoverPopup=null;
let contourHoverBound=false;

let networkEnabled=false;
let networkOpacity=0.9;
let networkThreshold=1;
let networkThresholdRaf=0;
let networkThresholdTimer=null;
let networkThresholdLastRefresh=0;
let networkTileSeen=false;
let networkDisplayError=null;
let floodEnabled=false;
let floodOpacity=0.7;
let floodRiskSource='combined';
let floodDisplayMode='nearest';
let floodRequestId=0;
const floodImageUrls=new Map();
let floodLoadingPromise=null;
let floodDetailError=null;
let floodDetailSeen=false;
let floodDetailRetryCount=0;
let floodDetailRetryTimer=null;
let floodAppliedMode=null;
let floodAppliedOpacity=null;

let siteUI=null;

// Street traffic lives in scripts/street_traffic.js and is loaded on first use.
// It never participates in flood building selection or simulation geometry.
let streetVehiclesEnabled=false;
let streetTraffic=null;
let streetTrafficLoading=null;

let focus70Enabled=false;
let googleFocusCircle=null;
let osmFocusReady=false;
let cityBuildingsShown=false;
let localFloodBuildingOverride=false;
let localFloodSelectionRing=[];
let localFloodIsolateMode=false;
let citySelectionPaintAppliedRing=null;
let citySelectionPaintAppliedOverride=null;
let lastCityVehicleView3D=null;
let lastCityBuildingLodSource=null,lastCityBuildingLodKey='';
// v3.40.0 · ?lod=old: the building tiles as before v3.40 (every tile on screen at z14, own 'latest' address), for comparison.
// ?lod=12.6 (a number): the lowest tile zoom aimed for at the far edge (default 12.8; below 12 the far band would go blank).
const CITY_BUILDING_LOD=(()=>{const v=new URLSearchParams(location.search).get('lod');return v==='old'?'old':(Number.isFinite(+v)&&v!==null&&v!==''?Math.max(12.2,Math.min(14,+v)):12.8);})();
const CITY_BUILDINGS_FALLBACK_TILES='https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf';
// Historical variable name retained for compatibility: it now means
// "OSM labels / POIs hidden", not road/building geometry hidden.
let osmStructuresHidden=true; // OSM road/place/POI labels start hidden (switch off by default).
const osmBaseLayerVisibility=new Map();
function syncThemeTiles(mode){
  for(const tile of document.querySelectorAll('#displayPanel .dpTheme')){
    tile.setAttribute('aria-pressed',String(tile.dataset.theme===mode));
  }
}
function cityBuildingColour(theme=basemapTheme){
  const base=(BASEMAP_THEMES[theme]||BASEMAP_THEMES.planning).extrusion;
  return tintPalette({building:base},atmosphereTints).building;
}

function applyAtmosphereTints(tints){
  atmosphereTints=Array.isArray(tints)?tints:[];
  if(!osmMap||!osmStyleReady)return;
  basemapThemeController?.setTint(atmosphereTints);
  basemapThemeController?.apply(basemapTheme);
  const building=cityBuildingColour();
  if(osmMap.getLayer(CITY_BUILDINGS_LAYER))
    osmMap.setPaintProperty(CITY_BUILDINGS_LAYER,'fill-extrusion-color',building);
  if(osmMap.getLayer(CITY_BUILDINGS_BACKGROUND_FILL))
    osmMap.setPaintProperty(CITY_BUILDINGS_BACKGROUND_FILL,'fill-color',building);
  streetTraffic?.setTint?.(atmosphereTints);
  urbanTrees?.setTint(atmosphereTints);
}

function syncAtmosphereButtons(state){
  for(const b of document.querySelectorAll('#displayPanel [data-lighting]')){
    b.setAttribute('aria-pressed',String(b.dataset.lighting===state.lighting));
  }
  for(const b of document.querySelectorAll('#displayPanel [data-weather]')){
    b.setAttribute('aria-pressed',String(b.dataset.weather===state.weather));
  }
  const live=$('liveLightingInfo');
  if(live){
    if(state.lighting==='live'&&state.sun){
      const now=new Date();
      const hh=String(now.getHours()).padStart(2,'0'),mm=String(now.getMinutes()).padStart(2,'0');
      live.textContent=hh+':'+mm+' · '+Math.round(state.sun.altitude)+'°';
    }else live.textContent='';
  }
}

function syncUrbanTrees(){
  if(!urbanTrees)return;
  const active=urbanTreesWanted&&!localFloodIsolateMode;
  if(active!==urbanTreesActive){
    urbanTreesActive=active;
    urbanTrees.setEnabled(active);
    buildingShadows?.refresh();
  }
}

function initUrbanTrees(){
  if(urbanTrees||!osmMap)return;
  Promise.all([
    import('./urban_trees.js?v='+APP_VERSION),
    import('./tree_renderer.js?v='+APP_VERSION)
  ])
    .then(([{createUrbanTrees},{createTreeRenderer}])=>{
      if(urbanTrees)return;
      urbanTrees=createUrbanTrees(osmMap,{
        sourceId:streetRoadSourceId(),
        buildingSources:[CITY_BUILDINGS_SOURCE],
        createRenderer:()=>createTreeRenderer(osmMap,maplibregl,{
          beforeId:()=>osmMap.getLayer(CITY_BUILDINGS_LAYER)?CITY_BUILDINGS_LAYER:undefined
        }),
        onChange:()=>buildingShadows?.refresh()
      });
      urbanTrees.setTint(atmosphereTints);
      if(lastAtmosphereSun)urbanTrees.setSun(lastAtmosphereSun);
      $('urbanTreeToggle').disabled=false;
      syncUrbanTrees();
    })
    .catch(error=>{
      console.error('Trees failed to load',error);
      say('Trees could not load: '+(error.message||error),true);
    });
}

function syncBuildingShadows(){
  if(!buildingShadows)return;
  const active=buildingShadowsWanted&&!localFloodIsolateMode;
  if(active!==buildingShadowsActive){
    buildingShadowsActive=active;
    buildingShadows.setEnabled(active);
  }
}

function initAtmosphere(){
  if(atmosphere||!osmMap)return;
  Promise.all([
    import('./map_atmosphere.js?v='+APP_VERSION),
    import('./building_shadows.js?v='+APP_VERSION).catch(error=>{
      console.warn('Building shadows unavailable',error);
      return null;
    })
  ])
    .then(([{createAtmosphere},shadowModule])=>{
      if(atmosphere)return;
      if(shadowModule){
        buildingShadows=shadowModule.createBuildingShadowLayer(osmMap,maplibregl,{
          sourceId:CITY_BUILDINGS_SOURCE,
          extraFootprints:()=>urbanTrees?.shadowFootprints()||[],
          beforeId:()=>osmMap.getLayer(CITY_BUILDINGS_LAYER)?CITY_BUILDINGS_LAYER:undefined
        });
        syncBuildingShadows();
        $('buildingShadowToggle').disabled=false;
      }
      atmosphere=createAtmosphere(osmMap,{
        onTint:applyAtmosphereTints,
        onChange:syncAtmosphereButtons,
        onSun:sun=>{
          lastAtmosphereSun=sun;
          urbanTrees?.setSun(sun);
          if(!buildingShadows)return;
          buildingShadows.setSun(sun);
          buildingShadows.setStrength(sun.strength);
        }
      });
      for(const b of document.querySelectorAll('#displayPanel [data-lighting]')){
        b.disabled=false;
        b.addEventListener('click',()=>atmosphere.setLighting(b.dataset.lighting));
      }
      for(const b of document.querySelectorAll('#displayPanel [data-weather]')){
        b.disabled=false;
        b.addEventListener('click',()=>atmosphere.setWeather(b.dataset.weather));
      }
      syncAtmosphereButtons(atmosphere.state());
    })
    .catch(error=>{
      console.error('Lighting and weather failed to load',error);
      say('Lighting and weather could not load: '+(error.message||error),true);
    });
}

function setBasemapTheme(mode){
  const next=normaliseBasemapTheme(mode);
  if(basemapTheme===next&&basemapThemeController?.getMode()===next)return;
  basemapTheme=next;
  const select=$('osmVisualStyle');
  if(select)select.value=next;
  syncThemeTiles(next);
  if(osmMap&&osmStyleReady){
    // Paint-only; never setStyle() or lose EA/DEM/tensor/site layers.
    basemapThemeController?.apply(next);
    syncRasterBasemap();
    const building=cityBuildingColour(next);
    if(osmMap.getLayer(CITY_BUILDINGS_LAYER))
      osmMap.setPaintProperty(CITY_BUILDINGS_LAYER,'fill-extrusion-color',building);
    if(osmMap.getLayer(CITY_BUILDINGS_BACKGROUND_FILL))
      osmMap.setPaintProperty(CITY_BUILDINGS_BACKGROUND_FILL,'fill-color',building);
    planning?.applyTheme();
    syncRailKey();
  }
}
let searchMarker=null;
let searchController=null;
let searchRequestId=0;
const searchPlaces=createPlaceSearch();

let sharedView={lat:CENTER.lat,lng:CENTER.lng,zoom:ZOOM,source:currentProvider};

const $=id=>document.getElementById(id);
const say=(m,e=false)=>{
  $('status').textContent=m;
  $('status').className='status'+(e?' error':'');
};

const API_STATS_KEY='googleMapLive.apiLoadStats.v1';
let apiSessionLoads=0;

function localDateKey(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}

function localMonthKey(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  return y+'-'+m;
}

function readApiStats(){
  try{
    const raw=localStorage.getItem(API_STATS_KEY);
    if(!raw)return {total:0,days:{}};
    const parsed=JSON.parse(raw);
    return {
      total:Number(parsed.total)||0,
      days:parsed.days&&typeof parsed.days==='object'?parsed.days:{}
    };
  }catch(err){
    console.warn('API stats read failed',err);
    return {total:0,days:{}};
  }
}

function writeApiStats(stats){
  try{
    localStorage.setItem(API_STATS_KEY,JSON.stringify(stats));
  }catch(err){
    console.warn('API stats write failed',err);
  }
}

function pruneApiStats(stats){
  const cutoff=new Date();
  cutoff.setDate(cutoff.getDate()-400);
  const cutoffKey=localDateKey(cutoff);
  for(const key of Object.keys(stats.days)){
    if(key<cutoffKey)delete stats.days[key];
  }
  return stats;
}

function renderApiStats(){
  const stats=readApiStats();
  const today=localDateKey();
  const month=localMonthKey();

  let monthTotal=0;
  for(const [day,count] of Object.entries(stats.days)){
    if(day.startsWith(month))monthTotal+=Number(count)||0;
  }

  $('apiStatSession').textContent=String(apiSessionLoads);
  $('apiStatToday').textContent=String(Number(stats.days[today])||0);
  $('apiStatMonth').textContent=String(monthTotal);
  $('apiStatTotal').textContent=String(Number(stats.total)||0);
}

function recordGoogleMapLoad(){
  const stats=pruneApiStats(readApiStats());
  const today=localDateKey();

  apiSessionLoads+=1;
  stats.total=(Number(stats.total)||0)+1;
  stats.days[today]=(Number(stats.days[today])||0)+1;

  writeApiStats(stats);
  renderApiStats();
}

function resetApiStats(){
  localStorage.removeItem(API_STATS_KEY);
  apiSessionLoads=0;
  renderApiStats();
}

function syncBadge(){
  $('providerBadge').textContent='OpenStreetMap · no API key';
  $('mapType').disabled=true;
  $('note').textContent=
    'Development mode uses OpenStreetMap / OpenFreeMap only; Google Maps API will not load.';
}

window.gm_authFailure=()=>{
  console.error('Google Maps authentication failed.');
  say('Google Maps API key validation failed; switching to OpenStreetMap…',true);

  terrainCameraStarted();

  setTimeout(()=>{
    const provider=$('provider');
    provider.value='osm';
    switchProvider('osm');
  },350);
};

function loadGoogleScript(){
  return new Promise((resolve,reject)=>{
    if(window.google&&window.google.maps){resolve();return;}
    if(googleLoading){
      const t=setInterval(()=>{
        if(window.google&&window.google.maps){clearInterval(t);resolve();}
      },100);
      setTimeout(()=>{clearInterval(t);reject(new Error('Google Maps timed out.'));},20000);
      return;
    }
    googleLoading=true;
    window.__initGoogleMap=()=>{googleLoading=false;resolve();};
    const s=document.createElement('script');
    s.async=true;s.defer=true;
    s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(API_KEY)+
      '&loading=async&libraries=maps&v=weekly&language=en&region=GB&auth_referrer_policy=origin&callback=__initGoogleMap';
    s.onerror=()=>{googleLoading=false;reject(new Error('Google Maps script download failed.'))};
    document.head.appendChild(s);
  });
}




function ensureContourWorker(){
  if(contourWorker)return contourWorker;

  const blob=new Blob([contourWorkerSource()],{type:'text/javascript'});
  const workerUrl=URL.createObjectURL(blob);
  contourWorker=new Worker(workerUrl);
  URL.revokeObjectURL(workerUrl);

  const center3857=mercatorFromLngLat(
    FOCUS70_CENTER.lng,
    FOCUS70_CENTER.lat
  );
  const mercatorRadius=
    FOCUS70_RADIUS_M/
    Math.cos(FOCUS70_CENTER.lat*Math.PI/180);

  contourWorker.postMessage({
    type:'init',
    config:{
      url:new URL(
        assetUrl('assets/drainage_area/dem50_log16.webp'),
        location.href
      ).href,
      width:DRAINAGE_3857.baseWidth50m,
      height:DRAINAGE_3857.baseHeight50m,
      bounds:DRAINAGE_3857,
      minimum:-100,
      step:0.1,
      interval:CONTOUR_DEFAULT_INTERVAL_M,
      majorInterval:CONTOUR_DEFAULT_MAJOR_INTERVAL_M,
      study:{
        x:center3857.x,
        y:center3857.y,
        radius:mercatorRadius
      }
    }
  });

  contourWorker.onmessage=event=>{
    const data=event.data||{};

    if(data.type==='error'){
      contourError=data.message||'Contour generation failed';
      if(contourEnabled){
        $('contourStatus').textContent=contourError;
        $('contourStatus').className='layerStatus error';
      }
      return;
    }

    if(
      data.type!=='contours'||
      !contourEnabled||
      data.requestId<contourLastAppliedRequest
    )return;

    contourLastAppliedRequest=data.requestId;
    contourError=null;

    const source=osmMap?.getSource(CONTOUR_SOURCE);
    if(source)source.setData(data.geojson);

    const count=data.geojson?.features?.length||0;
    const interval=Number(data.interval)||contourIntervalM;
    $('contourStatus').textContent=
      'Visible · '+interval+' m Contour interval · '+count+' elevation levels';
    $('contourStatus').className='layerStatus';
  };

  return contourWorker;
}

function ensureContourLayer(){
  if(!osmMap||!osmStyleReady)return;

  if(!osmMap.getSource(CONTOUR_SOURCE)){
    osmMap.addSource(CONTOUR_SOURCE,{
      type:'geojson',
      data:{type:'FeatureCollection',features:[]},
      attribution:'OS Terrain 50 · Ordnance Survey OpenData'
    });
  }

  if(!osmMap.getLayer(CONTOUR_LINE_LAYER)){
    osmMap.addLayer({
      id:CONTOUR_LINE_LAYER,
      type:'line',
      source:CONTOUR_SOURCE,
      minzoom:9,
      layout:{
        visibility:contourEnabled?'visible':'none',
        'line-join':'round',
        'line-cap':'round'
      },
      paint:{
        'line-color':[
          'case',
          ['==',['get','major'],1],
          '#655548',
          '#8b7a6b'
        ],
        'line-opacity':contourOpacity,
        'line-width':[
          'interpolate',['linear'],['zoom'],
          9,['case',['==',['get','major'],1],1.15,0.55],
          16,['case',['==',['get','major'],1],2.1,1.0]
        ]
      }
    },getFirstSymbolLayerId());
  }

  if(!osmMap.getLayer(CONTOUR_LABEL_LAYER)){
    osmMap.addLayer({
      id:CONTOUR_LABEL_LAYER,
      type:'symbol',
      source:CONTOUR_SOURCE,
      minzoom:11.5,
      layout:{
        visibility:contourEnabled?'visible':'none',
        'symbol-placement':'line',
        'symbol-spacing':300,
        'text-field':['get','label'],
        'text-size':[
          'case',
          ['==',['get','major'],1],
          11.5,
          10
        ],
        'text-allow-overlap':false,
        'text-ignore-placement':false,
        'text-keep-upright':true,
        'text-max-angle':35
      },
      paint:{
        'text-color':[
          'case',
          ['==',['get','major'],1],
          '#4f4338',
          '#75685c'
        ],
        'text-halo-color':'rgba(255,255,255,0.94)',
        'text-halo-width':1.35,
        'text-opacity':[
          'interpolate',['linear'],['zoom'],
          11.5,['case',['==',['get','major'],1],1,0.72],
          14,1
        ]
      }
    });
  }

  if(!contourHoverBound){
    contourHoverBound=true;

    const showContourElevation=event=>{
      if(!contourEnabled||currentProvider!=='osm')return;
      const feature=event.features?.[0];
      const elevation=Number(feature?.properties?.elevation);
      if(!Number.isFinite(elevation))return;

      osmMap.getCanvas().style.cursor='pointer';

      if(!contourHoverPopup){
        contourHoverPopup=new maplibregl.Popup({
          closeButton:false,
          closeOnClick:false,
          offset:10,
          className:'contour-elevation-popup'
        });
      }

      contourHoverPopup
        .setLngLat(event.lngLat)
        .setHTML(
          '<strong>Contour elevation</strong><br>'+
          Math.round(elevation)+' m'
        )
        .addTo(osmMap);
    };

    osmMap.on('mouseenter',CONTOUR_LINE_LAYER,event=>{
      showContourElevation(event);
    });

    osmMap.on('mousemove',CONTOUR_LINE_LAYER,event=>{
      showContourElevation(event);
    });

    osmMap.on('mouseleave',CONTOUR_LINE_LAYER,()=>{
      osmMap.getCanvas().style.cursor='';
      contourHoverPopup?.remove();
    });

    osmMap.on('click',CONTOUR_LINE_LAYER,event=>{
      showContourElevation(event);
    });
  }
}

function contourViewportBounds(){
  if(!osmMap)return null;

  const b=osmMap.getBounds();
  const sw=mercatorFromLngLat(b.getWest(),b.getSouth());
  const ne=mercatorFromLngLat(b.getEast(),b.getNorth());
  const padX=(ne.x-sw.x)*0.10;
  const padY=(ne.y-sw.y)*0.10;

  return {
    left:Math.max(DRAINAGE_3857.left,sw.x-padX),
    right:Math.min(DRAINAGE_3857.right,ne.x+padX),
    bottom:Math.max(DRAINAGE_3857.bottom,sw.y-padY),
    top:Math.min(DRAINAGE_3857.top,ne.y+padY)
  };
}

function refreshContourLayer(delay=80){
  clearTimeout(contourPendingTimer);
  contourPendingTimer=null;

  if(
    !contourEnabled||
    !osmMap||
    !osmStyleReady||
    currentProvider!=='osm'
  )return;

  ensureContourLayer();

  contourPendingTimer=setTimeout(()=>{
    if(
      !contourEnabled||
      !osmMap||
      currentProvider!=='osm'||
      osmMap.isMoving?.()||
      osmMap.isZooming?.()
    )return;

    const bounds=contourViewportBounds();
    if(
      !bounds||
      bounds.left>=bounds.right||
      bounds.bottom>=bounds.top
    )return;

    const requestId=++contourWorkerRequestId;
    $('contourStatus').textContent=
      requestId===1?'Reading OS Terrain 50…':'Updating contours…';
    $('contourStatus').className='layerStatus';

    ensureContourWorker().postMessage({
      type:'contours',
      requestId,
      bounds,
      zoom:osmMap.getZoom(),
      interval:contourIntervalM,
      majorInterval:contourMajorIntervalFor(contourIntervalM)
    });
  },delay);
}

function updateContourLayer(){
  if(!osmMap||!osmStyleReady)return;

  ensureContourLayer();

  const visibility=
    contourEnabled&&currentProvider==='osm'
      ?'visible'
      :'none';

  for(const id of [CONTOUR_LINE_LAYER,CONTOUR_LABEL_LAYER]){
    if(osmMap.getLayer(id)){
      osmMap.setLayoutProperty(id,'visibility',visibility);
    }
  }

  if(contourEnabled&&currentProvider==='osm'){
    $('contourStatus').textContent='Preparing contours…';
    $('contourStatus').className='layerStatus';
    refreshContourLayer(10);
  }else{
    $('contourStatus').textContent=
      contourEnabled?'Only available with OpenStreetMap / OpenFreeMap':'Off';
    $('contourStatus').className='layerStatus';
  }
}

function applyContourOpacity(){
  if(osmMap?.getLayer(CONTOUR_LINE_LAYER)){
    osmMap.setPaintProperty(
      CONTOUR_LINE_LAYER,
      'line-opacity',
      contourOpacity
    );
  }
}

function removeGoogleTerrain(){
  if(googleTerrainGround){
    googleTerrainGround.setMap(null);
    googleTerrainGround=null;
  }
  googleTerrainBounds=null;
}

function removeOsmTerrain(){
  if(!osmMap)return;
  if(osmMap.getLayer(TERRAIN_TILE_LAYER)){
    osmMap.setLayoutProperty(TERRAIN_TILE_LAYER,'visibility','none');
  }
  terrainViewMode=null;
  terrainLocalError=null;
  $('terrainStatus').textContent='Off';
  $('terrainStatus').className='layerStatus';
}

async function refreshGoogleTerrainGround(){
  if(!googleMap||!terrainEnabled)return;
  const nw=networkCoordinates()[0],se=networkCoordinates()[2];
  const bounds={north:nw[1],south:se[1],east:se[0],west:nw[0]};
  const url=assetUrl('assets/terrain/overview.webp');

  const next=new google.maps.GroundOverlay(
    url,
    bounds,
    {opacity:terrainOpacity,clickable:false}
  );
  next.setMap(googleMap);

  const old=googleTerrainGround;
  googleTerrainGround=next;
  googleTerrainBounds={...bounds};
  if(old)old.setMap(null);
  say('EA terrain uses local cached tiles; no live WMS / WMTS requests.');
}

function ensureOsmTerrainLayer(){
  if(!osmMap||!osmStyleReady||!terrainEnabled)return;
  const nw=networkCoordinates()[0],se=networkCoordinates()[2];

  if(!osmMap.getSource(TERRAIN_TILE_SOURCE)){
    osmMap.addSource(TERRAIN_TILE_SOURCE,{
      type:'raster',
      tiles:TERRAIN_LOCAL_TILES,
      tileSize:TERRAIN_TILE_SIZE,
      minzoom:TERRAIN_MIN_ZOOM,
      maxzoom:TERRAIN_MAX_ZOOM,
      bounds:[nw[0],se[1],se[0],nw[1]],
      attribution:'© Environment Agency 2022 · Open Government Licence'
    });
    osmMap.addLayer({
      id:TERRAIN_TILE_LAYER,
      type:'raster',
      source:TERRAIN_TILE_SOURCE,
      paint:{
        'raster-opacity':terrainOpacity,
        'raster-fade-duration':0,
        'raster-resampling':'linear'
      }
    },getFirstSymbolLayerId());
  }else{
    osmMap.setLayoutProperty(TERRAIN_TILE_LAYER,'visibility','visible');
  }

  keepDrainageAboveTerrain();
  syncTerrainView();
}

function syncTerrainView(){
  if(!terrainEnabled||!osmMap||!osmStyleReady||!osmMap.getLayer(TERRAIN_TILE_LAYER))return;
  osmMap.setLayoutProperty(TERRAIN_TILE_LAYER,'visibility','visible');
  if(osmMap.getPaintProperty(TERRAIN_TILE_LAYER,'raster-opacity')!==terrainOpacity){
    osmMap.setPaintProperty(TERRAIN_TILE_LAYER,'raster-opacity',terrainOpacity);
  }

  const loaded=osmMap.isSourceLoaded(TERRAIN_TILE_SOURCE);
  const mode=terrainLocalError?'error':loaded?'loaded':'loading';
  if(mode===terrainViewMode)return;
  terrainViewMode=mode;

  $('terrainStatus').className='layerStatus'+(mode==='error'?' error':'');
  $('terrainStatus').textContent=
    mode==='loaded'?'Visible · locally tiled terrain · no live service required':
    mode==='error'?'Local terrain tile loading error; refresh and retry':
    'Generating local terrain tiles…';
}

function applyTerrainOpacity(){
  if(googleTerrainGround)googleTerrainGround.setOpacity(terrainOpacity);
  if(osmMap&&osmMap.getLayer(TERRAIN_TILE_LAYER)){
    osmMap.setPaintProperty(TERRAIN_TILE_LAYER,'raster-opacity',terrainOpacity);
    syncTerrainView();
  }
}

function terrainCameraStarted(){}

function terrainCameraChanged(){
  if(terrainEnabled&&currentProvider==='osm')syncTerrainView();
}

function terrainCameraEnded(){
  if(terrainEnabled&&currentProvider==='osm')syncTerrainView();
}

function updateTerrainLayers(){
  if(!terrainEnabled){
    removeGoogleTerrain();
    removeOsmTerrain();
    return;
  }
  terrainLocalError=null;
  terrainViewMode=null;
  if(currentProvider==='osm'){
    ensureOsmTerrainLayer();
    applyTerrainOpacity();
  }else{
    refreshGoogleTerrainGround();
  }
}

function getFirstSymbolLayerId(){
  if(!osmMap)return undefined;
  return (osmMap.getStyle()?.layers||[]).find(layer=>layer.type==='symbol')?.id;
}

/* Overview (zoomed far out): a simplified map of the whole of London.
   Greater London's outline (assets/greater_london_outline.geojson, the OSM
   admin_level 5 boundary extracted from OpenFreeMap z10 tiles, because the
   low-zoom tiles carry no regional boundaries) is drawn boldly with a label, the street network fades back and road-number
   shields are hidden. Everything returns to normal while zooming back in;
   buildings, vehicles and shadows already disappear at these zooms. */
const OVERVIEW_MAX_ZOOM=10.8;
const OVERVIEW_OUTLINE_CASING='london-overview-outline-casing';
const OVERVIEW_OUTLINE='london-overview-outline';
const OVERVIEW_LABEL='london-overview-label';
const OVERVIEW_OUTLINE_SOURCE='london-overview-outline-source';
function ensureOverviewLayers(){
  if(!osmMap||!osmStyleReady)return;
  const sources=osmMap.getStyle()?.sources||{};
  const src=sources.openmaptiles?'openmaptiles':null;
  if(!src)return;
  const before=getFirstSymbolLayerId();
  const fade=(full)=>['interpolate',['linear'],['zoom'],OVERVIEW_MAX_ZOOM-0.6,full,OVERVIEW_MAX_ZOOM+0.4,0];
  if(!osmMap.getSource(OVERVIEW_OUTLINE_SOURCE)){
    osmMap.addSource(OVERVIEW_OUTLINE_SOURCE,{type:'geojson',
      data:assetUrl('assets/greater_london_outline.geojson'),
      attribution:'© OpenStreetMap contributors'});
  }
  if(!osmMap.getLayer(OVERVIEW_OUTLINE_CASING)){
    osmMap.addLayer({id:OVERVIEW_OUTLINE_CASING,type:'line',source:OVERVIEW_OUTLINE_SOURCE,
      maxzoom:OVERVIEW_MAX_ZOOM+0.5,
      layout:{'line-join':'round','line-cap':'round'},
      paint:{'line-color':'#ffffff','line-width':['interpolate',['linear'],['zoom'],7,4,11,7],'line-opacity':fade(0.85)}
    },before);
  }
  if(!osmMap.getLayer(OVERVIEW_OUTLINE)){
    osmMap.addLayer({id:OVERVIEW_OUTLINE,type:'line',source:OVERVIEW_OUTLINE_SOURCE,
      maxzoom:OVERVIEW_MAX_ZOOM+0.5,
      layout:{'line-join':'round','line-cap':'round'},
      paint:{'line-color':'#5f6672','line-width':['interpolate',['linear'],['zoom'],7,1.4,11,2.6],'line-opacity':fade(0.95)}
    },before);
  }
  if(!osmMap.getSource(OVERVIEW_LABEL)){
    osmMap.addSource(OVERVIEW_LABEL,{type:'geojson',data:{type:'FeatureCollection',features:[
      {type:'Feature',properties:{name:'GREATER LONDON'},geometry:{type:'Point',coordinates:[-0.118,51.43]}}
    ]}});
  }
  if(!osmMap.getLayer(OVERVIEW_LABEL)){
    const cityLabel=(osmMap.getStyle()?.layers||[]).find(l=>l.type==='symbol'&&/label_city|place/i.test(l.id));
    const font=cityLabel?.layout?.['text-font']||['Noto Sans Regular'];
    osmMap.addLayer({id:OVERVIEW_LABEL,type:'symbol',source:OVERVIEW_LABEL,maxzoom:OVERVIEW_MAX_ZOOM+0.5,
      layout:{'text-field':['get','name'],'text-font':font,'text-size':['interpolate',['linear'],['zoom'],7,11,10,15],
        'text-letter-spacing':0.35,'text-max-width':30,'text-allow-overlap':false},
      paint:{'text-color':'#5f6672','text-halo-color':'rgba(255,255,255,0.85)','text-halo-width':1.6,'text-opacity':fade(1)}
    });
  }
  for(const layer of osmMap.getStyle()?.layers||[]){
    if(layer.source!==src)continue;
    // Road-number shields only clutter the overview.
    if(layer.type==='symbol'&&/shield/i.test(layer.id)){
      osmMap.setLayerZoomRange(layer.id,Math.max(layer.minzoom||0,OVERVIEW_MAX_ZOOM),layer.maxzoom??24);
      continue;
    }
    // Streets fade back in the overview (only layers with default opacity).
    if(layer.type==='line'&&layer['source-layer']==='transportation'){
      const current=osmMap.getPaintProperty(layer.id,'line-opacity');
      if(current===undefined||current===1){
        osmMap.setPaintProperty(layer.id,'line-opacity',
          ['interpolate',['linear'],['zoom'],8,0.4,OVERVIEW_MAX_ZOOM+0.4,1]);
      }
    }
  }
}

function keepDrainageAboveTerrain(){
  if(!osmMap||!osmStyleReady)return;
  const firstSymbol=getFirstSymbolLayerId();
  if(!firstSymbol)return;

  // Categories sit above terrain/contributing area; the blue network and labels
  // remain readable above the flood overview, regardless of load order.
  // v3.44.0: the Green Belt and AONB fills go under the flood picture; their edges, rail and HS1/HS2 go over the
  // drainage network and under the 3D buildings.
  planning?.moveFills(firstSymbol);
  for(let row=0;row<FLOOD_GRID_SIZE;row++){
    for(let col=0;col<FLOOD_GRID_SIZE;col++){
      const ids=floodTileIds(row,col);
      if(osmMap.getLayer(ids.layer))osmMap.moveLayer(ids.layer,firstSymbol);
    }
  }
  if(osmMap.getLayer(FLOOD_DETAIL_LAYER))osmMap.moveLayer(FLOOD_DETAIL_LAYER,firstSymbol);
  if(osmMap.getLayer(NETWORK_LAYER))osmMap.moveLayer(NETWORK_LAYER,firstSymbol);
  planning?.moveLines(firstSymbol);
  for(const id of [
    CITY_BUILDINGS_LAYER,CITY_BUILDINGS_BACKGROUND_FILL
  ]){
    if(osmMap.getLayer(id))osmMap.moveLayer(id,firstSymbol);
  }
}

function setFloodStatus(message,error=false){
  $('floodStatus').textContent=message;
  $('floodStatus').className='layerStatus'+(error?' error':'');
}

function ensureFloodDetailLayer(){
  if(floodRiskSource!=='combined'||!floodEnabled||!osmStyleReady||!osmMap||osmMap.getZoom()<DETAIL_MIN_ZOOM||
     !osmMap.getLayer(floodTileIds(0,0).layer))return;
  if(!osmMap.getSource(FLOOD_DETAIL_SOURCE)){
    const nw=networkCoordinates()[0],se=networkCoordinates()[2];
    osmMap.addSource(FLOOD_DETAIL_SOURCE,{
      type:'raster',tiles:FLOOD_DETAIL_TILES,tileSize:DETAIL_TILE_SIZE,
      minzoom:DETAIL_MIN_ZOOM,maxzoom:DETAIL_MAX_ZOOM,
      bounds:[nw[0],se[1],se[0],nw[1]],
      attribution:'© Environment Agency · Open Government Licence v3.0'
    });
  }
  if(!osmMap.getLayer(FLOOD_DETAIL_LAYER)){
    osmMap.addLayer({id:FLOOD_DETAIL_LAYER,type:'raster',source:FLOOD_DETAIL_SOURCE,
      minzoom:DETAIL_MIN_ZOOM,
      paint:{'raster-opacity':0,'raster-fade-duration':120,'raster-resampling':floodDisplayMode}
    },getFirstSymbolLayerId());
    floodAppliedMode=null;
    keepDrainageAboveTerrain();
  }
}

function syncFloodView(){
  if(!floodEnabled||!osmMap||!osmStyleReady||!osmMap.getLayer(floodTileIds(0,0).layer))return;
  ensureFloodDetailLayer();
  const close=floodRiskSource==='combined'&&osmMap.getZoom()>=DETAIL_MIN_ZOOM;
  const ready=close&&floodDetailSeen&&!floodDetailError&&osmMap.getSource(FLOOD_DETAIL_SOURCE)&&
    osmMap.isSourceLoaded(FLOOD_DETAIL_SOURCE);
  const mode=ready?'detail':close?(floodDetailError?'error':'loading'):'overview';
  if(mode===floodAppliedMode&&floodOpacity===floodAppliedOpacity)return;
  floodAppliedMode=mode;floodAppliedOpacity=floodOpacity;
  for(let row=0;row<FLOOD_GRID_SIZE;row++){
    for(let col=0;col<FLOOD_GRID_SIZE;col++){
      const layer=floodTileIds(row,col).layer;
      if(osmMap.getLayer(layer))osmMap.setPaintProperty(layer,'raster-opacity',ready?0:floodOpacity);
    }
  }
  if(osmMap.getLayer(FLOOD_DETAIL_LAYER)){
    osmMap.setPaintProperty(FLOOD_DETAIL_LAYER,'raster-opacity',ready?floodOpacity:0);
  }
  if(mode==='detail')setFloodStatus('Visible · EA official street-level detail · '+(floodDisplayMode==='nearest'?'Discrete classes':'Smoothed transition'));
  else if(mode==='loading')setFloodStatus('Loading official street-level detail… overview shown temporarily');
  else if(mode==='error')setFloodStatus('Detailed service unavailable; overview retained. Toggle to retry.',true);
  else setFloodStatus('Visible · 25 m risk map · '+(floodDisplayMode==='nearest'?'Original classes':'Smoothed display'));
}

function handleFloodDetailError(error){
  if(!floodEnabled)return;
  floodDetailError=error?.message||String(error);
  syncFloodView();
  // Successful tiles are cached by the loader; retry only the failed view.
  if(floodDetailRetryTimer||floodDetailRetryCount>=2)return;
  floodDetailRetryTimer=setTimeout(()=>{
    floodDetailRetryTimer=null;
    const source=osmMap?.getSource(FLOOD_DETAIL_SOURCE);
    if(!floodEnabled||!source||osmMap.getZoom()<DETAIL_MIN_ZOOM)return;
    floodDetailRetryCount++;
    floodDetailError=null;
    source.setTiles(FLOOD_DETAIL_TILES);
    syncFloodView();
  },2000);
}

async function getFloodImageUrls(source=floodRiskSource){
  if(floodLoadingPromise?.source===source)return floodLoadingPromise.promise;
  const tasks=[];
  for(let row=0;row<FLOOD_GRID_SIZE;row++){
    for(let col=0;col<FLOOD_GRID_SIZE;col++){
      const suffix=row+'-'+col;
      const key=source+':'+suffix;
      tasks.push((async()=>{
        if(floodImageUrls.has(key))return floodImageUrls.get(key);
        const response=await fetch(assetUrl('assets/flood_risk/'+(source==='combined'?'flood':source)+'_'+suffix+'.webp'),{cache:'force-cache'});
        if(!response.ok)throw new Error((source==='combined'?'Combined risk':'Independent EA risk')+' data file not published or failed to load ('+response.status+'). No alternative source was substituted.');
        const blob=await response.blob();
        const bitmap=await createImageBitmap(blob);
        const valid=bitmap.width===DRAINAGE_3857.baseWidth50m&&
          bitmap.height===DRAINAGE_3857.baseHeight50m;
        bitmap.close?.();
        if(!valid)throw new Error('Flood raster dimensions do not match the reference grid');
        const url=URL.createObjectURL(blob);
        if(floodImageUrls.has(key)){
          URL.revokeObjectURL(url);
          return floodImageUrls.get(key);
        }
        floodImageUrls.set(key,url);
        return url;
      })());
    }
  }
  // All files must pass validation before installing any visible tile.
  const promise=Promise.all(tasks);
  floodLoadingPromise={source,promise};
  try{return await promise;}finally{if(floodLoadingPromise?.promise===promise)floodLoadingPromise=null;}
}

function removeFloodLayer(){
  if(!osmMap)return;
  clearTimeout(floodDetailRetryTimer);floodDetailRetryTimer=null;
  if(osmMap.getLayer(FLOOD_DETAIL_LAYER))osmMap.removeLayer(FLOOD_DETAIL_LAYER);
  if(osmMap.getSource(FLOOD_DETAIL_SOURCE))osmMap.removeSource(FLOOD_DETAIL_SOURCE);
  floodDetailError=null;floodDetailSeen=false;floodDetailRetryCount=0;floodAppliedMode=null;
  for(let row=0;row<FLOOD_GRID_SIZE;row++){
    for(let col=0;col<FLOOD_GRID_SIZE;col++){
      const ids=floodTileIds(row,col);
      if(osmMap.getLayer(ids.layer))osmMap.removeLayer(ids.layer);
      if(osmMap.getSource(ids.source))osmMap.removeSource(ids.source);
    }
  }
}

async function updateFloodLayer(){
  const requestId=++floodRequestId;
  $('floodItem').classList.toggle('focusActive',floodEnabled);
  if(!floodEnabled){
    removeFloodLayer();
    setFloodStatus('Off');
    return true;
  }
  if(!osmMap||!osmStyleReady){
    setFloodStatus('Waiting for map…');
    return false;
  }
  setFloodStatus('Loading EA current flood risk map…');
  try{
    const urls=await getFloodImageUrls();
    if(requestId!==floodRequestId||!floodEnabled||!osmStyleReady)return false;
    for(let row=0;row<FLOOD_GRID_SIZE;row++){
      for(let col=0;col<FLOOD_GRID_SIZE;col++){
        const ids=floodTileIds(row,col);
        if(!osmMap.getSource(ids.source)){
          osmMap.addSource(ids.source,{
            type:'image',url:urls[row*FLOOD_GRID_SIZE+col],
            coordinates:drainageTileCoordinates(row,col,FLOOD_GRID_SIZE)
          });
        }
        if(!osmMap.getLayer(ids.layer)){
          osmMap.addLayer({
            id:ids.layer,type:'raster',source:ids.source,
            paint:{'raster-opacity':floodOpacity,'raster-fade-duration':120,'raster-resampling':floodDisplayMode}
          },getFirstSymbolLayerId());
        }else{
          osmMap.setPaintProperty(ids.layer,'raster-opacity',floodOpacity);
        }
      }
    }
    keepDrainageAboveTerrain();
    floodAppliedMode=null;
    syncFloodView();
    return true;
  }catch(err){
    if(requestId!==floodRequestId||!floodEnabled)return false;
    console.error('EA flood risk:',err);
    removeFloodLayer();
    setFloodStatus('Load failed: '+(err?.message||err),true);
    return false;
  }
}

function setNetworkStatus(message,error=false){
  $('networkStatus').textContent=message;
  $('networkStatus').className='layerStatus'+(error?' error':'');
}


function networkTileTemplate(){
  return 'drainage-network://tiles/'+formatNetworkThreshold(networkThreshold)+'/{z}/{x}/{y}';
}

function removeNetworkLayer(){
  if(osmMap?.getLayer(NETWORK_LAYER)){
    osmMap.setLayoutProperty(NETWORK_LAYER,'visibility','none');
  }
}

function updateNetworkLayer(){
  $('networkItem').classList.toggle('focusActive',networkEnabled);
  if(!networkEnabled){
    if(networkThresholdRaf){
      cancelAnimationFrame(networkThresholdRaf);
      networkThresholdRaf=0;
    }
    if(networkThresholdTimer){
      clearTimeout(networkThresholdTimer);
      networkThresholdTimer=null;
    }
    removeNetworkLayer();
    networkTileSeen=false;
    networkDisplayError=null;
    setNetworkStatus('Off');
    return;
  }
  if(!osmMap||!osmStyleReady){
    setNetworkStatus('Waiting for map…');
    return;
  }

  networkTileSeen=false;
  networkDisplayError=null;
  setNetworkStatus('Loading current view · ≥ '+formatNetworkThreshold(networkThreshold)+' km² drainage network…');

  const nw=networkCoordinates()[0],se=networkCoordinates()[2];
  const tiles=[networkTileTemplate()];
  const source=osmMap.getSource(NETWORK_SOURCE);
  if(source){
    source.setTiles(tiles);
  }else{
    osmMap.addSource(NETWORK_SOURCE,{
      type:'raster',
      tiles,
      tileSize:AREA_TILE_SIZE,
      minzoom:AREA_MIN_ZOOM,
      maxzoom:AREA_MAX_ZOOM,
      bounds:[nw[0],se[1],se[0],nw[1]],
      attribution:'Terrain-derived drainage network · Full upper Thames 50 m contributing-area raster'
    });
  }

  if(!osmMap.getLayer(NETWORK_LAYER)){
    osmMap.addLayer({
      id:NETWORK_LAYER,type:'raster',source:NETWORK_SOURCE,minzoom:AREA_MIN_ZOOM,
      paint:{
        'raster-opacity':networkOpacity,
        'raster-fade-duration':0,
        'raster-resampling':'linear'
      }
    },getFirstSymbolLayerId());
  }else{
    osmMap.setLayoutProperty(NETWORK_LAYER,'visibility','visible');
    osmMap.setPaintProperty(NETWORK_LAYER,'raster-opacity',networkOpacity);
  }
  keepDrainageAboveTerrain();
  syncNetworkStatus();
}

function scheduleLiveNetworkRefresh(){
  if(!networkEnabled||!osmMap||!osmStyleReady)return;

  // Live, but intentionally throttled. Replacing raster source tiles every animation
  // frame creates a backlog of obsolete worker jobs and makes the next pan/zoom feel
  // slow. ~70 ms still feels continuous while keeping the tile queue current.
  const now=performance.now();
  const wait=Math.max(0,70-(now-networkThresholdLastRefresh));

  if(networkThresholdTimer)return;
  networkThresholdTimer=setTimeout(()=>{
    networkThresholdTimer=null;

    if(networkThresholdRaf)return;
    networkThresholdRaf=requestAnimationFrame(()=>{
      networkThresholdRaf=0;
      networkThresholdLastRefresh=performance.now();
      updateNetworkLayer();
    });
  },wait);
}

function syncNetworkStatus(){
  if(!networkEnabled||!osmMap||!osmStyleReady)return;
  if(networkDisplayError){
    setNetworkStatus('Drainage network display failed: '+networkDisplayError,true);
    return;
  }
  const ready=networkTileSeen&&osmMap.getSource(NETWORK_SOURCE)&&osmMap.isSourceLoaded(NETWORK_SOURCE);
  setNetworkStatus(ready
    ?'Visible · dynamic threshold ≥ '+formatNetworkThreshold(networkThreshold)+' km² · 50 m source threshold + smoothed display'
    :'Loading current view · ≥ '+formatNetworkThreshold(networkThreshold)+' km² drainage network…');
}

function fitGoogleTo70(){
  if(!googleMap)return;
  googleMap.fitBounds(TERRAIN_BOUNDS,0);
}

function fitOsmTo70(){
  if(!osmMap)return;
  osmMap.fitBounds([
    [TERRAIN_BOUNDS.west,TERRAIN_BOUNDS.south],
    [TERRAIN_BOUNDS.east,TERRAIN_BOUNDS.north]
  ],{padding:20,duration:450});
}

function updateGoogleFocus70(){
  if(!googleMap || !window.google?.maps)return;

  if(!googleFocusCircle){
    googleFocusCircle=new google.maps.Circle({
      center:FOCUS70_CENTER,
      radius:FOCUS70_RADIUS_M,
      strokeColor:'#e5332a',
      strokeOpacity:0.95,
      strokeWeight:2,
      fillColor:'#e5332a',
      fillOpacity:0.08,
      clickable:false
    });
  }

  googleFocusCircle.setMap(focus70Enabled ? googleMap : null);

  googleMap.setOptions({
    restriction: focus70Enabled ? {
      latLngBounds:TERRAIN_BOUNDS,
      strictBounds:true
    } : null
  });

  if(focus70Enabled){
    fitGoogleTo70();
  }
}

function ensureOsmFocus70(){
  if(!osmMap || !osmStyleReady)return;

  const sourceId='focus70-circle-source';
  const fillId='focus70-circle-fill';
  const lineId='focus70-circle-line';

  if(!osmMap.getSource(sourceId)){
    osmMap.addSource(sourceId,{
      type:'geojson',
      data:makeCircleGeoJson(FOCUS70_CENTER,FOCUS70_RADIUS_M,720)   // 720 sides (was 180): within 0.7 m of the true circle, the polygon the planning layers were cut with
    });
  }

  if(!osmMap.getLayer(fillId)){
    osmMap.addLayer({
      id:fillId,
      type:'fill',
      source:sourceId,
      paint:{
        'fill-color':'#e5332a',
        'fill-opacity':0.05
      }
    });
  }

  if(!osmMap.getLayer(lineId)){
    osmMap.addLayer({
      id:lineId,
      type:'line',
      source:sourceId,
      paint:{
        'line-color':'#e5332a',
        'line-width':2.5,
        'line-opacity':0.95
      }
    });
  }

  // The 70 km study extent is always outlined in red (dashed) with a label;
  // the switch above additionally shades it and constrains navigation.
  if(!osmMap.getLayer('focus70-outline')){
    osmMap.addLayer({
      id:'focus70-outline',type:'line',source:sourceId,
      layout:{'line-join':'round'},
      paint:{'line-color':'#e5332a','line-width':['interpolate',['linear'],['zoom'],6,1.6,11,2.4],
        'line-dasharray':[3,2],'line-opacity':0.9}
    });
  }
  if(!osmMap.getSource('focus70-label-source')){
    const northLat=FOCUS70_CENTER.lat+FOCUS70_RADIUS_M/110540;
    osmMap.addSource('focus70-label-source',{type:'geojson',data:{type:'FeatureCollection',features:[
      {type:'Feature',properties:{name:'70 KM STUDY AREA'},geometry:{type:'Point',coordinates:[FOCUS70_CENTER.lng,northLat]}}
    ]}});
  }
  if(!osmMap.getLayer('focus70-label')){
    const cityLabel=(osmMap.getStyle()?.layers||[]).find(l=>l.type==='symbol'&&/label_city|place/i.test(l.id));
    osmMap.addLayer({
      id:'focus70-label',type:'symbol',source:'focus70-label-source',
      layout:{'text-field':['get','name'],'text-font':cityLabel?.layout?.['text-font']||['Noto Sans Regular'],
        'text-size':12,'text-letter-spacing':0.3,'text-offset':[0,-0.9],'text-max-width':30},
      paint:{'text-color':'#e5332a','text-halo-color':'rgba(255,255,255,0.9)','text-halo-width':1.5}
    });
  }

  osmFocusReady=true;
  const visibility=focus70Enabled?'visible':'none';
  osmMap.setLayoutProperty(fillId,'visibility',visibility);
  osmMap.setLayoutProperty(lineId,'visibility',visibility);

  if(focus70Enabled){
    osmMap.setMaxBounds([
      [TERRAIN_BOUNDS.west,TERRAIN_BOUNDS.south],
      [TERRAIN_BOUNDS.east,TERRAIN_BOUNDS.north]
    ]);
    fitOsmTo70();
  }else{
    osmMap.setMaxBounds(null);
  }
}

function updateFocus70(){
  updateGoogleFocus70();
  ensureOsmFocus70();

  if(focus70Enabled){
    say('70 km focus enabled; map constrained to study area with georeferenced terrain.');
  }else{
    say('70 km focus disabled; free navigation restored.');
  }

  terrainCameraStarted();
  setTimeout(terrainCameraEnded,180);
}

async function initGoogle(){
  if(googleMap)return;
  say('Loading Google Maps…');
  try{
    await loadGoogleScript();
    const {Map}=await google.maps.importLibrary('maps');
    googleMap=new Map($('googleMap'),{
      center:CENTER,zoom:ZOOM,
      mapTypeId:$('mapType').value,
      gestureHandling:'greedy',
      mapTypeControl:false,
      isFractionalZoomEnabled:true,
      streetViewControl:true,
      fullscreenControl:true,
      zoomControl:true,
      scaleControl:true
    });
    let countedGoogleMapLoad=false;
    googleMap.addListener('tilesloaded',()=>{
      if(countedGoogleMapLoad)return;
      countedGoogleMapLoad=true;
      recordGoogleMapLoad();
    });

    googleMap.addListener('mousemove',e=>{
      if(currentProvider!=='google')return;
      $('coords').textContent='Lat '+e.latLng.lat().toFixed(5)+
        ' / Lng '+e.latLng.lng().toFixed(5)+' / Zoom '+googleMap.getZoom();
    });
    googleMap.addListener('zoom_changed',()=>{
      if(currentProvider!=='google')return;
      const center=googleMap.getCenter(); if(!center)return;
      $('coords').textContent='Lat '+center.lat().toFixed(5)+
        ' / Lng '+center.lng().toFixed(5)+' / Zoom '+googleMap.getZoom();
      terrainCameraChanged();
    });

    googleMap.addListener('center_changed',()=>{
      if(currentProvider==='google'&&terrainEnabled)terrainCameraChanged();
    });

    googleMap.addListener('dragstart',()=>{
      if(currentProvider==='google')terrainCameraStarted();
    });

    googleMap.addListener('tilt_changed',()=>{
      if(currentProvider==='google'&&terrainEnabled)terrainCameraChanged();
    });

    googleMap.addListener('heading_changed',()=>{
      if(currentProvider==='google'&&terrainEnabled)terrainCameraChanged();
    });

    googleMap.addListener('idle',()=>{
      if(currentProvider==='google')terrainCameraEnded();
    });

    updateGoogleFocus70();
    updateTerrainLayers();
    if(currentProvider==='google')say('Google Maps loaded; coordinate-aligned mode enabled.');
  }catch(err){
    console.error(err);
    say('Google Maps unavailable; switching to OpenStreetMap…',true);
    setTimeout(()=>{
      const provider=$('provider');
      provider.value='osm';
      switchProvider('osm');
    },350);
  }
}

function isOsmBuildingRoadLayer(layer){
  if(!layer)return false;

  const id=String(layer.id||'').toLowerCase();
  const sourceLayer=String(layer['source-layer']||'').toLowerCase();

  // IMPORTANT: the "Hide OSM labels / POIs" switch must only affect the
  // OpenStreetMap/OpenFreeMap basemap annotation layers. Never hide our own
  // measurement/editing/analysis overlays (red boundary, anchors, edge lengths,
  // area tooltip support, flood/drainage/terrain layers, etc.).
  const protectedPrefixes=[
    'local-flood-',
    'analysis-',
    'drainage-',
    'terrain-',
    'ea-flood-',
    'focus70-'
  ];
  if(protectedPrefixes.some(prefix=>id.startsWith(prefix)))return false;

  // Local GeoJSON/canvas/raster analysis sources are also protected even if a future
  // layer id does not follow one of the prefixes above.
  const sourceId=String(layer.source||'').toLowerCase();
  if(
    sourceId.startsWith('local-flood-')||
    sourceId.startsWith('analysis-')||
    sourceId.startsWith('drainage-')||
    sourceId.startsWith('terrain-')||
    sourceId.startsWith('ea-flood-')
  )return false;

  // OpenFreeMap road/place/POI/transit annotation layers are symbol layers.
  if(layer.type==='symbol')return true;

  // Some basemap styles use circle layers for stop/POI markers.
  if(layer.type==='circle'){
    if(
      id.includes('poi')||id.includes('label')||id.includes('station')||
      id.includes('stop')||id.includes('transit')||id.includes('bus')||
      id.includes('subway')||id.includes('railway')||
      sourceLayer.includes('poi')||sourceLayer.includes('transit')
    )return true;
  }
  return false;
}

function syncOsmStructureVisibility(){
  if(!osmMap||!osmStyleReady)return;
  const layers=osmMap.getStyle()?.layers||[];
  let changed=false;
  for(const layer of layers){
    // Control only original Liberty label IDs; never hide custom analysis
    // text, contour labels or editable parcel measurements.
    if(!basemapThemeController?.isBaseLayer(layer.id)||
       !isOsmBuildingRoadLayer(layer))continue;
    if(!osmBaseLayerVisibility.has(layer.id))
      osmBaseLayerVisibility.set(layer.id,
        osmMap.getLayoutProperty(layer.id,'visibility')||'visible');
    const desired=osmStructuresHidden?'none':(osmBaseLayerVisibility.get(layer.id)||'visible');
    if(osmMap.getLayoutProperty(layer.id,'visibility')!==desired){
      osmMap.setLayoutProperty(layer.id,'visibility',desired);
      changed=true;
    }
  }
  // sourcedata fires repeatedly; don't re-style buildings on every tile.
  if(changed)syncCityView();
  syncRasterBasemap();
}

function streetRoadSourceId(){
  const sources=osmMap?.getStyle()?.sources||{};
  if(sources.openmaptiles)return 'openmaptiles';
  return Object.keys(sources).find(id=>sources[id].type==='vector'&&id!==CITY_BUILDINGS_SOURCE)
    ||CITY_BUILDINGS_SOURCE;
}

function syncStreetVehicleView(){
  streetTraffic?.syncView();
  urbanTrees?.syncView();
}

function setStreetVehiclesEnabled(on){
  streetVehiclesEnabled=Boolean(on);
  if(streetTraffic){streetTraffic.setEnabled(streetVehiclesEnabled);return;}
  if(!streetVehiclesEnabled||!osmMap||!osmStyleReady)return;
  streetTrafficLoading=streetTrafficLoading||import('./street_traffic.js?v='+APP_VERSION)
    .then(({createStreetTraffic})=>{
      streetTraffic=createStreetTraffic(osmMap,{
        roadSourceId:streetRoadSourceId(),
        beforeLayerId:getFirstSymbolLayerId
      });
      streetTraffic.setTint?.(atmosphereTints);
      streetTraffic.setEnabled(streetVehiclesEnabled);
    })
    .catch(error=>{
      streetTrafficLoading=null;
      console.error('Street traffic failed to load',error);
      say('Street vehicles could not load: '+(error.message||error),true);
    });
}

/* Flat basemap layers drawn after a fill-extrusion layer paint over it, so
   the bridge/viaduct lines (which the style puts after its first symbol
   layer) showed through buildings. Keep every flat basemap layer below the
   city buildings; labels stay on top. */
function sinkBasemapBelowCityBuildings(){
  if(!osmMap?.getLayer(CITY_BUILDINGS_DRIVER_LAYER))return;
  const layers=osmMap.getStyle()?.layers||[];
  const at=layers.findIndex(layer=>layer.id===CITY_BUILDINGS_DRIVER_LAYER);
  for(const layer of layers.slice(at+1)){
    if(layer.type==='symbol'||layer.type==='custom'||layer.type==='fill-extrusion')continue;
    if(layer.source!==streetRoadSourceId()&&layer.source!=='openmaptiles')continue;
    try{osmMap.moveLayer(layer.id,CITY_BUILDINGS_DRIVER_LAYER);}catch(error){}
  }
}

/*
 * v3.40.0 · the basemap's own tile address for the 3D buildings.
 * The Liberty basemap reads its tiles from a dated OpenFreeMap address (planet/<date>/…); the building source used
 * planet/latest/…, so the browser downloaded every tile the two share twice. Same address → one download, one cache.
 */
function cityBuildingTilesUrl(){
  if(CITY_BUILDING_LOD==='old'||!osmMap)return CITY_BUILDINGS_FALLBACK_TILES;
  try{
    for(const id of Object.keys(osmMap.getStyle()?.sources||{})){
      if(id===CITY_BUILDINGS_SOURCE)continue;
      const s=osmMap.getSource(id);
      if(s&&s.type==='vector'&&/tiles\.openfreemap\.org\/planet/.test(String(s.url||''))&&Array.isArray(s.tiles)&&s.tiles[0])return s.tiles[0];
    }
  }catch(error){}
  return CITY_BUILDINGS_FALLBACK_TILES;
}

function ensureCityBuildings(){
  if(!osmMap||!osmStyleReady)return;

  /*
   * OpenMapTiles building data is not available below z13:
   * - z13 = generalised building blocks
   * - z14 = detailed building footprints/heights
   *
   * A strongly pitched MapLibre camera can choose lower-resolution tiles for the
   * far part of the view. Reusing the basemap source therefore allows z12 tiles,
   * which contain no building layer and creates the blank "far city" band.
   *
   * Use a dedicated source clamped to z13-z14 so the far field can never fall
   * below the lowest building-data zoom.
   */
  if(!osmMap.getSource(CITY_BUILDINGS_SOURCE)){
    osmMap.addSource(CITY_BUILDINGS_SOURCE,{
      type:'vector',
      tiles:[cityBuildingTilesUrl()],
      minzoom:13,
      maxzoom:14,
      attribution:'OpenFreeMap © OpenMapTiles © OpenStreetMap contributors'
    });
  }

  const baseFilter=['!', ['boolean',['get','hide_3d'],false]];
  const height=['max',0,['to-number',['get','render_height'],5]];
  const base=['max',0,['to-number',['get','render_min_height'],0]];

  /*
   * One authoritative building source.
   *
   * Selection colour/visibility is NOT keyed by vector-tile feature id.
   * IDs can repeat between tiles, which previously turned unrelated buildings
   * orange outside the red polygon. The current polygon is applied spatially
   * in updateCityBuildingSelectionPaint().
   */
  const nativeHeight=height;
  const nativeBase=base;
  const nativeColour=cityBuildingColour();

  /*
   * Transparent driver layer: keep the dedicated building source requesting
   * z13/z14 tiles even while the visible native extrusion is hidden during the
   * local-flood replacement mode. Without this, querySourceFeatures() stops
   * receiving newly loaded distant tiles after the camera moves.
   */
  if(!osmMap.getLayer(CITY_BUILDINGS_DRIVER_LAYER)){
    osmMap.addLayer({
      id:CITY_BUILDINGS_DRIVER_LAYER,
      type:'fill',
      source:CITY_BUILDINGS_SOURCE,
      'source-layer':'building',
      minzoom:13,
      filter:baseFilter,
      layout:{visibility:'visible'},
      paint:{
        'fill-color':'#000000',
        'fill-opacity':0
      }
    },getFirstSymbolLayerId());
  }

  if(!osmMap.getLayer(CITY_BUILDINGS_LAYER)){
    osmMap.addLayer({
      id:CITY_BUILDINGS_LAYER,
      type:'fill-extrusion',
      source:CITY_BUILDINGS_SOURCE,
      'source-layer':'building',
      minzoom:13,
      filter:baseFilter,
      layout:{visibility:'none'},
      paint:{
        'fill-extrusion-color':nativeColour,
        'fill-extrusion-height':nativeHeight,
        'fill-extrusion-base':nativeBase,
        'fill-extrusion-opacity':1,
        'fill-extrusion-vertical-gradient':false
      }
    },getFirstSymbolLayerId());
  }

  if(!osmMap.getLayer(CITY_BUILDINGS_BACKGROUND_FILL)){
    osmMap.addLayer({
      id:CITY_BUILDINGS_BACKGROUND_FILL,
      type:'fill',
      source:CITY_BUILDINGS_SOURCE,
      'source-layer':'building',
      minzoom:13,
      filter:baseFilter,
      layout:{visibility:'none'},
      paint:{
        'fill-color':nativeColour,
        'fill-opacity':0.96
      }
    },getFirstSymbolLayerId());
  }



  sinkBasemapBelowCityBuildings();

  cityBuildingsShown=false;
  // New/rebuilt layers need their paint expressions applied exactly once.
  citySelectionPaintAppliedRing=null;
  updateCityBuildingSelectionPaint();
  tuneCityBuildingFarField();
}


function updateCityBuildingSelectionPaint(){
  if(!osmMap||!osmStyleReady)return;

  // Camera movement cannot change a geographic selection. Rebuilding the
  // complex distance-to-polygon paint expression every zoom/rotation frame
  // needlessly forces MapLibre to revalidate and repaint 3D buildings.
  if(
    citySelectionPaintAppliedRing===localFloodSelectionRing&&
    citySelectionPaintAppliedOverride===localFloodBuildingOverride
  )return;

  const height=['max',0,['to-number',['get','render_height'],5]];
  const base=['max',0,['to-number',['get','render_min_height'],0]];
  const ring=normaliseFloodSelectionRing(localFloodSelectionRing);

  let visibleHeight=height;
  let visibleBase=base;
  let fillOpacity=0.96;

  if(localFloodBuildingOverride&&ring.length>=4){
    const selectionGeometry={type:'Polygon',coordinates:[ring]};

    /*
     * IMPORTANT ARCHITECTURE:
     *
     * The streamed CITY_BUILDINGS_SOURCE is now background geometry only.
     * Every native feature that spatially TOUCHES the red polygon is suppressed
     * from this background layer, independent of vector-tile feature ids.
     *
     * local_flood_ui.js then rebuilds ALL site buildings from the same source:
     *   - fully inside -> orange/red clipped building
     *   - boundary crossing -> grey outside + orange/red inside
     *
     * This solves both failure modes caused by OSM/OpenMapTiles grouping:
     * 1) one source feature can contain multiple/large building parts;
     * 2) feature ids can repeat between vector tiles.
     *
     * Geometry clipping, not feature id or "within", decides what belongs to site.
     */
    const intersectsSelection=[
      '<=',
      ['distance',selectionGeometry],
      0.05
    ];

    visibleHeight=['case',intersectsSelection,0,height];
    visibleBase=['case',intersectsSelection,0,base];
    fillOpacity=['case',intersectsSelection,0,0.96];
  }

  if(osmMap.getLayer(CITY_BUILDINGS_LAYER)){
    osmMap.setPaintProperty(CITY_BUILDINGS_LAYER,'fill-extrusion-color',cityBuildingColour());
    osmMap.setPaintProperty(CITY_BUILDINGS_LAYER,'fill-extrusion-height',visibleHeight);
    osmMap.setPaintProperty(CITY_BUILDINGS_LAYER,'fill-extrusion-base',visibleBase);
  }

  if(osmMap.getLayer(CITY_BUILDINGS_BACKGROUND_FILL)){
    osmMap.setPaintProperty(CITY_BUILDINGS_BACKGROUND_FILL,'fill-color',cityBuildingColour());
    osmMap.setPaintProperty(CITY_BUILDINGS_BACKGROUND_FILL,'fill-opacity',fillOpacity);
  }

  citySelectionPaintAppliedRing=localFloodSelectionRing;
  citySelectionPaintAppliedOverride=localFloodBuildingOverride;
}

function tuneCityBuildingFarField(){
  if(!osmMap)return;
  const source=osmMap.getSource(CITY_BUILDINGS_SOURCE);
  if(!source)return;
  if(CITY_BUILDING_LOD!=='old'){
    // the basemap's address was not known yet when the source was made: switch once it is
    const url=cityBuildingTilesUrl();
    if(url!==CITY_BUILDINGS_FALLBACK_TILES&&Array.isArray(source.tiles)&&source.tiles[0]!==url&&typeof source.setTiles==='function'){
      try{source.setTiles([url]);}catch(error){console.warn('Unable to share the basemap tile address',error);}
    }
    /*
     * v3.40.0 · near tiles z14, far tiles z13.
     * One zoom level on screen (below) kept every tile at z14 out to the horizon: at a low, far-reaching camera that is
     * many detailed tiles, and the city filled in slowly. Now the number of levels follows the camera zoom so that the
     * far edge aims at about z12.8: MapLibre takes the first tile zoom at or above that, i.e. z13 (a quarter of the tiles,
     * generalised buildings). It never aims below z12 there, where this source has no tiles (the old blank far band).
     */
    const levels=Math.max(1,Math.min(6,1+Math.round((osmMap.getZoom()-CITY_BUILDING_LOD)*4)/4));
    const key=String(levels);
    if(source===lastCityBuildingLodSource&&key===lastCityBuildingLodKey)return;
    if(typeof osmMap.setSourceTileLodParams==='function'){
      try{
        osmMap.setSourceTileLodParams(levels,8,CITY_BUILDINGS_SOURCE);
        lastCityBuildingLodSource=source;lastCityBuildingLodKey=key;
      }catch(error){
        console.warn('Unable to tune building tile LOD',error);
      }
    }
    return;
  }
  if(source===lastCityBuildingLodSource)return;

  /*
   * DISPLAY STABILITY ONLY (v3.21.57)
   *
   * The building source contains reliable detailed geometry at z13/z14. At high pitch
   * MapLibre may normally decay vector-tile LOD toward the horizon; rotating the camera
   * changes that tile cover and can make some buildings appear/disappear even though the
   * selection geometry itself is unchanged.
   *
   * Keep ONE tile zoom level on screen for this source and allow a large high-pitch
   * tile budget. At the working zoom this keeps the city source on the detailed z14
   * coverage while bearing/pitch changes, instead of swapping to coarser building tiles.
   */
  /*
   * Far-field fix: maxZoomLevelsOnScreen was 3, which let distant tiles at high
   * pitch drop to z12/z11. This source has minzoom 13, so those tiles were simply
   * skipped and the far city rendered with no buildings. A single LOD level keeps
   * every tile on screen at z13–z14 (the only levels with building data); the
   * larger tile-count ratio gives MapLibre enough budget to cover the horizon.
   */
  if(typeof osmMap.setSourceTileLodParams==='function'){
    try{
      osmMap.setSourceTileLodParams(1,8,CITY_BUILDINGS_SOURCE);
      lastCityBuildingLodSource=source;
    }catch(error){
      console.warn('Unable to tune building tile LOD',error);
    }
  }
}


function isCompetingOsmBuildingExtrusionLayer(layer){
  if(!layer||layer.type!=='fill-extrusion')return false;

  const id=String(layer.id||'');
  if(id===CITY_BUILDINGS_LAYER)return false;
  if(id===CITY_BUILDINGS_DRIVER_LAYER)return false;
  if(id===CITY_BUILDINGS_BACKGROUND_FILL)return false;
  if(id.startsWith('local-flood-building-scene-'))return false;

  const sourceLayer=String(layer['source-layer']||'').toLowerCase();
  const lowerId=id.toLowerCase();
  return (
    sourceLayer==='building'||
    sourceLayer.includes('building')||
    lowerId.includes('building')
  );
}

function enforceSingleCityBuildingSource(){
  if(!osmMap||!osmStyleReady)return;
  const layers=osmMap.getStyle()?.layers||[];

  /*
   * Never render a second OpenFreeMap fill-extrusion building layer underneath
   * CITY_BUILDINGS_LAYER. Two independently tiled/generalised copies of the same
   * OSM building are what caused the orange/beige z-fighting and the repeated
   * "fix overlap -> lose neighbours" cycle.
   *
   * Roads, labels and 2D building fills remain untouched. Only competing 3D
   * building extrusions are disabled. CITY_BUILDINGS_LAYER is the sole 3D source.
   */
  for(const layer of layers){
    if(!isCompetingOsmBuildingExtrusionLayer(layer))continue;
    try{
      if((osmMap.getLayoutProperty(layer.id,'visibility')||'visible')!=='none'){
        osmMap.setLayoutProperty(layer.id,'visibility','none');
      }
    }catch(error){
      console.warn('Unable to disable competing 3D building layer',layer.id,error);
    }
  }
}

function setCityBuildingFloodSelection(selection=null){
  const active=Boolean(selection?.active);
  localFloodBuildingOverride=active;
  localFloodSelectionRing=active
    ?normaliseFloodSelectionRing(selection?.selectionRing||[])
    :[];

  // Selection ownership is purely spatial. No vector-tile feature IDs are retained.
  syncCityView();
}

function setCityIsolateMode(active){
  const next=Boolean(active);
  if(localFloodIsolateMode===next)return;
  localFloodIsolateMode=next;
  syncBuildingShadows();
  syncUrbanTrees();
  syncCityView();
}

function syncCityView(){
  if(!osmMap||!osmStyleReady)return;
  enforceSingleCityBuildingSource();
  const pitch=osmMap.getPitch(),is3D=pitch>.5;
  $('view2D').setAttribute('aria-pressed',String(!is3D));
  $('view3D').setAttribute('aria-pressed',String(is3D));

  const setVisibility=(id,visibility)=>{
    if(!osmMap.getLayer(id))return;
    if(osmMap.getLayoutProperty(id,'visibility')!==visibility){
      osmMap.setLayoutProperty(id,'visibility',visibility);
    }
  };

  setVisibility(CITY_BUILDINGS_DRIVER_LAYER,'visible');

  const visible3D=is3D&&!localFloodIsolateMode;
  setVisibility(CITY_BUILDINGS_LAYER,visible3D?'visible':'none');
  cityBuildingsShown=Boolean(osmMap.getLayer(CITY_BUILDINGS_LAYER))&&visible3D;

  // During isolated-site view, native/background city buildings remain hidden.
  const visible2D=!is3D&&!localFloodIsolateMode;
  setVisibility(CITY_BUILDINGS_BACKGROUND_FILL,visible2D?'visible':'none');

  updateCityBuildingSelectionPaint();

  // Vehicle layer order and 2D/3D visibility only depend on crossing pitch 0,
  // not on continuously changing bearing, zoom or map centre.
  if(lastCityVehicleView3D!==is3D){
    lastCityVehicleView3D=is3D;
    syncStreetVehicleView();
  }
}

function setCityView(is3D){
  if(!osmMap||!osmStyleReady)return;
  // While a parcel-only viewer is open, send toolbar camera actions to it.
  osmMap.easeTo(is3D?{
    zoom:Math.max(osmMap.getZoom(),15.5),pitch:55,
    bearing:osmMap.getBearing()||-20,duration:700
  }:{pitch:0,bearing:0,duration:450});
}

function setSearchStatus(message,error=false){
  $('placeSearchStatus').textContent=message;
  $('placeSearchStatus').className='searchStatus'+(error?' error':'');
}

function cancelPlaceSearch(){
  searchRequestId++;
  searchController?.abort();searchController=null;
  $('placeSearchButton').disabled=!osmStyleReady;
  $('placeSearchButton').textContent='Search';
}

function goToPlace(place,button){
  if(!osmMap||!osmStyleReady)return;
  if(focus70Enabled&&(place.lng<TERRAIN_BOUNDS.west||place.lng>TERRAIN_BOUNDS.east||
     place.lat<TERRAIN_BOUNDS.south||place.lat>TERRAIN_BOUNDS.north)){
    focus70Enabled=false;$('focus70Toggle').checked=false;
    $('focus70Toggle').closest('.layerItem')?.classList.toggle('focusActive',false);
    updateFocus70();
  }
  let zoom=16.5;
  if(place.bounds){
    const camera=osmMap.cameraForBounds(place.bounds,{padding:40,maxZoom:16.5});
    if(camera&&Number.isFinite(camera.zoom))zoom=camera.zoom;
  }
  osmMap.flyTo({center:[place.lng,place.lat],zoom,
    pitch:osmMap.getPitch(),bearing:osmMap.getBearing(),duration:1100});
  if(searchMarker)searchMarker.remove();
  searchMarker=new maplibregl.Marker({color:'#f97316'})
    .setLngLat([place.lng,place.lat])
    .setPopup(new maplibregl.Popup({offset:25}).setText(place.name)).addTo(osmMap);
  searchMarker.getElement().setAttribute('aria-label',place.name);
  for(const item of $('placeSearchResults').children)item.setAttribute('aria-pressed',String(item===button));
  setSearchStatus('Located: '+place.name);
  if(IS_PHONE)setSheet('folded');
  else if(window.innerWidth<=600){
    $('panel').classList.add('collapsed');$('collapse').textContent='+';
  }
}

async function runPlaceSearch(){
  if(!osmMap||!osmStyleReady){setSearchStatus('Map is loading; please wait.');return;}
  const query=$('placeSearchInput').value.trim();
  if(!query){setSearchStatus('Enter a place name, address or postcode.',true);return;}
  cancelPlaceSearch();
  const requestId=searchRequestId,controller=new AbortController();
  searchController=controller;
  $('placeSearchButton').disabled=true;$('placeSearchButton').textContent='Searching…';
  $('placeSearchResults').replaceChildren();setSearchStatus('Searching…');
  const timeout=setTimeout(()=>controller.abort(),18000);
  try{
    const bounds=osmMap.getBounds();
    const viewbox=[bounds.getWest(),bounds.getNorth(),bounds.getEast(),bounds.getSouth()];
    const places=await searchPlaces(query,{signal:controller.signal,viewbox});
    if(requestId!==searchRequestId)return;
    if(!places.length){setSearchStatus('No results; add a city, address or postcode.',true);return;}
    for(const place of places){
      const button=document.createElement('button');
      button.type='button';button.className='searchResult';button.textContent=place.name;
      button.setAttribute('aria-pressed','false');
      button.addEventListener('click',()=>goToPlace(place,button));
      $('placeSearchResults').appendChild(button);
    }
    goToPlace(places[0],$('placeSearchResults').firstElementChild);
  }catch(error){
    if(requestId!==searchRequestId)return;
    setSearchStatus(error.name==='AbortError'?'Search timed out; retry.':(error.message||'Search failed; retry.'),true);
  }finally{
    clearTimeout(timeout);
    if(requestId===searchRequestId){
      searchController=null;$('placeSearchButton').disabled=false;$('placeSearchButton').textContent='Search';
    }
  }
}

function initOSM(){
  if(osmMap)return;
  say('Loading OpenStreetMap…');
  const detailLoader=createFloodDetailLoader({
    center:FOCUS70_CENTER,radius:FOCUS70_RADIUS_M,bounds:DRAINAGE_3857,assetUrl
  });
  maplibregl.addProtocol('ea-flood',async(request,controller)=>{
    const result=await detailLoader(request,controller);
    if(floodEnabled)floodDetailSeen=true;
    return result;
  });
  const hydrologyLoader=createDrainageDisplayLoader({
    sourceUrl:new URL(assetUrl('assets/drainage_area/area_log16.webp'),location.href).href,
    width:DRAINAGE_3857.baseWidth50m,height:DRAINAGE_3857.baseHeight50m,
    center:FOCUS70_CENTER,radius:FOCUS70_RADIUS_M,bounds:DRAINAGE_3857
  });
  maplibregl.addProtocol('drainage-network',async(request,controller)=>{
    const result=await hydrologyLoader(request,controller);

    try{
      const match=String(request.url||'').match(
        /^drainage-network:\/\/tiles\/([0-9.]+)\//
      );
      const requestedThreshold=match?Number(match[1]):NaN;

      // Slider changes can leave older tile requests finishing later. Only the
      // current threshold is allowed to mark the layer as ready.
      if(
        Number.isFinite(requestedThreshold)&&
        Math.abs(requestedThreshold-networkThreshold)<0.0005
      ){
        networkTileSeen=true;
        queueMicrotask(syncNetworkStatus);
      }
    }catch(error){}

    return result;
  });
  const terrainLoader=createTerrainLocalLoader({
    imageUrl:new URL(assetUrl('assets/terrain/overview.webp'),location.href).href,
    bounds:DRAINAGE_3857,
    tileSize:TERRAIN_TILE_SIZE,
    center:FOCUS70_CENTER,radius:FOCUS70_RADIUS_M   // v3.44.0: cut to the study circle, as flood and drainage are
  });
  maplibregl.addProtocol('ea-terrain-local',terrainLoader);

  // Primary basemap: Esri Canvas raster tiles, which need no API key.
  //
  // The Liberty vector style is the better basemap and restyles properly,
  // but loading it froze the renderer on this page, leaving the map blank.
  // CARTO's raster basemaps, used before this, now require a key and answer
  // keyless requests with a watermark image. Esri's Canvas services are
  // public, and they separate base from labels in both light and dark, which
  // is what the Map style and Hide OSM labels controls switch between.
  //
  // Esri orders its tile path row-before-column, so the template is
  // {z}/{y}/{x} rather than the usual {z}/{x}/{y}.
  const ESRI_CANVAS='https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
  const esriRaster=name=>({
    type:'raster',tileSize:256,maxzoom:16,
    tiles:[ESRI_CANVAS+name+'/MapServer/tile/{z}/{y}/{x}'],
    attribution:'Esri, HERE, Garmin, \u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  // The OpenFreeMap Liberty vector style is the default basemap: true
  // per-layer restyling, precise label hiding, road geometry and sharp
  // labels under tilt. Confirmed on the owner's machine and in isolated tests
  // (~1.2 s load, no main-thread stall, including 3D city mode).
  // ?basemap=raster forces the keyless Esri raster basemap instead, which is
  // also the automatic fallback if Liberty does not load within 12 s.
  const USE_VECTOR_BASEMAP=new URLSearchParams(location.search).get('basemap')!=='raster';
  const ESRI_RASTER_STYLE={
    version:8,
    sources:{
      'osm-light-base':esriRaster('World_Light_Gray_Base'),
      'osm-light-labels':esriRaster('World_Light_Gray_Reference'),
      'osm-dark-base':esriRaster('World_Dark_Gray_Base'),
      'osm-dark-labels':esriRaster('World_Dark_Gray_Reference'),
      // Raster carries no geometry, so street vehicles still need road
      // centrelines. One zoom level of transportation tiles, drawn almost
      // invisibly, supplies them without loading a whole vector basemap.
      'osm-transport-vector':{
        type:'vector',minzoom:14,maxzoom:14,
        tiles:['https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf'],
        attribution:'\u00a9 OpenFreeMap \u00a9 OpenStreetMap contributors'
      }
    },
    layers:[
      {id:'osm-light-base-layer',type:'raster',source:'osm-light-base',layout:{visibility:'visible'}},
      {id:'osm-dark-base-layer',type:'raster',source:'osm-dark-base',layout:{visibility:'none'}},
      {id:'osm-transportation-vector-layer',type:'line',source:'osm-transport-vector',
        'source-layer':'transportation',minzoom:14,
        paint:{'line-color':'#777777','line-opacity':0.01,'line-width':1}},
      {id:'osm-light-labels-layer',type:'raster',source:'osm-light-labels',layout:{visibility:'visible'}},
      {id:'osm-dark-labels-layer',type:'raster',source:'osm-dark-labels',layout:{visibility:'none'}}
    ]
  };
  const OSM_PRIMARY_STYLE=USE_VECTOR_BASEMAP
    ?'https://tiles.openfreemap.org/styles/liberty'
    :ESRI_RASTER_STYLE;
  syncRasterBasemap=()=>{
    if(!osmMap||!osmStyleReady)return;
    const dark=basemapTheme==='dark',labels=!osmStructuresHidden;
    for(const [id,show] of [
      ['osm-light-base-layer',!dark],['osm-dark-base-layer',dark],
      ['osm-light-labels-layer',!dark&&labels],['osm-dark-labels-layer',dark&&labels]
    ]){
      if(!osmMap.getLayer(id))continue;
      const vis=show?'visible':'none';
      if(osmMap.getLayoutProperty(id,'visibility')!==vis)
        osmMap.setLayoutProperty(id,'visibility',vis);
    }
  };
  // Emergency basemap when Liberty fails to start: the same keyless Esri
  // raster style, so the Map style and label controls keep working.
  const OSM_FALLBACK_STYLE=ESRI_RASTER_STYLE;
  let rasterFallbackActive=false;
  let startupWatchdog=null;
  let buildingLoadErrorShown=false;
  const showRecovery=()=>document.getElementById('osmRecovery')?.classList.add('visible');
  const recoveryTimer=setTimeout(()=>{if(!osmStyleReady)showRecovery();},7000);
  const activateRasterFallback=(reason)=>{
    if(!osmMap||osmStyleReady||rasterFallbackActive)return;
    rasterFallbackActive=true;
    console.warn('OpenFreeMap startup failed; switching to OSM raster.',reason);
    say('OpenFreeMap did not respond. Switching to the Esri raster basemap; 3D buildings may remain unavailable.',true);
    try {
      osmMap.setStyle(OSM_FALLBACK_STYLE);
    } catch(error) {
      console.error('Unable to activate OSM raster fallback',error);
      say('OSM basemap failed to start: '+(error.message||error),true);
    }
  };

  osmMap=new maplibregl.Map({
    ...(IS_PHONE?{pixelRatio:Math.min(window.devicePixelRatio||1,2)}:{}),
    container:'osmMap',
    style:OSM_PRIMARY_STYLE,
    center:[CENTER.lng,CENTER.lat],
    zoom:ZOOM,
    pitch:0,
    bearing:0,
    maxPitch:70,
    dragRotate:true,
    pitchWithRotate:true,
    touchPitch:true,

    // Default bounded MapLibre tile cache prevents excessive browser/GPU memory use.
    canvasContextAttributes:{antialias:true},
    attributionControl:true
  });

  // A failed style fetch can otherwise leave this page on a blank map forever.
  startupWatchdog=setTimeout(()=>activateRasterFallback('12-second initial style timeout'),12000);
  osmMap.on('error',event=>{
    if(!osmStyleReady){
      const message=String(event.error?.message||'Map style or tile request failed');
      if(rasterFallbackActive){
        say('OpenStreetMap fallback could not load: '+message,true);
      }else{
        console.warn('OpenFreeMap startup error; fallback pending:',message);
        say('OpenFreeMap loading issue; trying the fallback if needed: '+message,true);
      }
    }
  });

  // MapLibre 6.13 can restore a blank map if WebGL is lost before style load.
  osmMap.getCanvas().addEventListener('webglcontextrestored',()=>{
    if(!osmStyleReady){
      try{osmMap.setStyle(OSM_FALLBACK_STYLE);}
      catch(error){console.error('WebGL recovery failed',error);}
    }
  });
  osmMap.addControl(new maplibregl.NavigationControl({showCompass:true,visualizePitch:true}),'top-right');
  osmMap.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');

  osmMap.on('sourcedata',e=>{
    if(e.sourceId===TERRAIN_TILE_SOURCE)syncTerrainView();
    if(e.sourceId===NETWORK_SOURCE)syncNetworkStatus();
    if(e.sourceId===CITY_BUILDINGS_SOURCE){
      tuneCityBuildingFarField();
      syncCityView();
      osmMap.triggerRepaint();
    }
    if(osmStructuresHidden)syncOsmStructureVisibility();
  });
  osmMap.on('error',e=>{
    if(e.sourceId===NETWORK_SOURCE&&networkEnabled){
      networkDisplayError=e.error?.message||'Load failed';
      syncNetworkStatus();
    }
    if(e.sourceId===TERRAIN_TILE_SOURCE&&terrainEnabled){
      terrainLocalError=e.error?.message||'Local terrain tile loading failed';
      syncTerrainView();
    }
  });
  osmMap.on('load',()=>{
    if(startupWatchdog){clearTimeout(startupWatchdog);startupWatchdog=null;}
    clearTimeout(recoveryTimer);
    osmStyleReady=true;
    document.getElementById('osmRecovery')?.classList.remove('visible');
    // Capture the pristine OpenFreeMap layer IDs before project overlays.
    basemapThemeController=createBasemapThemeController(osmMap);
    basemapThemeController.capture();
    basemapThemeController.apply(basemapTheme);
    syncRasterBasemap();
    ensureCityBuildings();
    tuneCityBuildingFarField();
    syncCityView();
    initAtmosphere();
    initUrbanTrees();
    ensureOverviewLayers();
    initPlanningLayers();
    // The site tools (selection → Tensor Studio) load after the basemap; a failure never blocks the map.
    $('siteDraw').disabled=true;
    import('./tensor_site_ui.js?v=3.46.3')
      .then(({createTensorSiteUI})=>{
        if(siteUI)return;
        siteUI=createTensorSiteUI({map:osmMap,maplibregl,assetUrl,demBounds:DRAINAGE_3857,demWidth:DRAINAGE_3857.baseWidth50m,demHeight:DRAINAGE_3857.baseHeight50m,say,getMapTheme:()=>basemapTheme});
        $('siteDraw').disabled=false;
      })
      .catch(error=>{
        console.error('Site tools failed to load',error);
        say('OSM map is available, but the site tools could not load: '+(error.message||error),true);
      });
    $('osmStructureToggle').checked=osmStructuresHidden;
    $('osmStructureToggle').disabled=false;
    $('view2D').disabled=false;$('view3D').disabled=false;
    $('streetVehicleToggle').disabled=false;
    $('placeSearchButton').disabled=false;
    for(const id of ['terrainToggle','contourToggle','floodToggle','networkToggle','focus70Toggle','osmStructureToggle',
      'reliefToggle','relief3dToggle','greenBeltToggle','aonbToggle','railToggle','highSpeedToggle']){
      $(id).disabled=false;
    }
    syncOsmStructureVisibility();
    ensureOsmFocus70();
    updateNetworkLayer();
    updateFloodLayer();
    markIntroReady();
    if(currentProvider==='osm'){
      updateTerrainLayers();
      say(rasterFallbackActive
        ?'Esri raster fallback active. OpenFreeMap 3D buildings may be unavailable.'
        :'Map connected. Switch to 3D or search for a place; enable analysis layers as needed.',
        rasterFallbackActive);
    }
  });
  osmMap.on('mousemove',e=>{
    if(currentProvider!=='osm')return;
    $('coords').textContent='Lat '+e.lngLat.lat.toFixed(5)+
      ' / Lng '+e.lngLat.lng.toFixed(5)+' / Zoom '+osmMap.getZoom().toFixed(1);
  });

  osmMap.on('movestart',()=>{
    if(currentProvider==='osm')terrainCameraStarted();
  });

  osmMap.on('zoom',()=>{
    tuneCityBuildingFarField();
    syncCityView();
    if(currentProvider==='osm')terrainCameraChanged();
    syncFloodView();
  });

  osmMap.on('sourcedata',e=>{
    if(e.sourceId===FLOOD_DETAIL_SOURCE)syncFloodView();
  });

  osmMap.on('move',()=>{
    if(currentProvider==='osm'&&terrainEnabled)terrainCameraChanged();
  });

  osmMap.on('pitch',()=>{
    tuneCityBuildingFarField();
    syncCityView();
    if(currentProvider==='osm'&&terrainEnabled)terrainCameraChanged();
  });

  osmMap.on('rotate',()=>{
    tuneCityBuildingFarField();
    syncCityView();
    if(currentProvider==='osm'&&terrainEnabled)terrainCameraChanged();
  });

  osmMap.on('moveend',()=>{
    if(currentProvider==='osm')terrainCameraEnded();
    tuneCityBuildingFarField();
    syncCityView();
    syncFloodView();
    if(contourEnabled)refreshContourLayer(120);
  });
  osmMap.on('error',e=>{
    if(e.sourceId===FLOOD_DETAIL_SOURCE){handleFloodDetailError(e.error);return;}
    if(e.sourceId===CITY_BUILDINGS_SOURCE&&!buildingLoadErrorShown){
      buildingLoadErrorShown=true;
      console.warn('OSM 3D building tiles could not load',e.error||e);
      if(osmMap.getPitch()>.5){
        say('3D building tiles are unavailable from OpenFreeMap. The basemap can still be used.',true);
      }
    }
    console.error(e.error||e);
  });
}

function captureCurrentView(){
  if(currentProvider==='google' && googleMap){
    const center=googleMap.getCenter();
    const zoom=googleMap.getZoom();
    if(center && Number.isFinite(zoom)){
      sharedView={
        lat:center.lat(),
        lng:center.lng(),
        zoom,
        source:'google'
      };
    }
  }else if(currentProvider==='osm' && osmMap){
    const center=osmMap.getCenter();
    const zoom=osmMap.getZoom();
    if(center && Number.isFinite(zoom)){
      sharedView={
        lat:center.lat,
        lng:center.lng,
        zoom,
        source:'osm'
      };
    }
  }
}

function targetZoomFor(provider){
  // Google uses a 256 px world at zoom 0; MapLibre uses 512 px.
  // Therefore the same ground resolution is Google zoom = MapLibre zoom + 1.
  if(sharedView.source==='google' && provider==='osm'){
    return sharedView.zoom - 1;
  }
  if(sharedView.source==='osm' && provider==='google'){
    return sharedView.zoom + 1;
  }
  return sharedView.zoom;
}

function applySharedView(provider){
  const center={lat:sharedView.lat,lng:sharedView.lng};
  const targetZoom=targetZoomFor(provider);

  if(provider==='google' && googleMap){
    googleMap.setCenter(center);
    googleMap.setZoom(targetZoom);

    // Re-assert exact center after Google finishes its camera update.
    google.maps.event.addListenerOnce(googleMap,'idle',()=>{
      const now=googleMap.getCenter();
      if(!now) return;
      const dLat=Math.abs(now.lat()-center.lat);
      const dLng=Math.abs(now.lng()-center.lng);
      if(dLat>1e-9 || dLng>1e-9){
        googleMap.setCenter(center);
      }
    });
  }else if(provider==='osm' && osmMap){
    osmMap.jumpTo({
      center:[center.lng,center.lat],
      zoom:targetZoom,
      pitch:0,
      bearing:0
    });

    // Re-assert exact center after resize/render.
    requestAnimationFrame(()=>{
      if(!osmMap) return;
      osmMap.setCenter([center.lng,center.lat]);
      osmMap.setZoom(targetZoom);
    });
  }
}

async function switchProvider(provider){
  if(provider==='google'){
    console.info('Google Maps is disabled during app development.');
    provider='osm';
  }
  if(provider===currentProvider){
    syncBadge();
    return;
  }

  captureCurrentView();
  terrainCameraStarted();
  currentProvider=provider;
  if(provider==='google'){
    $('googleMap').style.display='block';
    $('osmMap').style.display='none';
    syncBadge();
    await initGoogle();
    if(googleMap){
      applySharedView('google');
      setTimeout(()=>{
        google.maps.event.trigger(googleMap,'resize');
        applySharedView('google');
      },50);
      updateGoogleFocus70();
        setTimeout(terrainCameraEnded,150);
      say('Google Maps mode; aligning terrain to its true coordinates.');
    }
  }else{
    $('googleMap').style.display='none';
    $('osmMap').style.display='block';
    syncBadge();
    initOSM();
    if(osmMap){
      applySharedView('osm');
      setTimeout(()=>{
        osmMap.resize();
        applySharedView('osm');
      },100);
    }
    if(osmMap&&osmMap.loaded()){
      ensureOsmFocus70();
      setTimeout(terrainCameraEnded,170);
      say('OpenStreetMap mode; aligning terrain to its true coordinates.');
    }
  }
}

$('provider').addEventListener('change',e=>{ switchProvider(e.target.value); });
$('view2D').addEventListener('click',()=>setCityView(false));
$('view3D').addEventListener('click',()=>setCityView(true));

$('streetVehicleToggle').addEventListener('change',event=>{
  setStreetVehiclesEnabled(event.target.checked);
});
$('urbanTreeToggle').addEventListener('change',event=>{
  urbanTreesWanted=Boolean(event.target.checked);
  syncUrbanTrees();
});
$('buildingShadowToggle').addEventListener('change',event=>{
  buildingShadowsWanted=Boolean(event.target.checked);
  syncBuildingShadows();
});
$('placeSearchForm').addEventListener('submit',e=>{e.preventDefault();runPlaceSearch();});
$('placeSearchInput').addEventListener('input',()=>{
  cancelPlaceSearch();$('placeSearchResults').replaceChildren();setSearchStatus('');
});

$('mapType').addEventListener('change',e=>{
  if(googleMap)googleMap.setMapTypeId(e.target.value);
});

$('resetApiStats').addEventListener('click',()=>{
  if(confirm('Clear Google API load statistics stored in this browser?')){
    resetApiStats();
  }
});

renderApiStats();

/* ---------- planning layers (v3.44.0): height colors, Green Belt, AONB, rail, HS1/HS2 ---------- */
const PLANNING_STATUS={
  relief:{el:'reliefStatus',loading:'Loading height tiles…',
    loaded:'Visible · colored by height · cut to the 70 km circle',
    error:'Height tiles failed to load; check the connection and retry'},
  greenBelt:{el:'greenBeltStatus',loading:'Loading boundary data…',
    loaded:'Visible · 5,065 km² · all inside the 70 km circle',
    error:'Boundary data failed to load; refresh and retry'},
  aonb:{el:'aonbStatus',loading:'Loading boundary data…',
    loaded:'Visible · five landscapes · cut to the 70 km circle',
    error:'Boundary data failed to load; refresh and retry'},
  rail:{el:'railStatus',loading:'Loading rail lines…',
    loaded:'Visible · cut to the 70 km circle · basemap railways stay underneath',
    error:'Rail lines failed to load; refresh and retry'},
  relief3d:{el:'relief3dStatus',loading:'Loading height tiles…',
    loaded:'Visible · tilt the map to see it · trees, vehicles and building shadows are off meanwhile',
    error:'Height tiles failed to load; check the connection and retry'},
  highSpeed:{el:'highSpeedStatus',loading:'Loading rail lines…',
    loaded:'Visible · whole lines, also outside the 70 km circle',
    error:'Rail lines failed to load; refresh and retry'}
};
function showPlanningStatus(group,status){
  const entry=PLANNING_STATUS[group],el=entry&&$(entry.el);
  if(!el)return;
  const text=status==='off'?'Off':entry[status]||'';
  if(el.textContent!==text)el.textContent=text;
  el.className='layerStatus'+(status==='error'?' error':'');
}
function drawReliefKey(){
  const ramp=RELIEF_RAMPS[$('reliefRamp').value]||RELIEF_RAMPS.classic,at=reliefStops(Number($('reliefTop').value));
  $('reliefBar').style.background='linear-gradient(to right,'+ramp.map((c,i)=>c+' '+(i*5)+'% '+((i+1)*5)+'%').join(',')+')';
  $('reliefTicks').replaceChildren(...[0,5,10,15,19].map(i=>{
    const tick=document.createElement('span');tick.textContent=Math.round(at[i])+' m';return tick;
  }));
}
function syncRailKey(){
  const key=$('railNationalKey');
  if(key)key.style.setProperty('--swatch',basemapTheme==='dark'?'#c9c9c9':'#1c1c1e');
}
let heightPopup=null;
function initPlanningLayers(){
  if(planning||!osmMap)return;
  planning=createPlanningLayers({map:osmMap,maplibregl,assetUrl,center:FOCUS70_CENTER,radius:FOCUS70_RADIUS_M,
    getTheme:()=>basemapTheme,onStatus:showPlanningStatus,reorder:keepDrainageAboveTerrain});
  syncRailKey();
  // The height under a click, while the height colors are on (not while a site boundary is being drawn).
  osmMap.on('click',async event=>{
    if(!planning.state.relief.on||currentProvider!=='osm'||siteUI?.busy||!planning.insideCircle(event.lngLat))return;
    try{
      const height=await planning.heightAt(event.lngLat);
      if(!planning.state.relief.on)return;
      heightPopup?.remove();
      heightPopup=new maplibregl.Popup({closeButton:false,offset:8,className:'contour-elevation-popup'})
        .setLngLat(event.lngLat).setText('Height '+(Math.round(height*10)/10)+' m').addTo(osmMap);
    }catch(error){console.warn('Height not read',error);}
  });
}
const percent=value=>Math.round(Number(value)*100)+'%';
$('reliefToggle').addEventListener('change',e=>{
  planning?.set('relief',{on:e.target.checked});
  if(!e.target.checked){heightPopup?.remove();heightPopup=null;}
});
$('reliefOpacity').addEventListener('input',e=>{
  $('reliefOpacityValue').textContent=percent(e.target.value);
  planning?.set('relief',{opacity:Number(e.target.value)});
});
// The top height, the ramp and the shade are part of the tile address: new tiles are made when the slider is let go.
$('reliefTop').addEventListener('input',e=>{$('reliefTopValue').textContent=e.target.value+' m';drawReliefKey();});
$('reliefTop').addEventListener('change',e=>planning?.set('relief',{top:Number(e.target.value)}));
$('reliefRamp').addEventListener('change',e=>{drawReliefKey();planning?.set('relief',{ramp:e.target.value});});
$('reliefShade').addEventListener('input',e=>{$('reliefShadeValue').textContent=percent(e.target.value);});
$('reliefShade').addEventListener('change',e=>planning?.set('relief',{shade:Number(e.target.value)}));
drawReliefKey();

// v3.46.3: 3D relief. Trees, street vehicles and building shadows are drawn as their own objects on flat ground and would be buried
// by the risen ground, so they are switched off while it is on and come back, as they were, when it goes off.
const RELIEF3D_HOLDS=['urbanTreeToggle','streetVehicleToggle','buildingShadowToggle'];
let relief3dHeld=null;
function holdForRelief3d(on){
  if(on&&!relief3dHeld){
    relief3dHeld={};
    for(const id of RELIEF3D_HOLDS){
      const el=$(id);
      relief3dHeld[id]=el.checked;
      if(el.checked){el.checked=false;el.dispatchEvent(new Event('change'));}
      el.closest('label')?.classList.add('heldOff');
    }
  }else if(!on&&relief3dHeld){
    for(const id of RELIEF3D_HOLDS){
      const el=$(id);
      el.closest('label')?.classList.remove('heldOff');
      if(relief3dHeld[id]&&!el.checked){el.checked=true;el.dispatchEvent(new Event('change'));}
    }
    relief3dHeld=null;
  }
}
// switching one of them on by hand while the relief is on switches it straight back off
for(const id of RELIEF3D_HOLDS){
  $(id).addEventListener('change',event=>{
    if(!relief3dHeld||!event.isTrusted||!event.target.checked)return;
    event.target.checked=false;event.target.dispatchEvent(new Event('change'));
    $('status').textContent='Trees, street vehicles and building shadows are off while 3D relief is on.';
  });
}
$('relief3dToggle').addEventListener('change',e=>{
  const on=e.target.checked;
  holdForRelief3d(on);
  planning?.set('relief3d',{on});
  // the relief only shows in a tilted view: a flat map is tilted once
  if(on&&osmMap&&osmMap.getPitch()<15)osmMap.easeTo({pitch:55,duration:800});
});
$('relief3dExaggeration').addEventListener('input',e=>{
  $('relief3dExaggerationValue').textContent='×'+Number(e.target.value);
  planning?.set('relief3d',{exaggeration:Number(e.target.value)});
});

for(const [group,id] of [['greenBelt','greenBelt'],['aonb','aonb']]){
  $(id+'Toggle').addEventListener('change',e=>planning?.set(group,{on:e.target.checked}));
  $(id+'Fill').addEventListener('input',e=>{
    $(id+'FillValue').textContent=percent(e.target.value);
    planning?.set(group,{fill:Number(e.target.value)});
  });
  $(id+'Width').addEventListener('input',e=>{
    $(id+'WidthValue').textContent=percent(e.target.value);
    planning?.set(group,{width:Number(e.target.value)});
  });
}

$('railToggle').addEventListener('change',e=>planning?.set('rail',{on:e.target.checked}));
for(const box of document.querySelectorAll('#railItem [data-rail]')){
  box.addEventListener('change',()=>planning?.set('rail',{kinds:{[box.dataset.rail]:box.checked}}));
}
$('railMode').addEventListener('change',e=>{
  $('railSpeedKey').hidden=e.target.value!=='speed';
  $('railLegend').hidden=e.target.value==='shades';
  planning?.set('rail',{mode:e.target.value});
});
$('railWidth').addEventListener('input',e=>{
  $('railWidthValue').textContent=percent(e.target.value);
  planning?.set('rail',{width:Number(e.target.value)});
});
$('railSpeedBar').style.background='linear-gradient(to right,'+SPEED_STOPS.map(([,c],i)=>c+' '+(i*20)+'%').join(',')+')';
$('railSpeedTicks').replaceChildren(...SPEED_STOPS.map(([mph])=>{
  const tick=document.createElement('span');tick.textContent=mph;return tick;
}));

$('highSpeedToggle').addEventListener('change',e=>planning?.set('highSpeed',{on:e.target.checked}));
$('hs1Toggle').addEventListener('change',e=>planning?.set('highSpeed',{hs1:e.target.checked}));
$('hs2Toggle').addEventListener('change',e=>planning?.set('highSpeed',{hs2:e.target.checked}));
$('highSpeedColour').addEventListener('input',e=>{
  for(const id of ['highSpeedKey','highSpeedTunnelKey'])$(id).style.setProperty('--swatch',e.target.value);
  planning?.set('highSpeed',{colour:e.target.value});
});


$('terrainToggle').addEventListener('change',e=>{
  terrainEnabled=e.target.checked;
  updateTerrainLayers();
});

$('terrainOpacity').addEventListener('input',e=>{
  terrainOpacity=Number(e.target.value);
  $('terrainOpacityValue').textContent=Math.round(terrainOpacity*100)+'%';
  applyTerrainOpacity();
});

$('contourToggle').addEventListener('change',e=>{
  contourEnabled=e.target.checked;
  updateContourLayer();
});

$('contourOpacity').addEventListener('input',e=>{
  contourOpacity=Number(e.target.value);
  $('contourOpacityValue').textContent=Math.round(contourOpacity*100)+'%';
  applyContourOpacity();
});

$('contourInterval').addEventListener('change',e=>{
  const next=Number(e.target.value);
  if(![1,2,5,10,25,50,100].includes(next))return;

  contourIntervalM=next;

  const subtitle=$('contourSubtitle');
  if(subtitle){
    subtitle.textContent=
      'Real elevation data · '+contourIntervalM+
      ' m Contour interval · Ordnance Survey OpenData';
  }

  if(!contourEnabled){
    $('contourStatus').textContent=
      'Set · '+contourIntervalM+' m Contour interval';
    $('contourStatus').className='layerStatus';
    return;
  }

  $('contourStatus').textContent=
    'Generating '+contourIntervalM+' m contours…';
  $('contourStatus').className='layerStatus';
  refreshContourLayer(0);
});

$('floodDisplayMode').addEventListener('change',e=>{
  floodDisplayMode=e.target.value==='linear'?'linear':'nearest';
  for(let row=0;row<FLOOD_GRID_SIZE;row++)for(let col=0;col<FLOOD_GRID_SIZE;col++){
    const id=floodTileIds(row,col).layer;
    if(osmMap?.getLayer(id))osmMap.setPaintProperty(id,'raster-resampling',floodDisplayMode);
  }
  if(osmMap?.getLayer(FLOOD_DETAIL_LAYER))osmMap.setPaintProperty(FLOOD_DETAIL_LAYER,'raster-resampling',floodDisplayMode);
  if(floodEnabled)setFloodStatus(floodDisplayMode==='nearest'
    ?'Using original discrete classes (nearest); no visual edge smoothing'
    :'Using smoothed transitions; blended colors are not new official risk classes');
});

$('floodRiskSource').addEventListener('change',e=>{
  floodRiskSource=e.target.value;
  floodRequestId++;
  removeFloodLayer();
  if(floodEnabled)updateFloodLayer();
  else setFloodStatus('Selected '+e.target.options[e.target.selectedIndex].text+' · layer disabled');
});

$('floodToggle').addEventListener('change',e=>{
  floodEnabled=e.target.checked;
  updateFloodLayer();
});

$('floodOpacity').addEventListener('input',e=>{
  floodOpacity=Number(e.target.value);
  $('floodOpacityValue').textContent=Math.round(floodOpacity*100)+'%';
  syncFloodView();
});

$('networkToggle').addEventListener('change',e=>{
  networkEnabled=e.target.checked;
  updateNetworkLayer();
});

$('networkOpacity').addEventListener('input',e=>{
  networkOpacity=Number(e.target.value);
  $('networkOpacityValue').textContent=Math.round(networkOpacity*100)+'%';
  if(osmMap?.getLayer(NETWORK_LAYER)){
    osmMap.setPaintProperty(NETWORK_LAYER,'raster-opacity',networkOpacity);
  }
});

$('osmVisualStyle').addEventListener('change',e=>{
  setBasemapTheme(e.target.value);
});
for(const tile of document.querySelectorAll('#displayPanel .dpTheme')){
  tile.addEventListener('click',()=>setBasemapTheme(tile.dataset.theme));
}
syncThemeTiles(basemapTheme);
$('osmStructureToggle').addEventListener('change',e=>{
  osmStructuresHidden=e.target.checked;
  syncOsmStructureVisibility();
});

function setNetworkThresholdValue(value,syncInput=true){
  if(!Number.isFinite(value))return false;
  const next=Number(Math.max(0,Math.min(50,value)).toFixed(3));
  const changed=networkThreshold!==next;
  networkThreshold=next;
  $('networkThreshold').value=formatNetworkThreshold(next);
  if(syncInput)$('networkThresholdInput').value=formatNetworkThreshold(next);
  if(changed)scheduleLiveNetworkRefresh();
  return changed;
}

function commitNetworkThreshold(){
  if(!networkEnabled)return;
  if(networkThresholdRaf){
    cancelAnimationFrame(networkThresholdRaf);
    networkThresholdRaf=0;
  }
  if(networkThresholdTimer){
    clearTimeout(networkThresholdTimer);
    networkThresholdTimer=null;
  }
  networkThresholdLastRefresh=performance.now();
  updateNetworkLayer();
}

$('networkThreshold').addEventListener('input',e=>{
  // Existing smooth live-update logic is shared with the numeric input.
  setNetworkThresholdValue(Number(e.target.value));
});
$('networkThreshold').addEventListener('change',commitNetworkThreshold);

$('networkThresholdInput').addEventListener('input',e=>{
  const raw=e.target.value.trim();
  // Allow intermediate empty/incomplete edits without forcing them to zero.
  // Values outside the permitted range are clamped only on confirmation.
  if(!raw||!Number.isFinite(Number(raw)))return;
  if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))return;
  const value=Number(raw);
  if(value<0||value>50)return;
  setNetworkThresholdValue(value,false);
});

$('networkThresholdInput').addEventListener('change',e=>{
  const raw=e.target.value.trim();
  const parsed=raw?Number(raw):NaN;
  setNetworkThresholdValue(Number.isFinite(parsed)?parsed:networkThreshold);
  commitNetworkThreshold();
});

$('focus70Toggle').addEventListener('change',e=>{
  focus70Enabled=e.target.checked;
  e.target.closest('.layerItem')?.classList.toggle('focusActive',focus70Enabled);
  updateFocus70();
});

$('terrainFit').onclick=()=>{
  if(currentProvider==='google' && googleMap){
    fitGoogleTo70();
  }else if(currentProvider==='osm' && osmMap){
    fitOsmTo70();
  }
};

$('londonBtn').onclick=()=>{
  if(currentProvider==='google'&&googleMap){
    googleMap.setCenter(CENTER);googleMap.setZoom(10);
    sharedView={lat:CENTER.lat,lng:CENTER.lng,zoom:10,source:currentProvider};
  }else if(currentProvider==='osm'&&osmMap){
    osmMap.flyTo({center:[CENTER.lng,CENTER.lat],zoom:10,pitch:0,bearing:0});
    sharedView={lat:CENTER.lat,lng:CENTER.lng,zoom:10,source:currentProvider};
  }
};

$('resetBtn').onclick=()=>{
  siteUI?.clear();
  cancelPlaceSearch();$('placeSearchInput').value='';
  $('placeSearchResults').replaceChildren();setSearchStatus('');
  searchMarker?.remove();searchMarker=null;
  if(currentProvider==='google'&&googleMap){
    googleMap.setCenter(CENTER);googleMap.setZoom(ZOOM);
    sharedView={lat:CENTER.lat,lng:CENTER.lng,zoom:ZOOM,source:currentProvider};
    googleMap.setMapTypeId('roadmap');$('mapType').value='roadmap';
  }else if(currentProvider==='osm'&&osmMap){
    osmMap.jumpTo({center:[CENTER.lng,CENTER.lat],zoom:ZOOM,pitch:0,bearing:0});
    sharedView={lat:CENTER.lat,lng:CENTER.lng,zoom:ZOOM,source:currentProvider};
  }
};

$('locateBtn').onclick=()=>{
  if(!navigator.geolocation){say('Your browser does not support geolocation.',true);return;}
  say('Locating…');
  navigator.geolocation.getCurrentPosition(async pos=>{
    const p={lat:pos.coords.latitude,lng:pos.coords.longitude};
    if(currentProvider==='google'){
      await initGoogle();
      if(!googleMap)return;
      googleMap.panTo(p);googleMap.setZoom(15);
        sharedView={lat:p.lat,lng:p.lng,zoom:15,source:currentProvider};
      if(googleMarker)googleMarker.setMap(null);
      googleMarker=new google.maps.Marker({position:p,map:googleMap,title:'Current location'});
    }else{
      initOSM();
      osmMap.flyTo({center:[p.lng,p.lat],zoom:15});
        sharedView={lat:p.lat,lng:p.lng,zoom:15,source:currentProvider};
      if(osmMarker)osmMarker.remove();
      osmMarker=new maplibregl.Marker().setLngLat([p.lng,p.lat]).addTo(osmMap);
    }
    say('Location found.');
  },err=>say('Location failed: '+err.message,true),{
    enableHighAccuracy:true,timeout:10000,maximumAge:60000
  });
};

const analysisLayerList=$('analysisLayerList');
const layerListToggle=$('layerListToggle');
layerListToggle.addEventListener('click',()=>{
  const nextCollapsed=!analysisLayerList.classList.contains('sectionCollapsed');
  analysisLayerList.classList.toggle('sectionCollapsed',nextCollapsed);
  layerListToggle.setAttribute('aria-expanded',String(!nextCollapsed));
  layerListToggle.title=nextCollapsed?'Expand analysis layers':'Collapse analysis layers';
  requestAnimationFrame(()=>{
    if(osmMap&&currentProvider==='osm')osmMap.resize();
  });
});

const siteTaskList=$('siteTaskList');
const siteTaskToggle=$('siteTaskToggle');
siteTaskToggle.addEventListener('click',()=>{
  const nextCollapsed=!siteTaskList.classList.contains('sectionCollapsed');
  siteTaskList.classList.toggle('sectionCollapsed',nextCollapsed);
  siteTaskToggle.setAttribute('aria-expanded',String(!nextCollapsed));
  siteTaskToggle.title=nextCollapsed?'Expand tensor-field street generation':'Collapse tensor-field street generation';
});

// Layer explanatory notes stay out of the panel. Hover a layer title for 2 seconds
// to reveal the corresponding note as a floating tooltip.
const layerHintTooltip=$('layerHintTooltip');
let layerHintTimer=null;
let layerHintTarget=null;

function hideLayerHint(){
  clearTimeout(layerHintTimer);
  layerHintTimer=null;
  layerHintTarget=null;
  layerHintTooltip.classList.remove('visible');
  layerHintTooltip.setAttribute('aria-hidden','true');
}

function positionLayerHint(target){
  const rect=target.getBoundingClientRect();
  const margin=10;
  const tooltipRect=layerHintTooltip.getBoundingClientRect();
  let left=rect.right+margin;
  let top=rect.top;
  if(left+tooltipRect.width>window.innerWidth-margin){
    left=Math.max(margin,rect.left-tooltipRect.width-margin);
  }
  if(top+tooltipRect.height>window.innerHeight-margin){
    top=Math.max(margin,window.innerHeight-tooltipRect.height-margin);
  }
  layerHintTooltip.style.left=Math.round(left)+'px';
  layerHintTooltip.style.top=Math.round(top)+'px';
}

for(const title of document.querySelectorAll('.layerItem .layerName')){
  const item=title.closest('.layerItem');
  const note=item?.querySelector('.layerMeta');
  if(!note||!note.textContent.trim())continue;

  title.style.cursor='help';
  title.addEventListener('mouseenter',()=>{
    hideLayerHint();
    layerHintTarget=title;
    layerHintTimer=setTimeout(()=>{
      if(layerHintTarget!==title)return;
      layerHintTooltip.textContent=note.textContent.replace(/\s+/g,' ').trim();
      layerHintTooltip.setAttribute('aria-hidden','false');
      layerHintTooltip.classList.add('visible');
      requestAnimationFrame(()=>positionLayerHint(title));
    },2000);
  });
  title.addEventListener('mouseleave',hideLayerHint);
  title.addEventListener('mousedown',hideLayerHint);
  if(TOUCH_UI){
    const info=document.createElement('button');
    info.type='button';info.className='layerInfo';info.textContent='ⓘ';info.setAttribute('aria-label','About this layer');
    info.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();   // inside the row's label: do not switch the layer
      if(layerHintTarget===title&&layerHintTooltip.classList.contains('visible')){hideLayerHint();return;}
      hideLayerHint();layerHintTarget=title;
      layerHintTooltip.textContent=note.textContent.replace(/\s+/g,' ').trim();
      layerHintTooltip.setAttribute('aria-hidden','false');layerHintTooltip.classList.add('visible');
      requestAnimationFrame(()=>positionLayerHint(title));
    });
    (title.querySelector('strong')||title).append(info);
  }
}
if(TOUCH_UI){
  document.addEventListener('pointerdown',event=>{if(!event.target.closest?.('.layerInfo'))hideLayerHint();},true);
  // the display panel, shown and hidden by a button of its own
  document.body.classList.add('touchUi');
  if(IS_PHONE||(window.innerWidth<window.innerHeight&&window.innerWidth<900))document.body.classList.add('dpHidden');
  const dpToggle=document.createElement('button');
  dpToggle.type='button';dpToggle.id='dpToggle';dpToggle.className='dpToggle';dpToggle.textContent='Display';
  dpToggle.setAttribute('aria-label','Show or hide the display panel');dpToggle.setAttribute('aria-controls','displayPanel');
  const syncDp=()=>dpToggle.setAttribute('aria-expanded',String(!document.body.classList.contains('dpHidden')));
  dpToggle.addEventListener('click',()=>{document.body.classList.toggle('dpHidden');syncDp();});
  syncDp();$('displayPanel')?.before(dpToggle);
}

window.addEventListener('scroll',hideLayerHint,true);
window.addEventListener('resize',hideLayerHint);

const panel=$('panel');
const panelResizeHandle=$('panelResizeHandle');
const PANEL_WIDTH_KEY='googleMapLive.panelWidth.v1';
let panelExpandedWidth=null;

function clampPanelWidth(width){
  const viewportMax=Math.max(300,window.innerWidth-28);
  return Math.max(300,Math.min(720,viewportMax,width));
}

function applyPanelWidth(width,persist=true){
  if(window.matchMedia('(max-width:600px)').matches)return;
  const next=clampPanelWidth(Number(width)||370);
  panel.style.width=next+'px';
  panelExpandedWidth=next;
  if(persist){
    try{localStorage.setItem(PANEL_WIDTH_KEY,String(Math.round(next)))}catch{}
  }
  if(osmMap&&currentProvider==='osm')osmMap.resize();
}

try{
  const savedWidth=Number(localStorage.getItem(PANEL_WIDTH_KEY));
  if(Number.isFinite(savedWidth)&&savedWidth>0)applyPanelWidth(savedWidth,false);
}catch{}

panelResizeHandle.addEventListener('pointerdown',event=>{
  if(panel.classList.contains('collapsed')||window.matchMedia('(max-width:600px)').matches)return;
  event.preventDefault();
  const pointerId=event.pointerId;
  panelResizeHandle.setPointerCapture?.(pointerId);
  const startX=event.clientX;
  const startWidth=panel.getBoundingClientRect().width;
  panel.classList.add('resizing');

  const move=moveEvent=>{
    if(moveEvent.pointerId!==pointerId)return;
    applyPanelWidth(startWidth+(moveEvent.clientX-startX),false);
  };
  const end=endEvent=>{
    if(endEvent.pointerId!==pointerId)return;
    panel.classList.remove('resizing');
    panelResizeHandle.releasePointerCapture?.(pointerId);
    panelResizeHandle.removeEventListener('pointermove',move);
    panelResizeHandle.removeEventListener('pointerup',end);
    panelResizeHandle.removeEventListener('pointercancel',end);
    applyPanelWidth(panel.getBoundingClientRect().width,true);
    terrainCameraStarted();
    setTimeout(terrainCameraEnded,120);
  };

  panelResizeHandle.addEventListener('pointermove',move);
  panelResizeHandle.addEventListener('pointerup',end);
  panelResizeHandle.addEventListener('pointercancel',end);
});

window.addEventListener('resize',()=>{
  if(!panel.classList.contains('collapsed')&&panelExpandedWidth){
    applyPanelWidth(panelExpandedWidth,false);
  }
});

/* v3.42.0 · phones: the control panel is a sheet along the bottom (body.phoneUi). Its handle shows the map or the panel:
   tap it to open or fold the sheet, drag it to any height (it settles folded, half or nearly full). Folded is the
   panel's own 'collapsed' state (title only), so the − / + button and everything that folds the panel still apply.
   Computers and iPads: the floating panel as before. */
const SHEET_FULL=()=>Math.max(200,window.innerHeight-64),SHEET_HALF=()=>Math.round(window.innerHeight*0.52);
function setSheet(state){
  if(!IS_PHONE)return;
  const folded=state==='folded';
  panel.classList.toggle('collapsed',folded);$('collapse').textContent=folded?'+':'−';
  $('collapse').setAttribute('aria-label',folded?'Expand control panel':'Collapse control panel');
  panel.style.height=folded?'':(state==='full'?SHEET_FULL():SHEET_HALF())+'px';
  panel.dataset.sheet=state;
}
if(IS_PHONE){
  document.body.classList.add('phoneUi');
  const handle=document.createElement('button');
  handle.type='button';handle.className='sheetHandle';handle.setAttribute('aria-label','Show or hide the control panel');
  panel.prepend(handle);
  let drag=null;
  /* 24 Nov 2026: the whole head (the title and its lines) takes the finger too, as in the other apps; its buttons stay buttons */
  const grips=[handle,panel.querySelector(':scope > .head')].filter(Boolean);
  const down=event=>{
    if(drag)return;const btn=event.target.closest('button,a,input,select,label,[role="button"],[role="group"]');if(btn&&btn!==handle)return;
    drag={id:event.pointerId,y:event.clientY,h:panel.getBoundingClientRect().height,moved:false};try{event.currentTarget.setPointerCapture(event.pointerId);}catch(e){}
  };
  const mv=event=>{
    if(!drag||event.pointerId!==drag.id)return;const dy=event.clientY-drag.y;if(!drag.moved&&Math.abs(dy)<6)return;
    if(!drag.moved){drag.moved=true;panel.classList.remove('collapsed');panel.classList.add('sheetDragging');}
    panel.style.height=Math.max(72,Math.min(SHEET_FULL(),drag.h-dy))+'px';
    const t=performance.now();if(drag.t&&t>drag.t)drag.v=0.7*(event.clientY-drag.ly)/(t-drag.t)+0.3*(drag.v||0);drag.t=t;drag.ly=event.clientY;
  };
  const end=event=>{
    if(!drag||event.pointerId!==drag.id)return;const d=drag;drag=null;panel.classList.remove('sheetDragging');
    if(!d.moved){setSheet(panel.classList.contains('collapsed')?'half':'folded');return;}
    const h=panel.getBoundingClientRect().height,v=performance.now()-(d.t||0)>120?0:(d.v||0);
    /* a flick (24 Nov 2026) goes one step the way it was thrown; let go slowly, the nearest step */
    const order=['folded','half','full'],step=x=>x<SHEET_HALF()*0.55?0:x<(SHEET_HALF()+SHEET_FULL())/2?1:2,from=step(d.h);
    setSheet(v<-0.35?order[Math.min(2,from+1)]:v>0.35?order[Math.max(0,from-1)]:order[step(h)]);
  };
  for(const g of grips){g.style.touchAction='none';g.addEventListener('pointerdown',down);g.addEventListener('pointermove',mv);g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);}
  setSheet('folded');   // the map first
  window.addEventListener('resize',()=>{if(panel.dataset.sheet&&panel.dataset.sheet!=='folded')setSheet(panel.dataset.sheet);});
}
$('collapse').onclick=()=>{
  if(IS_PHONE){setSheet(panel.classList.contains('collapsed')?'half':'folded');return;}
  const collapsing=!panel.classList.contains('collapsed');
  if(collapsing){
    panelExpandedWidth=panel.getBoundingClientRect().width;
  }
  panel.classList.toggle('collapsed',collapsing);
  $('collapse').textContent=collapsing?'+':'−';
  $('collapse').setAttribute('aria-label',collapsing?'Expand control panel':'Collapse control panel');

  if(!collapsing&&panelExpandedWidth){
    requestAnimationFrame(()=>applyPanelWidth(panelExpandedWidth,false));
  }

  setTimeout(()=>{
    if(osmMap&&currentProvider==='osm')osmMap.resize();
    terrainCameraStarted();
    setTimeout(terrainCameraEnded,150);
  },100);
};

syncBadge();
for(const id of ['terrainToggle','contourToggle','floodToggle','networkToggle','focus70Toggle']){
  $(id).checked=false;
}
$('googleMap').style.display='none';
$('osmMap').style.display='block';
$('osmStructureToggle').checked=osmStructuresHidden;
initOSM();
