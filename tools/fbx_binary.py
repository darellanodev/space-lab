"""Minimal reader for binary FBX files (only what the animation baker needs)."""
import struct, zlib, sys
def parse(path):
    d=open(path,'rb').read(); ver=struct.unpack_from('<I',d,23)[0]; big=ver>=7500
    def node(o):
        if big: end,n,pl,nl=struct.unpack_from('<QQQB',d,o); o+=25
        else: end,n,pl,nl=struct.unpack_from('<IIIB',d,o); o+=13
        if end==0: return None,o
        name=d[o:o+nl].decode('latin1'); o+=nl; props=[]
        for _ in range(n):
            t=chr(d[o]); o+=1
            if t=='Y': props.append(struct.unpack_from('<h',d,o)[0]); o+=2
            elif t=='C': props.append(d[o]); o+=1
            elif t=='I': props.append(struct.unpack_from('<i',d,o)[0]); o+=4
            elif t=='F': props.append(struct.unpack_from('<f',d,o)[0]); o+=4
            elif t=='D': props.append(struct.unpack_from('<d',d,o)[0]); o+=8
            elif t=='L': props.append(struct.unpack_from('<q',d,o)[0]); o+=8
            elif t in 'fdlib':
                ln,enc,cl=struct.unpack_from('<III',d,o); o+=12
                sz={'f':4,'d':8,'l':8,'i':4,'b':1}[t]
                raw=d[o:o+cl]; o+=cl
                if enc: raw=zlib.decompress(raw)
                props.append((t,ln,raw))
            elif t=='S': ln=struct.unpack_from('<I',d,o)[0]; o+=4; props.append(d[o:o+ln]); o+=ln
            elif t=='R': ln=struct.unpack_from('<I',d,o)[0]; o+=4; props.append(d[o:o+ln]); o+=ln
        kids=[]
        while o<end:
            k,o=node(o)
            if k is None: continue
            kids.append(k)
        return (name,props,kids),end
    o=27; top=[]
    while o<len(d)-200:
        n,o=node(o)
        if n is None: break
        top.append(n)
    return top
