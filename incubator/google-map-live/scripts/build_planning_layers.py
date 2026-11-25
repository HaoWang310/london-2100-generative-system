"""Planning layers of the London map, clipped to the 70 km study circle.

  python3 scripts/build_planning_layers.py <source folder> <output folder>

Reads rail.geojson, aonb.geojson and green_belt.geojson (the files of incubator/loop-city-real-map/assets, 21 Nov 2026)
and writes them cut to the study circle: lines are cut where they cross it, polygons are clipped edge by edge, points
outside are dropped. highspeed.geojson (HS1, HS2) is copied whole on purpose: HS2 is kept to Birmingham.

The circle is the one of scripts/map_core.js makeCircleGeoJson (Charing Cross, 70 km, R = 6378137), as a polygon of
720 sides, so no cut point is more than 0.7 m inside the true circle. Standard library only."""
import json,math,sys
C=(51.50733434456047,-0.12768375058439654);RAD=70000;R=6378137;N=720
def circle(steps=N):
    la1=math.radians(C[0]);lo1=math.radians(C[1]);d=RAD/R;out=[]
    for i in range(steps):
        b=2*math.pi*i/steps
        la2=math.asin(math.sin(la1)*math.cos(d)+math.cos(la1)*math.sin(d)*math.cos(b))
        lo2=lo1+math.atan2(math.sin(b)*math.sin(d)*math.cos(la1),math.cos(d)-math.sin(la1)*math.sin(la2))
        out.append((math.degrees(lo2),math.degrees(la2)))
    return out
POLY=circle()
# CCW? compute signed area
A=sum(POLY[i][0]*POLY[(i+1)%N][1]-POLY[(i+1)%N][0]*POLY[i][1] for i in range(N))
if A<0: POLY=POLY[::-1]
EDGES=[(POLY[i],POLY[(i+1)%N]) for i in range(N)]
def side(p,a,b): return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
def inside(p): return all(side(p,a,b)>=0 for a,b in EDGES)
# fast inside via distance with small tolerance band then exact
def hav(p):
    la1=math.radians(C[0]);la2=math.radians(p[1]);dl=la2-la1;dn=math.radians(p[0]-C[1])
    h=math.sin(dl/2)**2+math.cos(la1)*math.cos(la2)*math.sin(dn/2)**2
    return 2*R*math.asin(math.sqrt(min(1,h)))
def ins(p):
    d=hav(p)
    if d<RAD-20: return True
    if d>RAD+20: return False
    return inside(p)
def clip_seg(p,q):
    # Cyrus-Beck against convex CCW polygon
    t0,t1=0.0,1.0;dx=q[0]-p[0];dy=q[1]-p[1]
    for a,b in EDGES:
        ex,ey=b[0]-a[0],b[1]-a[1]
        num=ex*(p[1]-a[1])-ey*(p[0]-a[0])   # side(p)
        den=ex*dy-ey*dx                       # d side / dt
        if den==0:
            if num<0: return None
            continue
        t=-num/den
        if den>0: t0=max(t0,t)
        else: t1=min(t1,t)
        if t0>t1: return None
    return ((p[0]+t0*dx,p[1]+t0*dy),(p[0]+t1*dx,p[1]+t1*dy),t0,t1)
def clip_line(coords):
    out=[];cur=[]
    for p,q in zip(coords,coords[1:]):
        pi,qi=ins(p),ins(q)
        if pi and qi:
            if not cur: cur=[tuple(p)]
            cur.append(tuple(q));continue
        r=clip_seg(p,q)
        if r is None:
            if cur: out.append(cur);cur=[]
            continue
        a,b,t0,t1=r
        if not cur: cur=[a]
        cur.append(b)
        if t1<1: out.append(cur);cur=[]
    if cur: out.append(cur)
    return [l for l in out if len(l)>=2]
def clip_ring(ring):
    pts=[tuple(p) for p in ring[:-1]] if ring[0]==ring[-1] else [tuple(p) for p in ring]
    if all(ins(p) for p in pts): return [list(p) for p in pts]+[list(pts[0])]
    for a,b in EDGES:
        if not pts: break
        res=[]
        for i in range(len(pts)):
            P=pts[i-1];Q=pts[i];sp=side(P,a,b);sq=side(Q,a,b)
            if sq>=0:
                if sp<0: t=sp/(sp-sq);res.append((P[0]+t*(Q[0]-P[0]),P[1]+t*(Q[1]-P[1])))
                res.append(Q)
            elif sp>=0:
                t=sp/(sp-sq);res.append((P[0]+t*(Q[0]-P[0]),P[1]+t*(Q[1]-P[1])))
        pts=res
    if len(pts)<3: return None
    return [list(p) for p in pts]+[list(pts[0])]
def rnd(x): 
    if isinstance(x,(list,tuple)):
        if x and isinstance(x[0],(int,float)): return [round(x[0],6),round(x[1],6)]
        return [rnd(y) for y in x]
    return x
def geom_lines(g):
    if g['type']=='LineString': return [g['coordinates']]
    if g['type']=='MultiLineString': return g['coordinates']
    raise ValueError(g['type'])
def geom_polys(g):
    if g['type']=='Polygon': return [g['coordinates']]
    if g['type']=='MultiPolygon': return g['coordinates']
    raise ValueError(g['type'])
def clip_fc(fc):
    out=[]
    for f in fc['features']:
        g=f['geometry'];t=g['type']
        if t=='Point':
            if ins(g['coordinates']): out.append(f)
        elif 'LineString' in t:
            ls=[l for c in geom_lines(g) for l in clip_line(c)]
            if ls: out.append({**f,'geometry':{'type':'MultiLineString' if len(ls)>1 else 'LineString','coordinates':rnd(ls if len(ls)>1 else ls[0])}})
        else:
            ps=[]
            for poly in geom_polys(g):
                outer=clip_ring(poly[0])
                if not outer: continue
                holes=[h for h in (clip_ring(r) for r in poly[1:]) if h]
                ps.append([outer]+holes)
            if ps: out.append({**f,'geometry':{'type':'MultiPolygon' if len(ps)>1 else 'Polygon','coordinates':rnd(ps if len(ps)>1 else ps[0])}})
    return {**fc,'features':out}
if __name__=='__main__':
    import os,shutil
    src,out=sys.argv[1],sys.argv[2]
    os.makedirs(out,exist_ok=True)
    for name in ('rail','aonb','green_belt'):
        fc=json.load(open(os.path.join(src,name+'.geojson')))
        o=clip_fc(fc)
        json.dump(o,open(os.path.join(out,name+'.geojson'),'w'),separators=(',',':'))
        print(name,len(fc['features']),'->',len(o['features']))
    shutil.copyfile(os.path.join(src,'highspeed.geojson'),os.path.join(out,'highspeed.geojson'))
    print('highspeed copied whole')
