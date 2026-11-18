/* Site selection on the London map → Tensor Studio (v3.37).
 *
 * Replaces the isolated-site hydro lab (local_flood_ui.js, the Wool road generation and the Parcel
 * Generator). What stays exactly as it was is the way a site is chosen:
 *   Draw site boundary → click the corners → Enter previews (anchors can be dragged, double-click an
 *   edge adds one, double-click an anchor removes it) → Enter confirms → double-click inside the red
 *   boundary, or the button, enters the site.
 * Entering the site now opens Tensor Studio over the map (integration/google-map-live-hook.js), with the
 * site's OSM streets, rail, water, buildings and the OS Terrain 50 elevation. Tensor Studio reads the EA
 * flood risk itself. Esc, or its "back to the London map" button, returns here with the red boundary kept.
 */
import {openTensorStudio, closeTensorStudio} from './tensor_studio_site.js?v=3.43.5-english';

const SEL_SOURCE='site-selection-source';
const SEL_FILL='site-selection-fill';
const SEL_LINE='site-selection-line';
const SEL_POINTS='site-selection-points';
const SEL_DISTANCE='site-selection-distance';
const R=6378137;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mercator=(lng,lat)=>[R*lng*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+clamp(lat,-85.05112878,85.05112878)*Math.PI/360))];
const unmercator=(x,y)=>[x/R*180/Math.PI,(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI];
function geodesicDistanceM(a,b){
  const E=6371008.8,lat1=a[1]*Math.PI/180,lat2=b[1]*Math.PI/180,dLat=(b[1]-a[1])*Math.PI/180,dLng=(b[0]-a[0])*Math.PI/180;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*E*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
function edgeMidpoint(a,b){const [ax,ay]=mercator(a[0],a[1]),[bx,by]=mercator(b[0],b[1]);return unmercator((ax+bx)/2,(ay+by)/2);}
function formatEdgeDistance(m){if(m>=1000)return (m/1000).toFixed(m>=10000?1:2)+' km';if(m>=100)return Math.round(m)+' m';return m.toFixed(1)+' m';}
function closeRing(ring){if(!ring?.length)return ring||[];const f=ring[0],l=ring[ring.length-1];return f[0]===l[0]&&f[1]===l[1]?ring:[...ring,f];}
function geodesicRingAreaM2(ring){
  if(!ring||ring.length<3)return 0;const E=6371008.8,pts=closeRing(ring);let sum=0;
  for(let i=0;i<pts.length-1;i++){const lon1=pts[i][0]*Math.PI/180,lon2=pts[i+1][0]*Math.PI/180,lat1=pts[i][1]*Math.PI/180,lat2=pts[i+1][1]*Math.PI/180;let d=lon2-lon1;if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;sum+=d*(2+Math.sin(lat1)+Math.sin(lat2));}
  return Math.abs(sum)*E*E/2;
}
function pointInRingLngLat(p,ring){
  let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}
  return inside;
}

export function createTensorSiteUI({map,maplibregl,assetUrl,demBounds,demWidth,demHeight,say,getMapTheme}){
  const $=id=>document.getElementById(id);
  let drawing=false,editing=false,dirty=false,confirmed=false,open=false;
  let vertices=[],polygon=null,dragIndex=-1,dragStart=null,dragMoved=false,dragPanWasEnabled=true;
  let areaTimer=null,areaInside=false,areaLngLat=null,areaPopup=null;
  const canvasContainer=map.getCanvasContainer();
  // v3.41.0 · touch screens (iPad, iPhone): hints name the buttons instead of Enter / double-click; anchors move by finger
  const TOUCH=(()=>{try{return matchMedia('(pointer: coarse)').matches;}catch(error){return false;}})();
  const status=(message,error=false)=>{const el=$('siteSelectionStep');if(el){el.textContent=message;el.style.color=error?'#ff6b6b':'';}if(error)say?.(message,true);};

  function ensureLayers(){
    if(!map.getSource(SEL_SOURCE))map.addSource(SEL_SOURCE,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    if(!map.getLayer(SEL_FILL))map.addLayer({id:SEL_FILL,type:'fill',source:SEL_SOURCE,filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#ef4444','fill-opacity':0.035}});
    if(!map.getLayer(SEL_LINE))map.addLayer({id:SEL_LINE,type:'line',source:SEL_SOURCE,filter:['in',['geometry-type'],['literal',['LineString','Polygon']]],paint:{'line-color':'#ef4444','line-width':2.6,'line-dasharray':[2,1]}});
    if(!map.getLayer(SEL_POINTS))map.addLayer({id:SEL_POINTS,type:'circle',source:SEL_SOURCE,filter:['all',['==',['geometry-type'],'Point'],['has','vertexIndex']],paint:{'circle-radius':7,'circle-color':'#ffffff','circle-stroke-color':'#ef4444','circle-stroke-width':3}});
    if(!map.getLayer(SEL_DISTANCE))map.addLayer({id:SEL_DISTANCE,type:'symbol',source:SEL_SOURCE,filter:['all',['==',['geometry-type'],'Point'],['has','distanceLabel']],
      layout:{'text-field':['get','distanceLabel'],'text-size':13,'text-font':['Noto Sans Regular'],'text-allow-overlap':false,'text-anchor':'center'},
      paint:{'text-color':'#b91c1c','text-halo-color':'#ffffff','text-halo-width':2,'text-halo-blur':0.5}});
  }
  function setEditVisibility(visible){for(const id of [SEL_POINTS,SEL_DISTANCE])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',visible?'visible':'none');}
  function updateSelection(){
    ensureLayers();const features=[];
    if(vertices.length>=3)features.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[...vertices,vertices[0]]]}});
    else if(vertices.length>=2)features.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:vertices}});
    vertices.forEach((p,i)=>features.push({type:'Feature',properties:{vertexIndex:i},geometry:{type:'Point',coordinates:p}}));
    const edges=vertices.length>=3?vertices.length:Math.max(0,vertices.length-1);
    for(let i=0;i<edges;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length],m=geodesicDistanceM(a,b);features.push({type:'Feature',properties:{edgeIndex:i,distanceM:m,distanceLabel:formatEdgeDistance(m)},geometry:{type:'Point',coordinates:edgeMidpoint(a,b)}});}
    map.getSource(SEL_SOURCE)?.setData({type:'FeatureCollection',features});
    setEditVisibility(editing||drawing);
  }
  function syncPolygon(){polygon=vertices.length>=3?[closeRing(vertices.map(p=>[p[0],p[1]]))]:null;updateSelection();}
  const ready=()=>Boolean(polygon?.[0]&&polygon[0].length>=4&&confirmed&&!dirty&&!drawing&&dragIndex<0&&!open);

  function setButtons(){
    const finish=$('siteFinish');
    if(finish){
      finish.disabled=Boolean(dragIndex>=0||(drawing&&vertices.length<3)||(!drawing&&!editing)||(confirmed&&!dirty));
      finish.textContent=drawing?'① Preview site':confirmed&&!dirty?'✓ Boundary confirmed':'② Confirm final boundary';
    }
    const enter=$('siteEnter');if(enter){enter.disabled=!ready();}
    const clear=$('siteClear');if(clear)clear.disabled=!vertices.length;
    const draw=$('siteDraw');if(draw)draw.disabled=open;
    const stage=$('siteSelectionStep');
    if(stage&&!stage.dataset.hold)stage.textContent=TOUCH?(drawing?'Step 1: tap at least three points, then tap ① Preview site':
      !editing?'Tap Draw site boundary to begin':
      confirmed&&!dirty?'Boundary confirmed: tap Enter site':
      'Site preview: drag the anchors (hold one to remove it, hold an edge to add one), then tap ② Confirm final boundary'):
      drawing?'Step 1: select at least three points and press Enter to preview':
      !editing?'Click Draw site boundary to begin':
      confirmed&&!dirty?'Boundary confirmed: double-click inside the red outline or click Enter site':
      'Site preview: adjust or retain boundary, then press Enter to confirm';
  }

  // v3.42.1 · phones (short side under 600 px): the first time a boundary is drawn, a word on how (once per device)
  const PHONE=TOUCH&&Math.min(screen.width,screen.height)<600;
  function phoneTip(){
    if(!PHONE)return;try{if(localStorage.getItem('googleMapLive.phoneDrawTip'))return;localStorage.setItem('googleMapLive.phoneDrawTip','1');}catch(error){}
    say?.('On a phone: drag the panel down to see more of the map and tap the corners, then open it again for ① Preview site. Drawing is easier on an iPad or a computer.');
  }
  function startDrawing(){
    phoneTip();
    closeTensorStudio();open=false;
    vertices=[];polygon=null;drawing=true;editing=false;dirty=false;confirmed=false;dragIndex=-1;
    map.doubleClickZoom.disable();map.getCanvas().style.cursor='crosshair';
    updateSelection();setButtons();
  }
  function finishDrawing(){
    if(!drawing||vertices.length<3)return;
    drawing=false;editing=true;dirty=true;confirmed=false;dragIndex=-1;
    map.doubleClickZoom.disable();dragPanWasEnabled=map.dragPan.isEnabled();map.getCanvas().style.cursor='';
    syncPolygon();setButtons();
    const lngs=vertices.map(p=>p[0]),lats=vertices.map(p=>p[1]);
    map.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]],{padding:70,maxZoom:17.3,duration:350,pitch:0});
  }
  function confirmSelection(){
    if(!editing||vertices.length<3)return false;
    dragIndex=-1;syncPolygon();dirty=false;confirmed=true;setButtons();return true;
  }
  function finishAndConfirm(){
    if(drawing){if(vertices.length<3)return false;finishDrawing();return true;}
    if(!editing)return false;if(confirmed&&!dirty)return true;return confirmSelection();
  }
  function clearSelection(){
    closeTensorStudio();open=false;hideAreaPopup();
    vertices=[];polygon=null;drawing=false;editing=false;dirty=false;confirmed=false;dragIndex=-1;
    map.doubleClickZoom.enable();if(!map.dragPan.isEnabled())map.dragPan.enable();map.getCanvas().style.cursor='';
    updateSelection();setButtons();
  }

  async function enterSite(){
    if(!ready())return false;
    hideAreaPopup();open=true;setButtons();
    try{
      await openTensorStudio({map,polygon:polygon.map(r=>closeRing(r)),assetUrl,demBounds,demWidth,demHeight,say,mapTheme:getMapTheme?.(),
        onClose:()=>{open=false;setButtons();}});
    }catch(error){open=false;setButtons();status('Tensor Studio could not open this site: '+(error?.message||error),true);return false;}
    return true;
  }

  /* the area popup: resting inside the red polygon for 2 s shows its ground area */
  const hideAreaPopup=()=>{clearTimeout(areaTimer);areaTimer=null;areaInside=false;areaLngLat=null;if(areaPopup){areaPopup.remove();areaPopup=null;}};
  const scheduleAreaPopup=lngLat=>{
    if(!polygon?.[0]||vertices.length<3)return;areaLngLat=[lngLat.lng,lngLat.lat];if(areaInside||areaTimer)return;areaInside=true;
    areaTimer=setTimeout(()=>{areaTimer=null;if(!areaInside||!polygon?.[0]||!areaLngLat)return;const a=geodesicRingAreaM2(polygon[0]);if(!(a>0))return;
      const html='<strong>Site area</strong><br>'+(a/1e4).toFixed(2)+' ha · '+(a/1e6).toFixed(4)+' km²';
      if(!areaPopup)areaPopup=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:12,className:'site-area-popup'});
      areaPopup.setLngLat(areaLngLat).setHTML(html).addTo(map);},2000);
  };

  const pointFromMouse=event=>{const rect=map.getCanvas().getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};};
  const findAnchorAtPoint=point=>{if(!editing||!vertices.length)return null;let best=null,bd=22;for(let i=0;i<vertices.length;i++){const q=map.project(vertices[i]),d=Math.hypot(q.x-point.x,q.y-point.y);if(d<=bd){bd=d;best=i;}}return best;};
  const nearestEdgeAtPoint=point=>{
    if(!editing||vertices.length<2)return null;let best=null;
    for(let i=0;i<vertices.length;i++){const a=map.project(vertices[i]),b=map.project(vertices[(i+1)%vertices.length]),dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<1e-9)continue;
      const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/l2,0,1),x=a.x+t*dx,y=a.y+t*dy,d=Math.hypot(point.x-x,point.y-y);
      if(d<=16&&(!best||d<best.distance))best={distance:d,x,y,insertIndex:i+1};}
    return best;
  };

  map.on('click',event=>{if(!drawing)return;vertices.push([event.lngLat.lng,event.lngLat.lat]);updateSelection();setButtons();});
  map.on('dblclick',event=>{
    event.originalEvent?.preventDefault?.();
    if(drawing){if(vertices.length>=3)finishAndConfirm();return;}
    if(open)return;hideAreaPopup();
    const at=[event.lngLat.lng,event.lngLat.lat],inside=Boolean(polygon?.[0]?.length>=4&&pointInRingLngLat(at,polygon[0]));
    const atHandle=editing&&(findAnchorAtPoint(event.point)!==null||Boolean(nearestEdgeAtPoint(event.point)));
    if(inside&&confirmed&&!dirty&&!atHandle){enterSite();return;}
    if(inside&&!confirmed&&!atHandle){status(TOUCH?'Tap ② Confirm final boundary first, then tap Enter site.':'Press Enter to confirm the boundary first, then double-click inside to enter the site.');return;}
    if(!editing)return;
    const ai=findAnchorAtPoint(event.point);
    if(ai!==null){if(vertices.length<=3){status('Polygon requires at least three anchors; no further anchors can be deleted.',true);return;}vertices.splice(ai,1);dirty=true;confirmed=false;syncPolygon();setButtons();return;}
    const edge=nearestEdgeAtPoint(event.point);if(!edge)return;
    const ll=map.unproject([edge.x,edge.y]);vertices.splice(edge.insertIndex,0,[ll.lng,ll.lat]);dirty=true;confirmed=false;syncPolygon();setButtons();
  });
  const onMouseDownCapture=event=>{
    if(!editing||event.button!==0||open)return;const point=pointFromMouse(event),i=findAnchorAtPoint(point);if(i===null)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();hideAreaPopup();
    dragIndex=i;dragStart=point;dragMoved=false;dragPanWasEnabled=map.dragPan.isEnabled();if(dragPanWasEnabled)map.dragPan.disable();map.getCanvas().style.cursor='grabbing';
  };
  const onMouseMoveWindow=event=>{
    if(dragIndex<0||!editing)return;event.preventDefault();const point=pointFromMouse(event);
    if(!dragMoved){if(Math.hypot(point.x-dragStart.x,point.y-dragStart.y)<5)return;dragMoved=true;dirty=true;confirmed=false;setButtons();}
    const ll=map.unproject([point.x,point.y]);vertices[dragIndex]=[ll.lng,ll.lat];syncPolygon();
  };
  const onMouseUpWindow=()=>{if(dragIndex<0)return;dragIndex=-1;dragStart=null;dragMoved=false;if(dragPanWasEnabled&&!map.dragPan.isEnabled())map.dragPan.enable();map.getCanvas().style.cursor='';setButtons();};
  const onMapMouseMove=event=>{
    if(dragIndex>=0){hideAreaPopup();return;}
    const ring=polygon?.[0];if(ring?.length>=4&&pointInRingLngLat([event.lngLat.lng,event.lngLat.lat],ring))scheduleAreaPopup(event.lngLat);else hideAreaPopup();
    if(!editing)return;
    if(findAnchorAtPoint(event.point)!==null){map.getCanvas().style.cursor='grab';return;}
    map.getCanvas().style.cursor=nearestEdgeAtPoint(event.point)?'crosshair':'';
  };
  const onNativeDoubleClick=event=>{
    if(!ready())return;const point=pointFromMouse(event);if(findAnchorAtPoint(point)!==null||nearestEdgeAtPoint(point))return;
    const ll=map.unproject([point.x,point.y]);if(!pointInRingLngLat([ll.lng,ll.lat],polygon[0]))return;
    event.preventDefault();event.stopImmediatePropagation?.();event.stopPropagation();hideAreaPopup();enterSite();
  };
  const onCanvasLeave=()=>hideAreaPopup();
  canvasContainer.addEventListener('dblclick',onNativeDoubleClick,true);
  canvasContainer.addEventListener('mousedown',onMouseDownCapture,true);
  canvasContainer.addEventListener('mouseleave',onCanvasLeave);
  window.addEventListener('mousemove',onMouseMoveWindow,{passive:false});
  window.addEventListener('mouseup',onMouseUpWindow);
  map.on('mousemove',onMapMouseMove);

  /* v3.41.0 · fingers: drag an anchor (30 px reach); hold one still for 0.6 s to remove it; hold an edge to add an anchor
     there (the mouse's double-clicks). MapLibre pans the map with touch events, so these listen to touch events too, in the
     capture phase, and keep a touch on an anchor or edge from panning. Mouse use is untouched. */
  let hold=null;
  const touchPoint=t=>{const rect=map.getCanvas().getBoundingClientRect();return {x:t.clientX-rect.left,y:t.clientY-rect.top};};
  const anchorNear=(point,r)=>{if(!editing||!vertices.length)return null;let best=null,bd=r;for(let i=0;i<vertices.length;i++){const q=map.project(vertices[i]),d=Math.hypot(q.x-point.x,q.y-point.y);if(d<=bd){bd=d;best=i;}}return best;};
  const endHold=()=>{if(hold){clearTimeout(hold.timer);hold=null;}};
  const endTouchDrag=()=>{endHold();if(dragIndex<0)return;dragIndex=-1;dragStart=null;dragMoved=false;if(dragPanWasEnabled&&!map.dragPan.isEnabled())map.dragPan.enable();setButtons();};
  const onTouchStart=event=>{
    if(!editing||open||event.touches.length!==1)return;
    const point=touchPoint(event.touches[0]),i=anchorNear(point,30),edge=i===null?nearestEdgeAtPoint(point):null;if(i===null&&!edge)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();hideAreaPopup();
    dragPanWasEnabled=map.dragPan.isEnabled();if(dragPanWasEnabled)map.dragPan.disable();
    if(i!==null){dragIndex=i;dragStart=point;dragMoved=false;}
    hold={start:point,timer:setTimeout(()=>{const h=hold;hold=null;if(!h||dragMoved)return;
      if(i!==null){if(vertices.length<=3){status('Polygon requires at least three anchors; no further anchors can be deleted.',true);return;}
        dragIndex=-1;vertices.splice(i,1);}
      else{const ll=map.unproject([edge.x,edge.y]);vertices.splice(edge.insertIndex,0,[ll.lng,ll.lat]);}
      dirty=true;confirmed=false;syncPolygon();setButtons();},600)};
  };
  const onTouchMove=event=>{
    if(hold&&!dragMoved){const p=touchPoint(event.touches[0]);if(Math.hypot(p.x-hold.start.x,p.y-hold.start.y)>8&&dragIndex<0)endHold();}
    if(dragIndex<0||!editing)return;event.preventDefault();const point=touchPoint(event.touches[0]);
    if(!dragMoved){if(Math.hypot(point.x-dragStart.x,point.y-dragStart.y)<8)return;dragMoved=true;endHold();dirty=true;confirmed=false;setButtons();}
    const ll=map.unproject([point.x,point.y]);vertices[dragIndex]=[ll.lng,ll.lat];syncPolygon();
  };
  if(TOUCH){
    canvasContainer.addEventListener('touchstart',onTouchStart,{capture:true,passive:false});
    window.addEventListener('touchmove',onTouchMove,{passive:false});
    window.addEventListener('touchend',endTouchDrag);window.addEventListener('touchcancel',endTouchDrag);
  }

  const keydown=event=>{
    const tag=event.target?.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||open)return;
    if(event.key==='Enter'&&!event.repeat&&((drawing&&vertices.length>=3)||editing)){event.preventDefault();finishAndConfirm();return;}
    if(event.key==='Escape'&&(drawing||editing)&&!confirmed){event.preventDefault();clearSelection();}
  };
  document.addEventListener('keydown',keydown);

  $('siteDraw')?.addEventListener('click',startDrawing);
  $('siteFinish')?.addEventListener('click',()=>finishAndConfirm());
  $('siteEnter')?.addEventListener('click',()=>enterSite());
  $('siteClear')?.addEventListener('click',clearSelection);
  ensureLayers();setButtons();

  return {
    clear:clearSelection,
    enter:enterSite,
    get polygon(){return polygon;},
    destroy(){
      clearSelection();
      canvasContainer.removeEventListener('dblclick',onNativeDoubleClick,true);
      canvasContainer.removeEventListener('mousedown',onMouseDownCapture,true);
      canvasContainer.removeEventListener('mouseleave',onCanvasLeave);
      window.removeEventListener('mousemove',onMouseMoveWindow);window.removeEventListener('mouseup',onMouseUpWindow);
      if(TOUCH){canvasContainer.removeEventListener('touchstart',onTouchStart,{capture:true});window.removeEventListener('touchmove',onTouchMove);window.removeEventListener('touchend',endTouchDrag);window.removeEventListener('touchcancel',endTouchDrag);}
      map.off('mousemove',onMapMouseMove);document.removeEventListener('keydown',keydown);
      for(const id of [SEL_DISTANCE,SEL_POINTS,SEL_LINE,SEL_FILL])if(map.getLayer(id))map.removeLayer(id);
      if(map.getSource(SEL_SOURCE))map.removeSource(SEL_SOURCE);
    }
  };
}
