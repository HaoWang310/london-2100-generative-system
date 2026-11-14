/* Instanced 3D tree renderer (custom WebGL layer for MapLibre).
 *
 * Organic low-poly tree models are generated procedurally once:
 *   broadleaf - tapered trunk with two branches and a crown of 6-7 lumpy
 *               leaf clumps (noise-displaced icospheres),
 *   conifer   - trunk with five drooping tiers,
 *   columnar  - tall, narrow poplar-like crown.
 * Every tree is one GPU instance (position, height, rotation, colour), so
 * thousands of trees cost a handful of draw calls. Leaves are lit by the
 * current sun direction with a sky/ground ambient term and baked occlusion
 * (darker inside and underneath), which gives the soft, clumpy look.
 */

/* ------------------------------------------------------------ mesh maths */

function icosphere(){
  const t=(1+Math.sqrt(5))/2;
  let v=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]]
    .map(p=>{const l=Math.hypot(...p);return p.map(c=>c/l);});
  let f=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  // One subdivision: 42 vertices, 80 faces.
  const cache=new Map();
  const mid=(a,b)=>{
    const k=a<b?a+'_'+b:b+'_'+a;
    if(cache.has(k))return cache.get(k);
    const p=v[a].map((c,i)=>(c+v[b][i])/2);
    const l=Math.hypot(...p);
    v.push(p.map(c=>c/l));
    cache.set(k,v.length-1);
    return v.length-1;
  };
  const nf=[];
  for(const [a,b,c] of f){
    const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
    nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
  }
  return {v,f:nf};
}
const ICO=icosphere();

function hashNoise(x,y,z,seed){
  const s=Math.sin(x*12.9898+y*78.233+z*37.719+seed*4.1)*43758.5453;
  return s-Math.floor(s);
}
function smoothNoise(p,seed){
  // Sum of a few sines: smooth, cheap, deterministic.
  const [x,y,z]=p;
  return 0.5*Math.sin(x*3.1+seed)*Math.cos(y*2.7+seed*1.3)
    +0.3*Math.sin(z*4.3+x*1.7+seed*2.1)
    +0.2*Math.cos(y*5.1-z*2.3+seed*0.7);
}

