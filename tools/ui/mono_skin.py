#!/usr/bin/env python3
"""Make a black-and-white interface layer from an app's own stylesheet.

  python3 tools/ui/mono_skin.py <app.css> <skin.css> [--skip REGEX]

For every rule of the stylesheet that sets a colour it writes the same rule again, prefixed with `html.l2ui`, with
each colour put onto the shared tokens (shared/ui/tokens.css). Every colour-bearing rule is rewritten, in the same
order, so the cascade among the rewritten rules is the cascade of the original.

  fills    light -> white; a saturated mid tone (an accent) -> white; everything else -> black (alpha kept)
  text     by lightness: white, 72 %, 60 %, 50 % white; dark text -> black; text of an `error` rule -> the warning red
  edges    light or accent -> white; faint -> the divider; the rest -> the control border
  a chosen state (.active, .on, aria-pressed, :checked) that had a fill -> solid white
  a fill that becomes white gets black text, a fill that becomes black gets white text, unless the rule sets its own

Left alone: gradients (keys to the map), anything matching --skip, @keyframes and @font-face.
"""
import re, sys

TOK = dict(ink='#fff', ink2='var(--l2-ink2)', ink3='var(--l2-ink3)', ink4='var(--l2-ink4)', bd='var(--l2-bd)',
           line='var(--l2-line)', warn='var(--l2-warn)')
COL = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)')
NAMED = {'white': (255, 255, 255, 1), 'black': (0, 0, 0, 1)}


def parse(c):
    c = c.strip().lower()
    if c in NAMED: return NAMED[c]
    m = re.match(r'#([0-9a-f]{3,8})$', c)
    if m:
        h = m.group(1)
        if len(h) in (3, 4): h = ''.join(x * 2 for x in h)
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), (int(h[6:8], 16) / 255 if len(h) == 8 else 1)
    m = re.match(r'rgba?\(([^)]+)\)', c)
    if m:
        p = [x for x in re.split(r'[ ,/]+', m.group(1).strip()) if x]
        try: return float(p[0]), float(p[1]), float(p[2]), (float(p[3]) if len(p) > 3 else 1)
        except ValueError: return None
    return None


def lum(p): return (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]) / 255
def sat(p): return max(p[:3]) - min(p[:3])
def a2(a): return ('%.2f' % a).rstrip('0').rstrip('.')


def fill(p):
    a = p[3]
    if a < 0.04: return 'transparent', None
    L = lum(p)
    if L > 0.8 or (sat(p) > 70 and L > 0.38):
        return ('#fff' if a > 0.97 else 'rgba(255,255,255,%s)' % a2(a)), ('white' if a > 0.5 else None)
    return ('#000' if a > 0.97 else 'rgba(0,0,0,%s)' % a2(a)), ('black' if a > 0.5 else None)


def text(p, err):
    if err: return TOK['warn']
    L = lum(p)
    if L < 0.25: return '#000'
    if L > 0.86: return TOK['ink']
    if L > 0.68: return TOK['ink2']
    if L > 0.5: return TOK['ink3']
    return TOK['ink4']


def edge(p):
    a, L = p[3], lum(p)
    if a < 0.04: return 'transparent'
    if L > 0.8 and a > 0.5: return '#fff'
    if sat(p) > 70 and L > 0.45: return '#fff' if a > 0.5 else TOK['bd']
    if a < 0.2 or L < 0.12: return TOK['line']
    return TOK['bd']


def glow(p):
    if sat(p) > 70 and lum(p) > 0.3: return 'rgba(255,255,255,%s)' % a2(min(1, p[3]))
    return None


def remap(prop, val, err):
    """-> (new value or None, 'white' / 'black' / None for a fill)"""
    if 'gradient' in val or 'url(' in val: return None, None
    cols = COL.findall(val)
    if not cols and val.strip().lower() not in NAMED: return None, None
    kind = None

    def sub(m):
        nonlocal kind
        p = parse(m.group(0))
        if not p: return m.group(0)
        if prop in ('background', 'background-color'):
            v, k = fill(p); kind = k; return v
        if prop in ('color', '-webkit-text-fill-color', 'caret-color'): return text(p, err)
        if prop == 'box-shadow': return glow(p) or m.group(0)
        if prop in ('fill', 'stroke'): return text(p, err)
        return edge(p)
    if not cols:
        p = NAMED[val.strip().lower()]
        return (fill(p)[0] if prop.startswith('background') else text(p, err)), None
    new = COL.sub(sub, val)
    return (new if new != val else (new if prop.startswith('background') or prop == 'color' else None)), kind


