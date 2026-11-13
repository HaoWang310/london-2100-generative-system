/* Lighting and weather for the London map (MapLibre / OpenFreeMap).
 *
 * Lighting presets (dawn, day, dusk, night) and a live mode that follows the
 * real sun over the map centre. Each preset sets:
 *   - the MapLibre 3D light (direction, colour, intensity) for buildings/vehicles,
 *   - the MapLibre sky (sky, horizon and fog colours near the horizon),
 *   - a colour tint for the basemap, 3D buildings and vehicles.
 * Analysis layers (flood, terrain, drainage...) are never tinted, so their
 * colours keep their meaning in every lighting mode.
 *
 * Weather (clear, fog, rain, snow) adds its own tint and light change plus a
 * screen-space particle overlay drawn above the map canvas.
 */

/* ------------------------------------------------------------- colour */

function hexToRgb(hex){
  let h=String(hex).replace('#','');
  if(h.length===3)h=h.split('').map(c=>c+c).join('');
  const n=parseInt(h,16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function rgbToHex([r,g,b]){
  const c=v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
  return '#'+c(r)+c(g)+c(b);
}
export function mixHex(a,b,t){
  const A=hexToRgb(a),B=hexToRgb(b);
  return rgbToHex(A.map((v,i)=>v+(B[i]-v)*t));
}
/* Apply a list of tints [{color, amount}] in order. Non-hex values pass through. */
export function tintHex(hex,tints){
  if(typeof hex!=='string'||!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex))return hex;
  let out=hex;
  for(const t of tints||[])if(t&&t.amount>0)out=mixHex(out,t.color,t.amount);
  return out;
}

/* ------------------------------------------------------------- presets */

export const LIGHTING_PRESETS=Object.freeze({
  dawn:{
    light:{azimuth:100,polar:64,color:'#fff3ea',intensity:0.42},
    sky:{sky:'#a7bfe3',horizon:'#ffd6b3',fog:'#f3dcc9'},
    tint:{color:'#ffb37f',amount:0.10},night:0
  },
  day:{
    // Matches MapLibre's default light, so "day" looks like the map always has.
    light:{azimuth:210,polar:30,color:'#ffffff',intensity:0.5},
    sky:{sky:'#88b4e8',horizon:'#e2ecf7',fog:'#eef2f6'},
    tint:{color:'#ffffff',amount:0},night:0
  },
  dusk:{
    light:{azimuth:262,polar:62,color:'#fff2e8',intensity:0.42},
    sky:{sky:'#6c66a6',horizon:'#ffad86',fog:'#efc4ae'},
    tint:{color:'#ff8a55',amount:0.13},night:0
  },
  night:{
    light:{azimuth:160,polar:45,color:'#e2e8f6',intensity:0.35},
    sky:{sky:'#050a18',horizon:'#1c2b4b',fog:'#121a2c'},
    // Per-role strength: dark ground, lighter streets (street lighting),
    // buildings in between, vehicles kept readable.
    tint:{color:'#0b1328',amount:0.62,roles:{ground:0.8,road:0.5,building:0.52,vehicle:0.3}},night:1
  }
});

export const WEATHER_PRESETS=Object.freeze({
  clear:{tint:null,lightScale:1},
  fog:{tint:{color:'#c8cdd5',amount:0.2},lightScale:0.8,haze:0.55},
  rain:{tint:{color:'#4f5967',amount:0.28},lightScale:0.7,haze:0.2},
  snow:{tint:{color:'#c9d1dd',amount:0.3},lightScale:0.85,haze:0.22}
});

const lerp=(a,b,t)=>a+(b-a)*t;
export const TINT_ROLES=['ground','road','building','vehicle'];
export function roleAmount(tint,role){
  if(!tint)return 0;
  const r=tint.roles&&tint.roles[role];
  return r==null?tint.amount:r;
}
function lerpAngle(a,b,t){
  let d=((b-a)%360+540)%360-180;
  return (a+d*t+360)%360;
}
export function blendLighting(a,b,t){
  return {
    light:{
      azimuth:lerpAngle(a.light.azimuth,b.light.azimuth,t),
      polar:lerp(a.light.polar,b.light.polar,t),
      color:mixHex(a.light.color,b.light.color,t),
      intensity:lerp(a.light.intensity,b.light.intensity,t)
    },
    sky:{
      sky:mixHex(a.sky.sky,b.sky.sky,t),
      horizon:mixHex(a.sky.horizon,b.sky.horizon,t),
      fog:mixHex(a.sky.fog,b.sky.fog,t)
    },
    tint:{
      // Blend a "no tint" preset through its own colour at zero strength.
      color:a.tint.amount===0?b.tint.color:b.tint.amount===0?a.tint.color:mixHex(a.tint.color,b.tint.color,t),
      amount:lerp(a.tint.amount,b.tint.amount,t),
      roles:Object.fromEntries(TINT_ROLES.map(r=>[r,lerp(roleAmount(a.tint,r),roleAmount(b.tint,r),t)]))
    },
    night:lerp(a.night||0,b.night||0,t)
  };
}

/* ------------------------------------------------------------- the sun */

/* Sun position (SunCalc / NOAA approximation). Degrees; azimuth clockwise
   from north, altitude above the horizon. */
export function sunPosition(date,lat,lng){
  const rad=Math.PI/180;
  const d=date.valueOf()/86400000-0.5+2440588-2451545;
  const M=rad*(357.5291+0.98560028*d);
  const C=rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M));
  const L=M+C+rad*102.9372+Math.PI;
  const e=rad*23.4397;
  const dec=Math.asin(Math.sin(e)*Math.sin(L));
  const ra=Math.atan2(Math.sin(L)*Math.cos(e),Math.cos(L));
  const lw=rad*-lng,phi=rad*lat;
  const H=rad*(280.16+360.9856235*d)-lw-ra;
  const altitude=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H));
  const az=Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi));
  return {altitude:altitude/rad,azimuth:(az/rad+180+360)%360};
}