class MeshBuilder{
  constructor(){this.pos=[];this.nor=[];this.col=[];}
  tri(a,b,c,na,nb,nc,ca,cb,cc){
    this.pos.push(...a,...b,...c);
    this.nor.push(...na,...nb,...nc);
    this.col.push(...ca,...cb,...cc);
  }
  /* Noise-displaced ellipsoid clump. */
  clump(cx,cy,cz,rx,ry,rz,seed,leaf,occl){
    const pts=ICO.v.map(n=>{
      const d=1+0.22*smoothNoise(n,seed)+0.08*(hashNoise(n[0],n[1],n[2],seed)-0.5);
      return [cx+n[0]*rx*d,cy+n[1]*ry*d,cz+n[2]*rz*d];
    });
    // Smooth normals of the displaced shape.
    const nrm=pts.map(()=>[0,0,0]);
    for(const [a,b,c] of ICO.f){
      const A=pts[a],B=pts[b],C=pts[c];
      const u=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],w=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
      const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
      for(const i of [a,b,c]){nrm[i][0]+=n[0];nrm[i][1]+=n[1];nrm[i][2]+=n[2];}
    }
    for(const n of nrm){const l=Math.hypot(...n)||1;n[0]/=l;n[1]/=l;n[2]/=l;}
    const cols=ICO.v.map((n,i)=>{
      // Baked occlusion: darker underneath and towards the tree's core.
      const under=0.62+0.38*(n[2]*0.5+0.5);
      const core=occl(pts[i]);
      const jitter=0.92+0.16*hashNoise(n[0],n[1],n[2],seed+9);
      const k=under*core*jitter;
      return [leaf[0]*k,leaf[1]*k,leaf[2]*k];
    });
    for(const [a,b,c] of ICO.f)this.tri(pts[a],pts[b],pts[c],nrm[a],nrm[b],nrm[c],cols[a],cols[b],cols[c]);
  }
  /* Tapered cylinder from p0 (radius r0) to p1 (radius r1). */
  limb(p0,p1,r0,r1,color,sides=6){
    const d=[p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]];
    const len=Math.hypot(...d);
    const ax=d.map(c=>c/len);
    let ref=Math.abs(ax[2])<0.9?[0,0,1]:[1,0,0];
    const u=[ax[1]*ref[2]-ax[2]*ref[1],ax[2]*ref[0]-ax[0]*ref[2],ax[0]*ref[1]-ax[1]*ref[0]];
    const ul=Math.hypot(...u);u.forEach((c,i)=>u[i]=c/ul);
    const w=[ax[1]*u[2]-ax[2]*u[1],ax[2]*u[0]-ax[0]*u[2],ax[0]*u[1]-ax[1]*u[0]];
    const ring=(p,r,k)=>{
      const a=k/sides*Math.PI*2;
      const n=[u[0]*Math.cos(a)+w[0]*Math.sin(a),u[1]*Math.cos(a)+w[1]*Math.sin(a),u[2]*Math.cos(a)+w[2]*Math.sin(a)];
      return [[p[0]+n[0]*r,p[1]+n[1]*r,p[2]+n[2]*r],n];
    };
    const dark=color.map(c=>c*0.78);
    for(let k=0;k<sides;k++){
      const [a0,n0]=ring(p0,r0,k),[a1,n1]=ring(p0,r0,k+1),[b0]=ring(p1,r1,k),[b1]=ring(p1,r1,k+1);
      this.tri(a0,a1,b1,n0,n1,n1,dark,dark,color);
      this.tri(a0,b1,b0,n0,n1,n0,dark,color,color);
    }
  }
  /* Cone tier for conifers. */
  cone(cx,cy,z0,z1,r,seed,leaf,sides=9){
    const apex=[cx,cy,z1];
    for(let k=0;k<sides;k++){
      const a0=k/sides*Math.PI*2,a1=(k+1)/sides*Math.PI*2;
      const j0=1+0.12*Math.sin(a0*3+seed),j1=1+0.12*Math.sin(a1*3+seed);
      // Drooping tips: the rim sits slightly below z0 at the points.
      const p0=[cx+Math.cos(a0)*r*j0,cy+Math.sin(a0)*r*j0,z0-0.02*j0];
      const p1=[cx+Math.cos(a1)*r*j1,cy+Math.sin(a1)*r*j1,z0-0.02*j1];
      const slope=r/(z1-z0);
      const n0=[Math.cos(a0),Math.sin(a0),slope],n1=[Math.cos(a1),Math.sin(a1),slope];
      const nn=v=>{const l=Math.hypot(...v);return v.map(c=>c/l);};
      const dark=leaf.map(c=>c*0.7),light=leaf.map(c=>c*1.08);
      this.tri(p0,p1,apex,nn(n0),nn(n1),[0,0,1],dark,dark,light);
      // Underside.
      this.tri(p1,p0,[cx,cy,z0+0.03],[0,0,-1],[0,0,-1],[0,0,-1],leaf.map(c=>c*0.45),leaf.map(c=>c*0.45),leaf.map(c=>c*0.45));
    }
  }
  build(){
    return {
      position:new Float32Array(this.pos),normal:new Float32Array(this.nor),color:new Float32Array(this.col),
      count:this.pos.length/3
    };
  }
}

const BARK=[0.36,0.27,0.2];
// Muted olive / sage foliage like park trees seen from above.
const LEAF=[0.34,0.43,0.24];
const NEEDLE=[0.21,0.33,0.22];

