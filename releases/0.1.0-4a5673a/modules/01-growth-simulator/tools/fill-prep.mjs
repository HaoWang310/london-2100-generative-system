// Writes the model's final cells, DRAIL and rails to a work folder for fill-strips.py.
// node modules/01-growth-simulator/tools/fill-prep.mjs <workdir>
import fs from 'node:fs'; import zlib from 'node:zlib';
const G = new URL('../../../incubator/growth-simulator-dark/', import.meta.url).pathname;
const OUT = process.argv[2] || '.'; process.chdir(OUT);
const D=new Function(fs.readFileSync(G+'data/meta.js','utf8')+';return D;')();
const C=new Function(fs.readFileSync(G+'codec.js','utf8')+';return GRIDCODEC;')();
const M=D.meta, N=M.NX*M.NY;
const dr=C.decode('DRAIL', zlib.inflateSync(fs.readFileSync(G+D.arr.DRAIL)).buffer.slice(0), M, D.enc);
fs.writeFileSync('drail.u16', Buffer.from(dr));
// cells
const idx=new Uint32Array(zlib.inflateSync(fs.readFileSync(G+'data/final-idx.z')).buffer.slice(0));
const cls=new Uint8Array(zlib.inflateSync(fs.readFileSync(G+'data/final-cls.z')));
const off=D.final.off, out=new Uint8Array(N*4); for(let i=0;i<N;i++){out[i*4+1]=255;out[i*4+2]=255;out[i*4+3]=255;}
let y=0; for(let k=0;k<idx.length;k++){ while(y<off.length-2&&k>=off[y+1]) y++; const q=idx[k]*4,c=cls[k]; if(out[q]===0){out[q]=c;out[q+1]=y;} if(c===2&&out[q+2]===255) out[q+2]=y; if(c===3&&out[q+3]===255) out[q+3]=y; }
fs.writeFileSync('cells.u8', out);
fs.writeFileSync('meta.json', JSON.stringify({M:{XMIN:M.XMIN,YMAX:M.YMAX,C:M.C,NX:M.NX,NY:M.NY,LON:M.LON,NODES:M.NODES}, rails:D.rails, bitsPath:D.arr.BITS, zonePath:D.arr.ZONE}));
console.log(Object.keys(D.rails), D.rails.orbital.length, D.rails.radials.length, D.rails.high_speed.length, Object.keys(D.rails).map(k=>k+':'+(Array.isArray(D.rails[k])?D.rails[k].length:typeof D.rails[k])).join(' '));
