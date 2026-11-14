"""Converts a Unity 4.5 scene dump (made with binary2text.exe) to a JSON level for the web game.

Usage:
  python tools/unity2json.py scene <scene.unity.txt> <out.json> <meta_source> [<meta_source> ...]
  python tools/unity2json.py materials <out.json> <meta_source> ... --mats <dir with *.mat.txt>

Every <meta_source> is a folder with *.meta files, or a guids.txt file (made with
`grep -rH "^guid:" --include=*.meta Assets > guids.txt`), used to map GUID -> asset name.
Coordinates are converted from Unity (left-handed) to Three.js by mirroring X:
  position (x, y, z) -> (-x, y, z)     rotation (x, y, z, w) -> (x, -y, -z, w)
"""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from unity_dump import parse_dump  # noqa: E402

STD_KEYS = {'m_ObjectHideFlags', 'm_PrefabParentObject', 'm_PrefabInternal', 'm_GameObject',
            'm_Enabled', 'm_EditorHideFlags', 'm_Script', 'm_Name', 'm_EditorClassIdentifier'}


def load_guids(dirs):
    guids, recycle = {}, {}
    for d in dirs:
        if d.endswith('.txt'):
            for line in open(d, encoding='utf8', errors='ignore'):
                m = re.match(r'^(.*?)\.meta:guid: (\w+)', line.strip())
                if m:
                    guids.setdefault(m.group(2), os.path.basename(m.group(1).replace('\\', '/')))
            continue
        for f in glob.glob(os.path.join(d, '**', '*.meta'), recursive=True):
            t = open(f, 'rb').read().decode('utf8', 'ignore')
            m = re.search(r'^guid: (\w+)', t, re.M)
            if not m:
                continue
            guids[m.group(1)] = os.path.basename(f)[:-5]
            names = dict(re.findall(r'^\s+(\d+): (.+)$', t, re.M))
            if names:
                recycle[m.group(1)] = {int(k): v.strip() for k, v in names.items()}
    return guids, recycle


def mirror_pos(v):
    return [-v[0], v[1], v[2]]


def mirror_rot(q):
    return [q['x'], -q['y'], -q['z'], q['w']]


def as_list(v):
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


class Converter:
    def __init__(self, refs, objs, guids, recycle):
        self.refs, self.objs, self.guids, self.recycle = refs, objs, guids, recycle
        self.unresolved = {}

    def asset(self, ptr, role):
        """PPtr to an external asset -> {'file': name, 'sub': name or None}."""
        if not ptr or ptr['id'] == 0:
            return None
        if ptr['file'] == 0:
            return {'local': ptr['id']}
        guid = self.refs.get(ptr['file'])
        name = self.guids.get(guid)
        if name is None:
            self.unresolved.setdefault(guid, set()).add(role)
            return {'guid': guid}
        sub = self.recycle.get(guid, {}).get(ptr['id'])
        out = {'file': name}
        if sub and not sub.startswith('//'):
            out['sub'] = sub
        return out

    def value(self, v, role):
        if isinstance(v, dict) and set(v) == {'file', 'id'}:
            if v['file'] == 0:
                return {'ref': v['id']} if v['id'] else None
            return self.asset(v, role)
        if isinstance(v, dict):
            return {k: self.value(x, role) for k, x in v.items()}
        if isinstance(v, list):
            return [self.value(x, role) for x in v]
        return v

    def component(self, o):
        p, cls = o['p'], o['class']
        c = {'enabled': p.get('m_Enabled', 1)}
        if cls == 33:
            c.update(type='MeshFilter', mesh=self.asset(p['m_Mesh'], 'mesh'))
        elif cls in (23, 137):
            mats = as_list(p.get('m_Materials', {}).get('data'))
            c.update(type='SkinnedMeshRenderer' if cls == 137 else 'MeshRenderer',
                     materials=[self.asset(m, 'material') for m in mats],
                     lightmap=p.get('m_LightmapIndex'), tiling=p.get('m_LightmapTilingOffset'),
                     castShadows=p.get('m_CastShadows'))
            if cls == 137:
                c['mesh'] = self.asset(p.get('m_Mesh'), 'mesh')
        elif cls == 212:
            c.update(type='SpriteRenderer', sprite=self.asset(p.get('m_Sprite'), 'sprite'),
                     color=p.get('m_Color'))
        elif cls == 65:
            c.update(type='BoxCollider', trigger=p['m_IsTrigger'], size=p['m_Size'],
                     center=mirror_pos(p['m_Center']))
        elif cls == 64:
            c.update(type='MeshCollider', trigger=p.get('m_IsTrigger', 0),
                     mesh=self.asset(p.get('m_Mesh'), 'colliderMesh'))
        elif cls in (135, 136):
            c.update(type='SphereCollider' if cls == 135 else 'CapsuleCollider', trigger=p['m_IsTrigger'],
                     center=mirror_pos(p['m_Center']), radius=p.get('m_Radius'), height=p.get('m_Height'))
        elif cls == 143:
            c.update(type='CharacterController', height=p['m_Height'], radius=p['m_Radius'],
                     center=mirror_pos(p['m_Center']), slopeLimit=p.get('m_SlopeLimit'),
                     stepOffset=p.get('m_StepOffset'))
        elif cls == 54:
            c.update(type='Rigidbody', mass=p.get('m_Mass'), useGravity=p.get('m_UseGravity'),
                     isKinematic=p.get('m_IsKinematic'))
        elif cls == 108:
            c.update(type='Light', lightType=p.get('m_Type'), color=p.get('m_Color'),
                     intensity=p.get('m_Intensity'), range=p.get('m_Range'), spotAngle=p.get('m_SpotAngle'))
        elif cls == 20:
            c.update(type='Camera', fov=p.get('field_of_view'), near=p.get('near_clip_plane'),
                     far=p.get('far_clip_plane'), background=p.get('m_BackGroundColor'),
                     clearFlags=p.get('m_ClearFlags'), depth=p.get('m_Depth'))
        elif cls == 82:
            c.update(type='AudioSource', clip=self.asset(p.get('m_audioClip'), 'audio'),
                     loop=p.get('m_Loop'), playOnAwake=p.get('m_PlayOnAwake'), volume=p.get('m_Volume'))
        elif cls == 95:
            c.update(type='Animator', controller=self.asset(p.get('m_Controller'), 'controller'))
        elif cls == 131:
            c.update(type='GUITexture', texture=self.asset(p.get('m_Texture'), 'texture'),
                     color=p.get('m_Color'), pixelInset=p.get('m_PixelInset'))
        elif cls == 114:
            script = self.asset(p['m_Script'], 'script')
            props = {k: self.value(v, 'script:' + str(script and script.get('file')))
                     for k, v in p.items() if k not in STD_KEYS}
            c.update(type='Script', script=(script or {}).get('file') or (script or {}).get('guid'), props=props)
        elif cls in (198, 199):
            c.update(type='ParticleSystem' if cls == 198 else 'ParticleSystemRenderer')
        else:
            c['type'] = o['type']
        return c

    def node(self, tr_id):
        t = self.objs[tr_id]['p']
        go = self.objs[t['m_GameObject']['id']]
        g = go['p']
        comps = []
        for item in as_list(g['m_Component'].get('data')):
            ref = item['second']['id']
            if ref == tr_id or ref not in self.objs:
                continue
            comps.append(self.component(self.objs[ref]))
        kids = as_list(t['m_Children'].get('data'))
        return {
            'id': go['id'], 'name': g['m_Name'], 'tag': g['m_TagString'], 'layer': g['m_Layer'],
            'active': bool(g['m_IsActive']),
            'pos': mirror_pos(t['m_LocalPosition']), 'rot': mirror_rot(t['m_LocalRotation']),
            'scale': t['m_LocalScale'],
            'components': comps,
            'children': [self.node(k['id']) for k in kids if k['id'] in self.objs],
        }

    def scene(self):
        roots = [o for o in self.objs.values() if o['class'] == 4 and o['p']['m_Father']['id'] == 0]
        roots.sort(key=lambda o: o['p'].get('m_RootOrder', 0))
        settings = {}
        for o in self.objs.values():
            if o['class'] == 104:
                p = o['p']
                settings = {'ambient': p['m_AmbientLight'], 'fog': p['m_Fog'], 'fogColor': p['m_FogColor'],
                            'skybox': self.asset(p['m_SkyboxMaterial'], 'skybox')}
        return {'settings': settings, 'roots': [self.node(o['id']) for o in roots]}