CHOSEN = re.compile(r'\.active\b|\.on\b|\.selected\b|\.current\b|\[aria-pressed="?true"?\]|\[aria-selected="?true"?\]|:checked')
PROPS = re.compile(r'^(color|background|background-color|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|box-shadow|fill|stroke|caret-color|-webkit-text-fill-color)$')


def rule(sel, body, skip):
    if skip:                                   # per selector of a list, not the whole list
        sel = ', '.join(x for x in sel.split(',') if x.strip() and not skip.search(x))
        if not sel: return ''
    err = bool(re.search(r'error|warn|danger', sel, re.I))
    out, kinds, has_color = [], [], False
    for d in body.split(';'):
        if ':' not in d: continue
        prop, val = d.split(':', 1); prop = prop.strip().lower(); val = val.strip()
        imp = ' !important' if '!important' in val else ''
        val = val.replace('!important', '').strip()
        if not PROPS.match(prop): continue
        new, kind = remap(prop, val, err)
        if new is None: continue
        # a chosen state that was told apart by a lighter grey fill: solid white instead
        if prop in ('background', 'background-color') and kind == 'black' and CHOSEN.search(re.sub(r':not\([^)]*\)', '', sel)) and not re.search(r'::(before|after)', sel):
            new, kind = '#fff', 'white'
        if prop == 'color': has_color = True
        if kind: kinds.append(kind)
        out.append('%s:%s%s' % (prop, new, imp))
    if not out: return ''
    if kinds and not has_color:
        out.append('color:%s' % ('#000' if kinds[-1] == 'white' else '#fff'))
    elif kinds and has_color and kinds[-1] == 'white':
        out = [o for o in out if not o.startswith('color:')] + ['color:#000']
    sels = ', '.join('html.l2ui ' + s.strip() if not re.match(r'^(html|:root)\b', s.strip()) else 'html.l2ui' + re.sub(r'^(html|:root)', '', s.strip())
                     for s in sel.split(',') if s.strip())
    return '%s { %s; }\n' % (sels, '; '.join(out))


def blocks(css):
    """top-level (prelude, body) pairs; body of an @media keeps its inner rules"""
    i, n, out = 0, len(css), []
    while i < n:
        j = css.find('{', i)
        if j < 0: break
        pre = css[i:j].strip(); depth, k = 1, j + 1
        while k < n and depth:
            depth += css[k] == '{'; depth -= css[k] == '}'; k += 1
        out.append((pre, css[j + 1:k - 1])); i = k
    return out


def build(css, skip):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out = []
    for pre, body in blocks(css):
        if pre.startswith('@media') or pre.startswith('@supports'):
            inner = ''.join(rule(re.sub(r'\s+', ' ', p), b, skip) for p, b in blocks(body) if not p.startswith('@'))
            if inner: out.append('%s {\n%s}\n' % (re.sub(r'\s+', ' ', pre), inner))
        elif pre.startswith('@'): continue
        else: out.append(rule(re.sub(r'\s+', ' ', pre), body, skip))
    return ''.join(out)


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    skip = re.compile(sys.argv[sys.argv.index('--skip') + 1]) if '--skip' in sys.argv else None
    res = build(open(src, encoding='utf8').read(), skip)
    head = ''
    if '--head' in sys.argv: head = open(sys.argv[sys.argv.index('--head') + 1], encoding='utf8').read()
    tail = ''
    if '--tail' in sys.argv: tail = open(sys.argv[sys.argv.index('--tail') + 1], encoding='utf8').read()
    open(dst, 'w', encoding='utf8').write(head + res + tail)
    print(dst, res.count('\n'), 'rules')
