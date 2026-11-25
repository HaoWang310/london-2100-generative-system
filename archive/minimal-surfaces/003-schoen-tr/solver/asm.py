import numpy as np, sys
s3=np.sqrt(3)
def load():
    d=np.load('tr_patch.npz',allow_pickle=True); return d['V'],d['T'],d['Vs'],d['vo']
def shift(Vs,vo):
    def avg(e,f): idx=[i for i,s in enumerate(vo) if e in s]; return np.mean([f(Vs[i]) for i in idx])
    r1=avg(1,lambda p:p[0]); r2=avg(2,lambda p:p[2]); r3=avg(3,lambda p:.5*p[0]-s3/2*p[1]); r4=avg(4,lambda p:p[1]); r5=avg(5,lambda p:p[2])
    W=Vs.copy()
    dz=r2; r5-=dz; W[:,2]-=dz
    dy=r4; r3+=s3/2*dy; W[:,1]-=dy
    dx=r3*2; r1-=dx; W[:,0]-=dx
    return W,r1,r5
def H(m,t=(0,0,0)):
    M=np.eye(4); M[:3,:3]=m; M[:3,3]=t; return M
def gens(r1,r5):
    a=H(np.diag([1,1,-1.])); b=H(np.diag([1,-1,1.]))
    c=H(np.array([[.5,s3/2,0],[s3/2,-.5,0],[0,0,1]]))
    d=H(np.diag([1,1,-1.]),(0,0,2*r5)); e=H(np.diag([-1,1,1.]),(2*r1,0,0))
    return dict(a=a,b=b,c=c,d=d,e=e)
def texpr(s,G):
    S=[np.eye(4)]
    for ch in s:
        new=[G[ch]@t for t in S]; S=S+new
        u=[]; keys=set()
        for t in S:
            k=tuple(np.round(t,6).ravel())
            if k not in keys: keys.add(k); u.append(t)
        S=u
    return S
if __name__=='__main__':
    V,T,Vs,vo=load(); W,r1,r5=shift(Vs,vo)
    G=gens(r1,r5); full=texpr('abcbcbc',G); seven=texpr('abcbcbcecbcbc',G)
    print('rhs1',r1,'rhs5',r5,'full',len(full),'seven',len(seven))
    print('patch bbox',W.min(0).round(3),W.max(0).round(3))