/* Unit-height tree models (1 = tree height). */
export function buildTreeModels(){
  // Broadleaf.
  const b=new MeshBuilder();
  b.limb([0,0,0],[0,0,0.46],0.04,0.024,BARK,7);
  b.limb([0,0,0.3],[0.14,0.05,0.5],0.018,0.01,BARK,5);
  b.limb([0,0,0.34],[-0.12,-0.09,0.54],0.017,0.009,BARK,5);
  b.limb([0,0,0.38],[0.02,0.15,0.58],0.015,0.008,BARK,5);
  const coreB=p=>0.6+0.4*Math.min(1,Math.hypot(p[0],p[1],(p[2]-0.64)*1.3)/0.32);
  // A fuller, rounder crown of overlapping clumps reaching lower down.
  const clumps=[
    [0,0,0.66,0.3,0.3,0.26],[0.18,0.05,0.55,0.19,0.19,0.16],[-0.17,-0.06,0.56,0.2,0.19,0.16],
    [0.04,-0.18,0.58,0.18,0.18,0.15],[-0.04,0.18,0.6,0.18,0.18,0.15],[0.13,-0.11,0.72,0.17,0.17,0.15],
    [-0.12,0.12,0.74,0.17,0.17,0.15],[0.05,0.03,0.86,0.19,0.19,0.14],[-0.09,-0.09,0.8,0.15,0.15,0.13]
  ];
  clumps.forEach(([x,y,z,rx,ry,rz],i)=>b.clump(x,y,z,rx,ry,rz,i*1.7+0.3,LEAF,coreB));
  // Conifer.
  const c=new MeshBuilder();
  c.limb([0,0,0],[0,0,0.3],0.026,0.016,BARK,6);
  const tiers=[[0.16,0.46,0.25],[0.32,0.62,0.2],[0.48,0.77,0.15],[0.63,0.9,0.1],[0.78,1,0.055]];
  tiers.forEach(([z0,z1,r],i)=>c.cone(0,0,z0,z1,r,i*2.3,NEEDLE.map(v=>v*(0.92+i*0.04))));
  // Columnar (poplar-like).
  const p=new MeshBuilder();
  p.limb([0,0,0],[0,0,0.3],0.028,0.018,BARK,6);
  const coreP=q=>0.75+0.25*Math.min(1,Math.hypot(q[0]*2.2,q[1]*2.2,(q[2]-0.6)*0.9)/0.3);
  [[0,0,0.48,0.12,0.12,0.22],[0.02,0.01,0.7,0.11,0.11,0.22],[-0.01,0.02,0.88,0.075,0.075,0.12],
    [0.04,-0.03,0.58,0.08,0.08,0.14]].forEach(([x,y,z,rx,ry,rz],i)=>p.clump(x,y,z,rx,ry,rz,i*3.1+1,LEAF.map(v=>v*0.95),coreP));
  return {broadleaf:b.build(),conifer:c.build(),columnar:p.build()};
}

/* -------------------------------------------------------------- the layer */

const VS=`#version 300 es
in vec3 a_pos;in vec3 a_normal;in vec3 a_color;
in vec4 a_inst;   // x, y (m, relative to origin; y north), height (m), yaw
in vec4 a_tint;   // rgb colour factor, crown width factor
uniform mat4 u_matrix;
out vec3 v_color;out vec3 v_normal;
void main(){
  float c=cos(a_inst.w),s=sin(a_inst.w);
  vec3 p=a_pos;
  p.xy*=a_tint.w;
  p*=a_inst.z;
  p.xy=mat2(c,s,-s,c)*p.xy;
  vec3 n=a_normal;
  n.xy=mat2(c,s,-s,c)*n.xy;
  gl_Position=u_matrix*vec4(a_inst.x+p.x,a_inst.y+p.y,p.z,1.0);
  v_color=a_color*a_tint.rgb;
  v_normal=normalize(n);
}`;
const FS=`#version 300 es
precision highp float;
in vec3 v_color;in vec3 v_normal;
uniform vec3 u_sun;        // direction towards the sun (east, north, up)
uniform vec3 u_light;      // sun colour x intensity
uniform vec3 u_sky;uniform vec3 u_ground;
uniform vec4 u_tint;       // rgb tint colour, strength
out vec4 o;
void main(){
  vec3 n=normalize(v_normal);
  float d=max(dot(n,u_sun),0.0);
  // Soft wrap so the shadowed side is not black.
  float wrap=max((dot(n,u_sun)+0.35)/1.35,0.0);
  vec3 amb=mix(u_ground,u_sky,n.z*0.5+0.5);
  vec3 c=v_color*(amb+u_light*(0.5*d+0.3*wrap));
  c=mix(c,u_tint.rgb*0.6+c*0.4,u_tint.a);
  o=vec4(c,1.0);
}`;

