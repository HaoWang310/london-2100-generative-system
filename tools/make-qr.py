"""London 2100 · the site's QR code (24 Nov 2026).
A static code: the address itself is in the picture, no third party, so it never expires and needs no change when the
app does. Regenerate only if the address changes (the repository renamed or moved, the user name changed).

    python3 tools/make-qr.py            # writes assets/qr/

Needs OpenCV (cv2) and Pillow; the card's fonts are DM Sans and Noto Sans CJK SC (paths below, as on Linux).
Every picture is read back with OpenCV's decoder, at full size and at a quarter, before it is kept."""
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'qr')
os.makedirs(OUT, exist_ok=True)
J = lambda f: os.path.join(OUT, f)
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont
URL='https://haowang310.github.io/london-2100-generative-system/'
p=cv2.QRCodeEncoder_Params(); p.correction_level=cv2.QRCodeEncoder_CORRECT_LEVEL_Q
enc=cv2.QRCodeEncoder.create(p); m=enc.encode(URL)          # 1 px per module, with quiet zone
m=(m<128)                                                     # True = dark module
# trim the encoder's own margin, keep the exact module grid
ys,xs=np.where(m); m=m[ys.min():ys.max()+1, xs.min():xs.max()+1]; N=m.shape[0]
print('modules',N)
Q=4                                                           # quiet zone, modules
# --- QR only: PNG + SVG
S=2400; mod=S//(N+2*Q); side=mod*(N+2*Q)
img=Image.new('RGB',(side,side),'white'); d=ImageDraw.Draw(img)
for y in range(N):
    for x in range(N):
        if m[y,x]: d.rectangle([(x+Q)*mod,(y+Q)*mod,(x+Q+1)*mod-1,(y+Q+1)*mod-1],fill='black')
img.save(J('london-2100-qr.png'))
def svg_path(off):
    return ''.join(f'M{x+off} {y+off}h1v1h-1z' for y in range(N) for x in range(N) if m[y,x])
W=N+2*Q
open(J('london-2100-qr.svg'),'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" shape-rendering="crispEdges"><rect width="{W}" height="{W}" fill="#fff"/><path d="{svg_path(Q)}" fill="#000"/></svg>')
# --- card: black, white tile, title
CW,CH=2400,3050
font='/usr/share/fonts/truetype/google-fonts/ofl/dmsans/DMSans[opsz,wght].ttf'
def F(sz,w):
    f=ImageFont.truetype(font,sz)
    try: f.set_variation_by_axes([14,w])
    except Exception:
        try: f.set_variation_by_axes([w])
        except Exception: pass
    return f
card=Image.new('RGB',(CW,CH),'#000'); d=ImageDraw.Draw(card)
tile=1700; tx=(CW-tile)//2; ty=620
d.rounded_rectangle([tx,ty,tx+tile,ty+tile],radius=90,fill='#ffffff')
mod2=tile//(N+2*Q); qside=mod2*(N+2*Q); ox=tx+(tile-qside)//2; oy=ty+(tile-qside)//2
for y in range(N):
    for x in range(N):
        if m[y,x]: d.rectangle([ox+(x+Q)*mod2,oy+(y+Q)*mod2,ox+(x+Q+1)*mod2-1,oy+(y+Q+1)*mod2-1],fill='#000')
def ctext(t,y,f,fill):
    w=d.textlength(t,font=f); d.text(((CW-w)/2,y),t,font=f,fill=fill)
ctext('LONDON 2100',250,F(190,700),'#f5f5f7')
ctext('Multi-Scale Generative Urban System',470,F(64,400),(245,245,247,150) if False else '#8e8e93')
ctext('多尺度城市生成系统',2420,ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc',72,index=2),'#f5f5f7')
ctext('Scan to open',2560,F(60,400),'#8e8e93')
ctext('haowang310.github.io/london-2100-generative-system',2800,F(52,400),'#6e6e73')
card.save(J('london-2100-qr-card.png'))
# SVG card (vector QR; text in DM Sans)
qs=1700/W
open(J('london-2100-qr-card.svg'),'w').write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CW} {CH}"><rect width="{CW}" height="{CH}" fill="#000"/>
<g font-family="DM Sans, Helvetica Neue, Arial, sans-serif" text-anchor="middle">
<text x="{CW/2}" y="420" font-size="190" font-weight="700" fill="#f5f5f7">LONDON 2100</text>
<text x="{CW/2}" y="530" font-size="64" fill="#8e8e93">Multi-Scale Generative Urban System</text>
<text x="{CW/2}" y="2490" font-size="72" font-weight="500" fill="#f5f5f7" font-family="PingFang SC, Noto Sans SC, sans-serif">多尺度城市生成系统</text>
<text x="{CW/2}" y="2615" font-size="60" fill="#8e8e93">Scan to open</text>
<text x="{CW/2}" y="2850" font-size="52" fill="#6e6e73">haowang310.github.io/london-2100-generative-system</text></g>
<rect x="{tx}" y="{ty}" width="{tile}" height="{tile}" rx="90" fill="#fff"/>
<g transform="translate({tx} {ty}) scale({qs})" shape-rendering="crispEdges"><path d="{svg_path(Q)}" fill="#000"/></g></svg>''')
# --- verify by decoding
det=cv2.QRCodeDetector()
for f in [J('london-2100-qr.png'),J('london-2100-qr-card.png')]:
    im=cv2.imread(f); small=cv2.resize(im,(im.shape[1]//4,im.shape[0]//4),interpolation=cv2.INTER_AREA)
    for name,x in [('full',im),('quarter',small)]:
        val,_,_=det.detectAndDecode(x); print(f,name,'OK' if val==URL else 'FAIL',repr(val))
