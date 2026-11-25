import numpy as np, scipy.sparse as sp, scipy.sparse.linalg as sla
s3=np.sqrt(3)
# Evolver 初始几何：五条直线边界（顶点 3 未使用）
V0={1:(0,0,0),2:(-.5,0,0),4:(0,0,1),5:(-.5,0,1),6:(0,-s3/2,1)}
loop=[1,2,5,6,4]                      # face 1 = edges 1..5: 1-2, 2-5, 5-6, 6-4, 4-1
P=[np.array(V0[i],float) for i in loop]; c=np.mean(P,0)
verts=P+[c]; tris=[(i,(i+1)%5,5) for i in range(5)]
bedge={ (i,(i+1)%5):i+1 for i in range(5)}  # boundary edge id = original edge number
verts=np.array(verts); tris=np.array(tris)
# 每个顶点记录所在原始边（0 = 内部）；角点属于两条边，用 set
vorig=[{1,5},{1,2},{2,3},{3,4},{4,5},set()]
def refine(verts,tris,vorig):
    verts=list(verts); vorig=list(vorig); mid={}
    def m(a,b):
        k=(min(a,b),max(a,b))
        if k not in mid:
            verts.append((np.asarray(verts[a])+np.asarray(verts[b]))/2)
            common=vorig[a]&vorig[b]; vorig.append(set(common) if common else set())
            mid[k]=len(verts)-1
        return mid[k]
    nt=[]
    for a,b,c_ in tris:
        ab,bc,ca=m(a,b),m(b,c_),m(c_,a)
        nt+=[(a,ab,ca),(ab,b,bc),(ca,bc,c_),(ab,bc,ca)]
    return np.array(verts),np.array(nt),vorig
def cot_laplacian(V,T):
    I=[];J=[];W=[]
    for (a,b,c_) in [(0,1,2),(1,2,0),(2,0,1)]:
        i,j,k=T[:,a],T[:,b],T[:,c_]
        u=V[i]-V[k]; v=V[j]-V[k]
        cot=np.einsum('ij,ij->i',u,v)/np.linalg.norm(np.cross(u,v),axis=1)
        I+= [i,j]; J+=[j,i]; W+=[cot/2,cot/2]
    I=np.concatenate(I);J=np.concatenate(J);W=np.concatenate(W)
    n=len(V); Lm=sp.coo_matrix((W,(I,J)),shape=(n,n)).tocsr()
    Lm=Lm-sp.diags(np.asarray(Lm.sum(1)).ravel())
    return -Lm   # 正定刚度矩阵
def area(V,T): return 0.5*np.linalg.norm(np.cross(V[T[:,1]]-V[T[:,0]],V[T[:,2]]-V[T[:,0]]),axis=1).sum()
def plateau(levels=5,iters=60):
    V,T,vo=verts.copy(),tris.copy(),list(vorig)
    for _ in range(levels): V,T,vo=refine(V,T,vo)
    bnd=np.array([len(s)>0 for s in vo]); inn=~bnd
    for it in range(iters):
        L=cot_laplacian(V,T)
        A=L[inn][:,inn]; B=L[inn][:,bnd]
        rhs=-B@V[bnd]
        V2=V.copy(); V2[inn]=sla.spsolve(A.tocsc(),rhs)
        d=np.abs(V2-V).max(); V=V2
        if d<1e-9: break
    return V,T,vo,it,d
def conjugate(V,T):
    L=cot_laplacian(V,T); n=len(V); Vs=np.zeros_like(V)
    for k in range(3):
        u=V[:,k]; rhs=np.zeros(n)
        # rhs_i = Σ_f (u_k - u_j)/2，(i,j,k) 为三角形逆时针顺序
        for (a,b,c_) in [(0,1,2),(1,2,0),(2,0,1)]:
            i,j,kk=T[:,a],T[:,b],T[:,c_]
            np.add.at(rhs,i,(u[kk]-u[j])/2)
        A=L.tolil(); A[0,:]=0; A[0,0]=1; rhs[0]=0
        Vs[:,k]=sla.spsolve(A.tocsc(),rhs)
    return Vs
if __name__=='__main__':
    V,T,vo,it,d=plateau(5)
    print('verts',len(V),'tris',len(T),'iters',it,'last move',d,'area',area(V,T))
    Vs=conjugate(V,T)
    # 检查：原始边 → 伴随曲面上的平面曲线
    planes={1:np.array([1,0,0.]),2:np.array([0,0,1.]),3:np.array([.5,-s3/2,0]),4:np.array([0,1,0.]),5:np.array([0,0,1.])}
    for e,nrm in planes.items():
        idx=[i for i,s in enumerate(vo) if e in s]
        vals=Vs[idx]@nrm; print('edge',e,'plane value mean %.5f spread %.2e'%(vals.mean(),vals.max()-vals.min()))
    np.savez('tr_patch.npz',V=V,T=T,Vs=Vs,vo=np.array([sorted(s) if s else [0] for s in vo],dtype=object))
