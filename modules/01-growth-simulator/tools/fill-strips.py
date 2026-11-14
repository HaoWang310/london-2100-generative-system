"""The illustrative fill beyond the growth model's grid, up to the 70 km study circle.

The model's 50 m grid (150 x 123 km) stops about 4 km short of the circle in the north and
13 km in the south, where it has no ground data. This continues the model's 2100 result across
those edges so the circle reads as one picture: every row beyond an edge mirrors the row as far
inside it (shifted sideways by a slow random amount so it does not read as a reflection), and
each mirrored parcel is kept with the probability of its class at the new place relative to the
old one -- learnt from the whole model by distance to the loop, distance to a station and side
of the loop -- so growth thins out away from the loop as it does in the model. Kept parcels
carry their source's years, so the fill grows over time too. It tapers out over the last
2.5 km inside the circle. Display only: not part of any total.

  node modules/01-growth-simulator/tools/fill-prep.mjs /tmp/fill
  python3 modules/01-growth-simulator/tools/fill-strips.py /tmp/fill
(numpy, scipy, opencv-python). Writes modules/01-growth-simulator/data/fill-strips.z:
deflate of (north rows, then south rows) x NX x 4 bytes, the same record as cells.js.
The row counts are fillRows() in overlay.js.
"""
import sys, os
WORK = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'fill-strips.z')
os.chdir(WORK)
import numpy as np, json, cv2, math, zlib
from scipy.ndimage import distance_transform_edt, gaussian_filter
m=json.load(open('meta.json')); M=m['M']; NX,NY,C=M['NX'],M['NY'],M['C']; XMIN,YMAX=M['XMIN'],M['YMAX']
LE,LN=M['LON']; R=70000
cells=np.fromfile('cells.u8',np.uint8).reshape(NY,NX,4)
nN=int(math.ceil((LN+R-YMAX)/C)); YMIN=YMAX-NY*C; nS=int(math.ceil((YMIN-(LN-R))/C))
NYx=NY+nN+nS; YMAXx=YMAX+nN*C
print('rows north',nN,'south',nS,'ext rows',NYx)
# features on the extended grid
def raster(lines, shape, ymax, closed=False):
    img=np.zeros(shape,np.uint8)
    for l in lines:
        pts=np.array([[(e-XMIN)/C,(ymax-n)/C] for e,n in l])
        cv2.polylines(img,[np.round(pts*16).astype(np.int32)],closed,1,1,cv2.LINE_8,4)
    return img
orb=m['rails']['orbital']
dorb=distance_transform_edt(raster(orb,(NYx,NX),YMAXx)==0)*C
# stations
st=np.zeros((NYx,NX),np.uint8)
for n in M['NODES']:
    c=int((n[2]-XMIN)/C); r=int((YMAXx-n[3])/C)
    if 0<=r<NYx and 0<=c<NX: st[r,c]=1
dst=distance_transform_edt(st==0)*C
# inside/outside the loop
poly=np.zeros((NYx,NX),np.uint8)
pts=np.array([[(e-XMIN)/C,(YMAXx-n)/C] for e,n in orb[0]])
cv2.fillPoly(poly,[np.round(pts).astype(np.int32)],1)
side=poly
yy,xx=np.mgrid[0:NYx,0:NX]
E=XMIN+(xx+0.5)*C; Nn=YMAXx-(yy+0.5)*C
rc=np.hypot(E-LE,Nn-LN)
model=np.zeros((NYx,NX),bool); model[nN:nN+NY]=True
target=(~model)&(rc<=R)
print('target km2', target.sum()*C*C/1e6)
# bins
def bins(dorb,dst,side):
    bo=np.minimum((dorb/500).astype(int),59); bs=np.minimum((dst/2000).astype(int),19)
    return (side.astype(int)*60+bo)*20+bs