/* Lighting for a real sun position: night below -6 deg, dawn/dusk through
   twilight and the low sun, full day above about 14 deg. The 3D light then
   comes from the real sun direction. */
export function lightingForSun({altitude,azimuth}){
  const P=LIGHTING_PRESETS;
  const low=azimuth<180?P.dawn:P.dusk;
  let base;
  if(altitude<=-6)base=P.night;
  else if(altitude<0)base=blendLighting(P.night,low,(altitude+6)/6);
  else if(altitude<14)base=blendLighting(low,P.day,altitude/14);
  else base=P.day;
  if(altitude>-2){
    base={...base,light:{...base.light,azimuth,polar:Math.max(12,Math.min(84,90-Math.max(0,altitude)))}};
  }
  return base;
}

export function presetForSun(sun){
  if(sun.altitude<=-6)return 'night';
  if(sun.altitude<6)return sun.azimuth<180?'dawn':'dusk';
  return 'day';
}

/* ------------------------------------------------------------- weather overlay */

function createWeatherOverlay(map){
  const container=map.getContainer();
  const canvas=document.createElement('canvas');
  canvas.className='mapWeatherOverlay';
  canvas.setAttribute('aria-hidden','true');
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1';
  const controls=container.querySelector('.maplibregl-control-container');
  container.insertBefore(canvas,controls||null);
  const ctx=canvas.getContext('2d');
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let mode='clear',night=0,particles=[],raf=null,last=0,w=0,h=0,dpr=1;

  function resize(){
    dpr=Math.min(2,globalThis.devicePixelRatio||1);
    w=container.clientWidth;h=container.clientHeight;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    seed();
  }
  function seed(){
    const area=w*h/(1400*800);
    const n=mode==='rain'?Math.round(420*area):mode==='snow'?Math.round(260*area):0;
    particles=[];
    for(let i=0;i<n;i++)particles.push(newParticle(true));
  }
  function newParticle(anywhere){
    if(mode==='rain'){
      return {x:Math.random()*(w+120)-60,y:anywhere?Math.random()*h:-30-Math.random()*60,
        len:12+Math.random()*12,speed:850+Math.random()*450,a:0.25+Math.random()*0.3};
    }
    return {x:Math.random()*w,y:anywhere?Math.random()*h:-10,r:0.9+Math.random()*1.9,
      speed:28+Math.random()*55,phase:Math.random()*Math.PI*2,sway:12+Math.random()*22,a:0.55+Math.random()*0.4};
  }
  function drawHaze(strength){
    if(!strength)return;
    // Distance haze: denser towards the top of a pitched view (far away).
    const pitch=map.getPitch()/70;
    const col=night>0.5?'26,34,52':mode==='fog'?'214,218,224':'170,178,190';
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,`rgba(${col},${(strength*(0.35+0.65*pitch)).toFixed(3)})`);
    g.addColorStop(1,`rgba(${col},${(strength*0.25).toFixed(3)})`);
    ctx.fillStyle=g;
    ctx.fillRect(0,0,w,h);
  }
  function draw(dt){
    ctx.clearRect(0,0,w,h);
    const preset=WEATHER_PRESETS[mode];
    drawHaze(preset.haze||0);
    if(mode==='rain'){
      ctx.lineCap='round';
      ctx.lineWidth=1.25;
      // Dark streaks on the pale daytime map, pale streaks at night.
      const tone=night>0.5?'190,205,230':'78,94,120';
      for(const p of particles){
        p.y+=p.speed*dt;p.x+=p.speed*dt*0.18;
        if(p.y-p.len>h||p.x>w+60)Object.assign(p,newParticle(false));
        ctx.strokeStyle=`rgba(${tone},${p.a})`;
        ctx.beginPath();
        ctx.moveTo(p.x,p.y);
        ctx.lineTo(p.x-p.len*0.18,p.y-p.len);
        ctx.stroke();
      }
    }else if(mode==='snow'){
      for(const p of particles){
        p.y+=p.speed*dt;p.phase+=dt*1.3;
        const x=p.x+Math.sin(p.phase)*p.sway;
        if(p.y>h+10)Object.assign(p,newParticle(false));
        ctx.fillStyle=`rgba(255,255,255,${p.a})`;
        ctx.strokeStyle=`rgba(110,122,145,${(p.a*0.55).toFixed(2)})`;
        ctx.lineWidth=0.8;
        ctx.beginPath();
        ctx.arc(x,p.y,p.r,0,Math.PI*2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  function frame(t){
    raf=requestAnimationFrame(frame);
    if(document.hidden){last=t;return;}
    const dt=last?Math.min(0.05,(t-last)/1000):0;
    last=t;
    draw(dt);
  }
  function redrawStatic(){if(raf===null)draw(0);}
  function setMode(next,nightAmount=0){
    mode=WEATHER_PRESETS[next]?next:'clear';
    night=nightAmount;
    seed();
    const animated=(mode==='rain'||mode==='snow')&&!reduced;
    if(animated&&raf===null){last=0;raf=requestAnimationFrame(frame);}
    if(!animated&&raf!==null){cancelAnimationFrame(raf);raf=null;}
    canvas.style.display=mode==='clear'?'none':'block';
    redrawStatic();
  }
  function setNight(amount){night=amount;redrawStatic();}
  resize();
  map.on('resize',()=>{resize();redrawStatic();});
  map.on('pitch',redrawStatic);
  setMode('clear');
  return {setMode,setNight};
}

/* ------------------------------------------------------------- controller */

export function createAtmosphere(map,{onTint=()=>{},onChange=()=>{}}={}){
  const overlay=createWeatherOverlay(map);
  let lighting='day',weather='clear';
  let current=LIGHTING_PRESETS.day;
  let anim=null,liveTimer=null,lastTintAt=0,lastSun=null;

  function targetLighting(){
    if(lighting==='live'){
      const c=map.getCenter();
      lastSun=sunPosition(new Date(),c.lat,c.lng);
      return lightingForSun(lastSun);
    }
    return LIGHTING_PRESETS[lighting]||LIGHTING_PRESETS.day;
  }

  function tintsFor(state){
    const w=WEATHER_PRESETS[weather];
    return [state.tint,w.tint].filter(t=>t&&t.amount>0);
  }

  function apply(state,{forceTint=true}={}){
    const w=WEATHER_PRESETS[weather];
    try{
      map.setLight({
        anchor:'map',
        position:[1.15,state.light.azimuth,state.light.polar],
        color:state.light.color,
        intensity:Math.max(0.05,state.light.intensity*w.lightScale)
      });
    }catch(error){console.warn('Light not supported',error);}
    try{
      const fog=weather==='fog';
      map.setSky({
        'sky-color':tintHex(state.sky.sky,w.tint?[w.tint]:[]),
        'horizon-color':tintHex(state.sky.horizon,w.tint?[w.tint]:[]),
        'fog-color':fog?'#d6dae0':state.sky.fog,
        'sky-horizon-blend':0.6,
        'horizon-fog-blend':fog?0.95:0.6,
        'fog-ground-blend':fog?0.2:0.6,
        'atmosphere-blend':0
      });
    }catch(error){console.warn('Sky not supported',error);}
    const now=performance.now();
    if(forceTint||now-lastTintAt>110){
      lastTintAt=now;
      onTint(tintsFor(state));
    }
    overlay.setNight(state.night||0);
  }

  function transitionTo(target,duration=900){
    if(anim)cancelAnimationFrame(anim);
    const from=current;
    const start=performance.now();
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduced||duration<=0){current=target;apply(target);return;}
    const step=t=>{
      const k=Math.min(1,(t-start)/duration);
      const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      current=blendLighting(from,target,e);
      apply(current,{forceTint:k>=1});
      if(k<1)anim=requestAnimationFrame(step);
      else{anim=null;current=target;}
    };
    anim=requestAnimationFrame(step);
  }

  function setLighting(mode){
    lighting=['dawn','day','dusk','night','live'].includes(mode)?mode:'day';
    clearInterval(liveTimer);liveTimer=null;
    if(lighting==='live'){
      liveTimer=setInterval(()=>{transitionTo(targetLighting(),2000);onChange(state());},60000);
    }
    transitionTo(targetLighting());
    onChange(state());
  }

  function setWeather(mode){
    weather=WEATHER_PRESETS[mode]?mode:'clear';
    overlay.setMode(weather,current.night||0);
    apply(current);
    onChange(state());
  }

  function state(){
    return {
      lighting,weather,
      sun:lighting==='live'?lastSun:null,
      livePreset:lighting==='live'&&lastSun?presetForSun(lastSun):null,
      tints:tintsFor(current)
    };
  }

  apply(current);
  return {setLighting,setWeather,state,get tints(){return tintsFor(current);}};
}