function multiply(a,b){
  const o=new Float64Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++){
    let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;
  }
  return o;
}
const hexRgb=h=>{const n=parseInt(String(h).replace('#',''),16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];};

export function createTreeRenderer(map,maplibregl,{id='urban-trees-3d-models',beforeId=()=>undefined}={}){
  let gl=null,prog=null,models=null,loc=null;
  const groups={};            // variant -> {vao, instBuf, count}
  let origin=null;            // MercatorCoordinate of the instance origin
  let originLngLat=null;
  let visible=true;
  let sun={azimuth:210,altitude:60,color:'#ffffff',intensity:0.5,night:0};
  let tint={color:'#000000',amount:0};
  let pending=null;

  const compile=(t,src)=>{const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};

  function upload(list){
    if(!gl){pending=list;return;}
    if(!list.length){for(const g of Object.values(groups))g.count=0;return;}
    originLngLat=list.origin;
    origin=maplibregl.MercatorCoordinate.fromLngLat(originLngLat);
    const by={broadleaf:[],conifer:[],columnar:[]};
    for(const t of list)by[t.variant]?.push(t);
    for(const [variant,arr] of Object.entries(by)){
      const g=groups[variant];
      const data=new Float32Array(arr.length*8);
      arr.forEach((t,i)=>{
        data.set([t.x,t.y,t.h,t.yaw,t.tint[0],t.tint[1],t.tint[2],t.width],i*8);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER,g.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
      g.count=arr.length;
    }
    map.triggerRepaint();
  }

  const layer={
    id,type:'custom',renderingMode:'3d',
    onAdd(_m,context){
      gl=context;
      if(typeof gl.createVertexArray!=='function'){gl=null;console.warn('Trees need WebGL2');return;}
      prog=gl.createProgram();
      gl.attachShader(prog,compile(gl.VERTEX_SHADER,VS));
      gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FS));
      gl.linkProgram(prog);
      if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));
      loc={
        pos:gl.getAttribLocation(prog,'a_pos'),normal:gl.getAttribLocation(prog,'a_normal'),
        color:gl.getAttribLocation(prog,'a_color'),inst:gl.getAttribLocation(prog,'a_inst'),
        tint:gl.getAttribLocation(prog,'a_tint'),
        matrix:gl.getUniformLocation(prog,'u_matrix'),sun:gl.getUniformLocation(prog,'u_sun'),
        light:gl.getUniformLocation(prog,'u_light'),sky:gl.getUniformLocation(prog,'u_sky'),
        ground:gl.getUniformLocation(prog,'u_ground'),utint:gl.getUniformLocation(prog,'u_tint')
      };
      models=models||buildTreeModels();
      const prevVao=gl.getParameter(gl.VERTEX_ARRAY_BINDING);
      for(const [variant,mesh] of Object.entries(models)){
        const vao=gl.createVertexArray();
        gl.bindVertexArray(vao);
        const bind=(data,where,size)=>{
          const b=gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
          gl.enableVertexAttribArray(where);gl.vertexAttribPointer(where,size,gl.FLOAT,false,0,0);
          return b;
        };
        bind(mesh.position,loc.pos,3);bind(mesh.normal,loc.normal,3);bind(mesh.color,loc.color,3);
        const instBuf=gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,instBuf);
        gl.enableVertexAttribArray(loc.inst);gl.vertexAttribPointer(loc.inst,4,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(loc.inst,1);
        gl.enableVertexAttribArray(loc.tint);gl.vertexAttribPointer(loc.tint,4,gl.FLOAT,false,32,16);gl.vertexAttribDivisor(loc.tint,1);
        groups[variant]={vao,instBuf,count:0,vertices:mesh.count};
      }
      gl.bindVertexArray(prevVao);
      if(pending){const p=pending;pending=null;upload(p);}
    },
    onRemove(){gl=null;},
    render(context,args){
      if(!gl||!visible||!origin)return;
      const total=Object.values(groups).reduce((n,g)=>n+g.count,0);
      if(!total)return;
      const mvp=args?.modelViewProjectionMatrix;
      if(!mvp)return;
      const ws=512*Math.pow(2,map.getZoom());
      const ppm=origin.meterInMercatorCoordinateUnits()*ws;
      // Local metres (x east, y north, z up) -> world pixels; MapLibre's matrix takes z in metres.
      const T=new Float64Array([ppm,0,0,0, 0,-ppm,0,0, 0,0,1,0, origin.x*ws,origin.y*ws,0,1]);
      const m=new Float32Array(multiply(mvp,T));
      const prevVao=gl.getParameter(gl.VERTEX_ARRAY_BINDING);
      gl.useProgram(prog);
      gl.uniformMatrix4fv(loc.matrix,false,m);
      const az=sun.azimuth*Math.PI/180,alt=Math.max(4,sun.altitude)*Math.PI/180;
      gl.uniform3f(loc.sun,Math.sin(az)*Math.cos(alt),Math.cos(az)*Math.cos(alt),Math.sin(alt));
      const lc=hexRgb(sun.color),li=(0.45+0.9*sun.intensity)*(1-0.55*sun.night);
      gl.uniform3f(loc.light,lc[0]*li,lc[1]*li,lc[2]*li);
      const amb=1-0.6*sun.night;
      gl.uniform3f(loc.sky,0.5*amb,0.54*amb,0.6*amb);
      gl.uniform3f(loc.ground,0.24*amb,0.25*amb,0.22*amb);
      const tc=hexRgb(tint.color);
      gl.uniform4f(loc.utint,tc[0],tc[1],tc[2],Math.min(0.85,tint.amount));
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
      gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
      for(const g of Object.values(groups)){
        if(!g.count)continue;
        gl.bindVertexArray(g.vao);
        gl.drawArraysInstanced(gl.TRIANGLES,0,g.vertices,g.count);
      }
      gl.bindVertexArray(prevVao);
    }
  };

  function ensure(){
    if(!map.getLayer(id)){
      try{map.addLayer(layer,beforeId());}catch(error){console.warn('Tree renderer unavailable',error);}
    }
  }
  ensure();

  return {
    /* trees: [{lng,lat,h,yaw,variant,tint:[r,g,b],width}] */
    setTrees(trees,originLL){
      const list=[];
      if(trees.length){
        const kx=40075016.686*Math.cos(originLL[1]*Math.PI/180)/360,ky=40075016.686/360;
        for(const t of trees){
          list.push({...t,x:(t.lng-originLL[0])*kx,y:(t.lat-originLL[1])*ky});
        }
      }
      list.origin=originLL;
      upload(list);
    },
    setSun(next){sun={...sun,...next};map.triggerRepaint();},
    setTint(next){tint=next||{color:'#000000',amount:0};map.triggerRepaint();},
    setVisible(on){visible=Boolean(on);ensure();map.triggerRepaint();},
    remove(){if(map.getLayer(id))map.removeLayer(id);}
  };
}