B=bins(dorb,dst,side)
Bm=B[nN:nN+NY]
rec=cells.reshape(-1,4)
# category per model cell: final state
def cat(r):
    c=np.zeros(len(r),np.int8)
    c[(r[:,0]==4)]=1; c[(r[:,0]==5)]=2; c[(r[:,0]==1)]=3
    c[(r[:,2]!=255)]=4; c[(r[:,3]!=255)]=5
    return c
cm=cat(rec)
bm=Bm.ravel()
NB=2*60*20
# probability table with smoothing across neighbouring bins
cnt=np.zeros((NB,6)); np.add.at(cnt,(bm,cm),1)
cnt3=cnt.reshape(2,60,20,6)
from scipy.ndimage import uniform_filter
sm=np.stack([uniform_filter(cnt3[...,k],size=(1,3,3),mode='nearest') for k in range(6)],-1).reshape(NB,6)
tot=sm.sum(1,keepdims=True); P=np.where(tot>0, sm/np.maximum(tot,1e-9), np.array([1,0,0,0,0,0]))
# donor pools per (bin,cat) sorted by first year
order=np.lexsort((rec[:,1],cm,bm))
key=bm[order]*6+cm[order]
starts=np.searchsorted(key,np.arange(NB*6)); ends=np.searchsorted(key,np.arange(NB*6),side='right')
# coarse fallback pools per cat
gorder=[np.where(cm==k)[0][np.argsort(rec[cm==k,1],kind='stable')] for k in range(6)]
rng=np.random.default_rng(2100)
def vnoise(shape, scale, seed):
    r=np.random.default_rng(seed); gh,gw=int(shape[0]/scale)+3,int(shape[1]/scale)+3
    g=r.random((gh,gw)).astype(np.float32)
    return cv2.resize(g,(int(gw*scale),int(gh*scale)),interpolation=cv2.INTER_CUBIC)[:shape[0],:shape[1]]
keepn=np.clip(vnoise((NYx,NX),18,7)*0.7+vnoise((NYx,NX),5,8)*0.3,0,1)
# rank-transform keep noise to uniform over target
flat=keepn[target]; rk=np.empty_like(flat); rk[np.argsort(flat)]=np.arange(len(flat))/len(flat); U=np.zeros((NYx,NX)); U[target]=rk
shift=(vnoise((NYx,1),30,9)[:,0]-0.5)*60   # a slowly varying sideways shift of the mirror, in cells
taper=np.clip((R-rc)/2500,0,1)
out=np.zeros((NYx,NX,4),np.uint8); out[...,1:]=255
catgrid=cm.reshape(NY,NX)
for r in range(NYx):
    if model[r].any(): continue
    if r<nN: k=nN-r; src=nN-1+k            # rows beyond the north edge mirror rows inside it
    else: k=r-(nN+NY)+1; src=nN+NY-k
    srow=src-nN
    if not (0<=srow<NY): continue
    cols=np.where(target[r])[0]
    if not len(cols): continue
    sc=np.clip(np.round(cols+shift[r]).astype(int),0,NX-1)
    cs=catgrid[srow,sc]
    Bt=B[r,cols]; Bs=B[src,sc]
    pt=P[Bt,cs]; ps=P[Bs,cs]
    ratio=np.where(cs>0, np.minimum(1, pt/np.maximum(ps,1e-6)), 0)*taper[r,cols]
    keep=(cs>0)&(U[r,cols]<ratio)
    out[r,cols[keep]]=cells[srow,sc[keep]]
ext=np.zeros((NYx,NX,4),np.uint8); ext[...,1:]=255; ext[nN:nN+NY]=cells; ext[:nN]=out[:nN]; ext[nN+NY:]=out[nN+NY:]
strips=np.concatenate([out[:nN],out[nN+NY:]],0)
z=zlib.compress(strips.tobytes(),9); open(OUT,'wb').write(z)
print('fill bytes',len(z),'filled',(strips[...,0]>0).sum())
