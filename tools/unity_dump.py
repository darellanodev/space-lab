"""Reader for the text dumps made by Unity 4.5 binary2text.exe (scene, prefab, mat, anim files)."""
import re

_HEAD = re.compile(r'^ID: (-?\d+) \(ClassID: (\d+)\) (.*)$')
_PATH = re.compile(r'^path\((\d+)\): "(.*)" GUID: (\w+) Type: (\d+)')
_NUM = re.compile(r'^(.+) (\S+) \((float|int|unsigned int|SInt16|UInt8|bool|SInt64|UInt64|UInt16|SInt8)\)$')
_STR = re.compile(r'^(.+?) ("(?:.*)") \((?:string|FastPropertyName)\)$')
_VEC = re.compile(r'^(.+?) \(([-\d.eE+ naifN]+)\) \((Vector[234]f|ColorRGBA|Quaternionf)\)$')
_PPTR = re.compile(r'^(.+?) \(file (-?\d+) path (-?\d+)\)( \(PPtr<[^>]*>\))?$')
_CONT = re.compile(r'^(.+?)  \(([^()]+)\)$')


def _num(raw, typ):
    if typ == 'float':
        return float(raw)
    try:
        return int(raw)
    except ValueError:
        return float(raw)


def _parse_block(lines):
    """Parses lines (with tab indentation) into nested dict. Repeated keys become lists."""
    root = {}
    multi = {}
    stack = [(-1, root, 0)]
    for line in lines:
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip('\t'))
        text = line.strip('\t').rstrip()
        container = False
        m = _PPTR.match(text)
        if m:
            key, val = m.group(1), {'file': int(m.group(2)), 'id': int(m.group(3))}
        elif _STR.match(text):
            m = _STR.match(text)
            key, val = m.group(1), m.group(2)[1:-1]
        elif _VEC.match(text):
            m = _VEC.match(text)
            key, val = m.group(1), [float(x) for x in m.group(2).split()]
        elif _NUM.match(text):
            m = _NUM.match(text)
            key, val = m.group(1), _num(m.group(2), m.group(3))
        elif _CONT.match(text):
            m = _CONT.match(text)
            key, val, container = m.group(1), {}, True
        else:
            continue
        key = key.replace(' ', '_')
        while stack and stack[-1][0] >= indent:
            stack.pop()
        parent = stack[-1][1]
        pid = id(parent)
        if key in parent:
            if (pid, key) not in multi:
                parent[key] = [parent[key]]
                multi[(pid, key)] = True
            parent[key].append(val)
        else:
            parent[key] = val
        if container:
            stack.append((indent, val, 0))
    return root


def parse_dump(text):
    """Returns (external_refs, objects). external_refs: {index: guid}. objects: {id: {...}}."""
    refs = {}
    objects = {}
    cur = None
    buf = []

    def flush():
        if cur is not None:
            body = _parse_block(buf)
            objects[cur[0]] = {'id': cur[0], 'class': cur[1], 'type': cur[2], 'p': body}

    for line in text.splitlines():
        h = _HEAD.match(line)
        if h:
            flush()
            cur = (int(h.group(1)), int(h.group(2)), h.group(3).strip())
            buf = []
            continue
        if cur is None:
            m = _PATH.match(line)
            if m:
                refs[int(m.group(1))] = m.group(3)
            continue
        buf.append(line)
    flush()
    return refs, objects