def convert_materials(mat_dir, guids, recycle):
    """Reads all *.mat.txt files and returns {material file name: {color, textures...}}."""
    out = {}
    unresolved = set()
    for f in glob.glob(os.path.join(mat_dir, '**', '*.mat.txt'), recursive=True):
        refs, objs = parse_dump(open(f, encoding='utf8', errors='ignore').read())
        conv = Converter(refs, objs, guids, recycle)
        for o in objs.values():
            if o['class'] != 21:
                continue
            props = o['p']['m_SavedProperties']
            tex, colors, floats = {}, {}, {}
            for pair in as_list(props.get('m_TexEnvs', {}).get('data')):
                env = pair['second']
                t = conv.asset(env['m_Texture'], 'texture')
                if t:
                    tex[pair['first']] = {**t, 'scale': env.get('m_Scale'), 'offset': env.get('m_Offset')}
            for pair in as_list(props.get('m_Colors', {}).get('data')):
                colors[pair['first']] = pair['second']
            for pair in as_list(props.get('m_Floats', {}).get('data')):
                floats[pair['first']] = pair['second']
            out[os.path.basename(f)[:-4]] = {'name': o['p']['m_Name'], 'textures': tex, 'colors': colors,
                                             'floats': floats}
        unresolved |= set(conv.unresolved)
    return out, unresolved


def main():
    mode = sys.argv[1]
    if mode == 'materials':
        args = sys.argv[2:]
        i = args.index('--mats')
        out, metas, mats = args[0], args[1:i], args[i + 1]
        guids, recycle = load_guids(metas)
        data, unresolved = convert_materials(mats, guids, recycle)
        json.dump(data, open(out, 'w', encoding='utf8'), indent=1)
        print(f'{out}: {len(data)} materials; unresolved GUIDs: {sorted(unresolved)}')
        return
    src, out, *meta_dirs = sys.argv[2:]
    refs, objs = parse_dump(open(src, encoding='utf8', errors='ignore').read())
    guids, recycle = load_guids(meta_dirs)
    conv = Converter(refs, objs, guids, recycle)
    data = conv.scene()
    with open(out, 'w', encoding='utf8') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f'{out}: {len(objs)} objects')
    if conv.unresolved:
        print('Unresolved GUIDs (send the .meta files for them):')
        for g, roles in conv.unresolved.items():
            print(' ', g, sorted(roles))


if __name__ == '__main__':
    main()
