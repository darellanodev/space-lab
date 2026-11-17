"""Bakes the animations of a Blender (Rigify) FBX into a clean JSON file.

Why: the FBX curves are sparse (each axis has its own key times). Three.js FBXLoader holds the
last value instead of interpolating, and the character loses head, hands and feet.
Here every bone is sampled at a fixed frame rate with linear interpolation per axis.
Only the bones that deform the mesh (and their parents) are kept.

Usage: python tools/bake_animations.py <character.fbx> <out.json> [fps]
"""
import collections
import json
import math
import os
import re
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fbx_binary import parse  # noqa: E402

TICKS = 46186158000  # FBX time units per second


def nm(b):
    return b.split(b'\x00')[0].decode('latin1') if isinstance(b, bytes) else str(b)


def sanitize(name):  # same as THREE.PropertyBinding.sanitizeNodeName
    return re.sub(r'[\[\].:/]', '', re.sub(r'\s', '_', name))


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)


def euler_to_quat(e):
    """FBX Euler (degrees, order XYZ: X is applied first) -> quaternion (x, y, z, w)."""
    x, y, z = [math.radians(v) / 2 for v in e]
    qx = (math.sin(x), 0, 0, math.cos(x))
    qy = (0, math.sin(y), 0, math.cos(y))
    qz = (0, 0, math.sin(z), math.cos(z))
    return qmul(qz, qmul(qy, qx))


def main():
    src, out = sys.argv[1], sys.argv[2]
    fps = int(sys.argv[3]) if len(sys.argv) > 3 else 30
    top = parse(src)
    objs = [n for n in top if n[0] == 'Objects'][0]
    cons = [n for n in top if n[0] == 'Connections'][0]
    byid = {n[1][0]: n for n in objs[2] if n[1] and isinstance(n[1][0], int)}
    models = {i: n for i, n in byid.items() if n[0] == 'Model'}

    def props(n):
        d = {}
        for k in n[2]:
            if k[0] == 'Properties70':
                for p in k[2]:
                    d[nm(p[1][0])] = list(p[1][4:])
        return d
    P = {i: props(n) for i, n in models.items()}
    conn, up, parent = collections.defaultdict(list), collections.defaultdict(list), {}
    for c in cons[2]:
        if c[0] != 'C':
            continue
        ch, pa = c[1][1], c[1][2]
        prop = nm(c[1][3]) if len(c[1]) > 3 else None
        conn[pa].append((ch, prop))
        up[ch].append((pa, prop))
        if ch in models and pa in models:
            parent[ch] = pa

    # Bones that deform the mesh, and all their parents
    keep = set()
    cbone = {}
    for pa, lst in conn.items():
        for ch, _ in lst:
            if pa in byid and byid[pa][0] == 'Deformer' and ch in models:
                cbone[pa] = ch
    for d in byid.values():
        if d[0] == 'Deformer' and nm(d[1][2]) == 'Cluster':
            kids = {k[0]: k for k in d[2]}
            if 'Indexes' in kids and kids['Indexes'][1][0][1] > 0 and d[1][0] in cbone:
                x = cbone[d[1][0]]
                while x is not None:
                    keep.add(x)
                    x = parent.get(x)

    def curve(cid):
        ts = vs = None
        for k in byid[cid][2]:
            if k[0] == 'KeyTime':
                ts = np.array(struct.unpack('<%dq' % k[1][0][1], k[1][0][2])) / TICKS
            if k[0] == 'KeyValueFloat':
                vs = np.array(struct.unpack('<%df' % k[1][0][1], k[1][0][2]), dtype=float)
        return ts, vs

    result = {'fps': fps, 'clips': {}}
    for sid, st in byid.items():
        if st[0] != 'AnimationStack':
            continue
        cname = nm(st[1][1]).split('|')[-1].lower()
        layers = [ch for ch, _ in conn[sid] if ch in byid and byid[ch][0] == 'AnimationLayer']
        nodes = [ch for l in layers for ch, _ in conn[l] if ch in byid and byid[ch][0] == 'AnimationCurveNode']
        per_bone = collections.defaultdict(dict)  # model id -> {prop: {axis index: (t, v)}}
        duration = 0.0
        for cn in nodes:
            targets = [(pa, prop) for pa, prop in up[cn] if pa in models and pa in keep]
            if not targets:
                continue
            mid, prop = targets[0]
            axes = {}
            for cid, axis in conn[cn]:
                if cid in byid and byid[cid][0] == 'AnimationCurve' and axis:
                    ts, vs = curve(cid)
                    axes[{'d|X': 0, 'd|Y': 1, 'd|Z': 2}[axis]] = (ts, vs)
                    duration = max(duration, float(ts[-1]))
            per_bone[mid][prop] = axes
        frames = int(round(duration * fps)) + 1
        times = np.arange(frames) / fps
        tracks = []
        for mid, propmap in per_bone.items():
            rec = {'bone': sanitize(nm(models[mid][1][1]))}
            for prop, key, default in (('Lcl Translation', 'pos', [0, 0, 0]), ('Lcl Rotation', 'rot', [0, 0, 0]),
                                       ('Lcl Scaling', 'scale', [1, 1, 1])):
                axes = propmap.get(prop)
                if not axes:
                    continue
                rest = P[mid].get(prop, default)[:3]
                cols = []
                for a in range(3):
                    if a in axes:
                        ts, vs = axes[a]
                        cols.append(np.interp(times, ts, vs))
                    else:
                        cols.append(np.full(frames, float(rest[a])))
                data = np.stack(cols, axis=1)  # frames x 3
                if np.abs(data - np.array(rest)).max() < 1e-5:
                    continue  # does not move: no track needed
                if key == 'rot':
                    q = np.array([euler_to_quat(r) for r in data])
                    for i in range(1, frames):  # keep the quaternions continuous
                        if np.dot(q[i - 1], q[i]) < 0:
                            q[i] = -q[i]
                    data = q
                rec[key] = [round(float(v), 5) for v in data.reshape(-1)]
            if len(rec) > 1:
                tracks.append(rec)
        result['clips'][cname] = {'duration': round(duration, 4), 'frames': frames, 'tracks': tracks}
        print(f'{cname}: {frames} frames, {duration:.2f}s, {len(tracks)} bones')
    with open(out, 'w') as f:
        json.dump(result, f, separators=(',', ':'))
    print(out, round(os.path.getsize(out) / 1024), 'KB')


if __name__ == '__main__':
    main()
