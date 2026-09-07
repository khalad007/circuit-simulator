"""Small educational DC solver; siren and cross-coupled flip-flop are behavioral models."""
from collections import defaultdict, deque
import math

HANDLES = {kind: {"pos", "neg"} for kind in (
    "battery", "resistor", "led", "switch", "pushbutton", "capacitor",
    "speaker", "ldr", "voltmeter", "ammeter", "oscilloscope",
)}
HANDLES.update(transistor={"base", "collector", "emitter"}, junction={"pos"})


def solve_linear(matrix, rhs):
    """Gaussian elimination with pivoting, for small classroom circuits."""
    size = len(rhs)
    for col in range(size):
        pivot = max(range(col, size), key=lambda row: abs(matrix[row][col]))
        if abs(matrix[pivot][col]) < 1e-14:
            raise ValueError("Cannot solve this circuit. Check the supply and connections.")
        matrix[col], matrix[pivot] = matrix[pivot], matrix[col]
        rhs[col], rhs[pivot] = rhs[pivot], rhs[col]
        for row in range(col + 1, size):
            scale = matrix[row][col] / matrix[col][col]
            if not scale:
                continue
            for j in range(col, size):
                matrix[row][j] -= scale * matrix[col][j]
            rhs[row] -= scale * rhs[col]
    out = [0.0] * size
    for row in reversed(range(size)):
        out[row] = (rhs[row] - sum(matrix[row][j] * out[j] for j in range(row + 1, size))) / matrix[row][row]
    return out


def simulate(circuit):
    nodes, edges = circuit["nodes"], circuit["edges"]
    if len(nodes) > 100 or len(edges) > 300:
        raise ValueError("Use at most 100 components and 300 wires.")
    by_id = {n["id"]: n for n in nodes}
    if len(by_id) != len(nodes) or len({e['id'] for e in edges}) != len(edges):
        raise ValueError("Component and wire IDs must be unique.")
    terminals = []
    for n in nodes:
        if n['type'] not in HANDLES:
            raise ValueError(f"Unsupported component: {n['type']}")
        terminals.extend((n['id'], h) for h in HANDLES[n['type']])
    parent = {t: t for t in terminals}

    def root(t):
        while parent[t] != t:
            parent[t] = parent[parent[t]]
            t = parent[t]
        return t

    def union(a, b):
        parent[root(a)] = root(b)

    def number(n, key, default):
        value = (n.get('data') or {}).get(key)
        value = default if value is None else value
        if not isinstance(value, (float, int)) or not math.isfinite(value) or value < 0 or value > 1e7:
            raise ValueError(f"{key} must be a finite, nonnegative number (at most 10000000).")
        return value

    zero_graph = defaultdict(list)
    def connect(a, b, edge_id=None, merge=True):
        zero_graph[a].append((b, edge_id))
        zero_graph[b].append((a, edge_id))
        if merge:
            union(a, b)

    for e in edges:
        a, b = (e['source'], e.get('sourceHandle')), (e['target'], e.get('targetHandle'))
        if a not in parent or b not in parent:
            raise ValueError("Every wire must connect valid component terminals.")
        connect(a, b, e['id'])
    for n in nodes:
        kind, data = n['type'], n.get('data') or {}
        for key, default in [('voltage', 9), ('resistance', 330), ('capacitance', 10), ('lightLevel', 50)]:
            number(n, key, default)
        closed = (kind == 'switch' and not data.get('isOpen', True)) or (kind == 'pushbutton' and data.get('isPressed', False))
        if closed or (kind == 'resistor' and number(n, 'resistance', 330) == 0):
            connect((n['id'], 'pos'), (n['id'], 'neg'))
        if kind == 'ammeter':
            # A meter has a tiny shunt for solving, but counts as a short across a supply.
            connect((n['id'], 'pos'), (n['id'], 'neg'), merge=False)

    def path(start, end, graph):
        queue, seen = deque([start]), {start: None}
        while queue:
            t = queue.popleft()
            if t == end:
                ids = []
                while seen[t] is not None:
                    t, edge_id = seen[t]
                    if edge_id:
                        ids.append(edge_id)
                return ids
            for other, edge_id in graph[t]:
                if other not in seen:
                    seen[other] = (t, edge_id)
                    queue.append(other)
        return None

    leds = [n for n in nodes if n['type'] == 'led']
    result = dict(led_states={n['id']: 'BURNT' if (n.get('data') or {}).get('status') in ('BURNT', 'BLOWN') else 'OFF' for n in leds},
                  speaker_active=False, siren_pitch='OFF', is_flipflop=False,
                  short_circuit=False, fault_edges=[], alerts=[], measurements={}, instruments={})
    result['alerts'] = [f"LED {id} is BURNT. Add a series resistor and repair the LED." for id, status in result['led_states'].items() if status == 'BURNT']
    batteries = [n for n in nodes if n['type'] == 'battery']
    for battery in batteries:
        short = path((battery['id'], 'pos'), (battery['id'], 'neg'), zero_graph)
        if short is not None and number(battery, 'voltage', 9) > 0:
            result.update(short_circuit=True, fault_edges=sorted(set(result['fault_edges'] + short)))
    if result['short_circuit']:
        result['alerts'] = ['High current! Battery terminals are shorted through a zero-resistance path. Simulation stopped. Remove the red wires or add resistance.']
        return result
    if len(batteries) > 1:
        raise ValueError("This classroom solver supports one battery per circuit.")
    if not batteries:
        return result
    battery = batteries[0]
    positive, ground = root((battery['id'], 'pos')), root((battery['id'], 'neg'))
    supply = number(battery, 'voltage', 9)
    elapsed = max(0, circuit.get('elapsed', 0))

    # Require cross-coupled capacitor/base wiring, base bias, and grounded emitters.
    transistors = [n for n in nodes if n['type'] == 'transistor']
    caps = [n for n in nodes if n['type'] == 'capacitor']
    def has_component_between(kind, a, b):
        return any(n['type'] == kind and {root((n['id'], 'pos')), root((n['id'], 'neg'))} == {a, b}
                   for n in nodes if n['type'] == kind)
    flip_pair = []
    if len(transistors) == 2 and len(caps) >= 2 and len(leds) >= 2:
        q1, q2 = transistors
        valid = all(root((q['id'], 'emitter')) == ground and has_component_between('resistor', positive, root((q['id'], 'base'))) for q in transistors)
        valid = valid and has_component_between('capacitor', root((q1['id'], 'collector')), root((q2['id'], 'base')))
        valid = valid and has_component_between('capacitor', root((q2['id'], 'collector')), root((q1['id'], 'base')))
        if valid:
            flip_pair = transistors
    bias_resistors = [n for n in nodes if n['type'] == 'resistor' and flip_pair and
        {root((n['id'], 'pos')), root((n['id'], 'neg'))} == {positive, root((flip_pair[0]['id'], 'base'))}]
    half_period = max(0.1, min(5, 0.693 * number(bias_resistors[0], 'resistance', 100000) * number(caps[0], 'capacitance', 10) * 1e-6)) if flip_pair else 0.5
    phase = int(elapsed / half_period) % 2

    # Branch tuple: node id, terminal A, terminal B, resistance, forward drop.
    branches = []
    def branch(n, resistance, drop=0, a='pos', b='neg'):
        branches.append((n['id'], root((n['id'], a)), root((n['id'], b)), resistance, drop))
    for n in nodes:
        kind = n['type']
        if kind == 'resistor' and number(n, 'resistance', 330) > 0:
            branch(n, number(n, 'resistance', 330))
        elif kind == 'ldr':
            branch(n, max(100, 100000 * (1 - min(100, number(n, 'lightLevel', 50)) / 100)))
        elif kind == 'ammeter':
            branch(n, 0.001)
        elif kind == 'speaker':
            branch(n, 8)
        elif kind == 'led' and result['led_states'][n['id']] != 'BURNT':
            branch(n, 10, 2)
        elif kind == 'transistor':
            if flip_pair and n['id'] == flip_pair[phase]['id']:
                branch(n, 10, a='collector', b='emitter')
            elif not flip_pair and root((n['id'], 'base')) == positive:
                branch(n, 10, a='collector', b='emitter')

    nets = list({root(t) for t in terminals} - {positive, ground})
    index = {net: i for i, net in enumerate(nets)}
    fixed = {ground: 0.0, positive: supply}
    active = {n['id'] for n in leds if result['led_states'][n['id']] != 'BURNT'}
    volts = dict(fixed)
    for _ in range(24):
        matrix = [[0.0] * len(nets) for _ in nets]
        rhs = [0.0] * len(nets)
        # A negligible ground leakage makes floating/open terminals solvable.
        for i in range(len(nets)):
            matrix[i][i] = 1e-10
        for node_id, a, b, resistance, drop in branches:
            g = 1 / resistance if not drop or node_id in active else 1e-10
            emf = drop if node_id in active else 0
            for here, other, sign in [(a, b, 1), (b, a, -1)]:
                if here in index:
                    i = index[here]
                    matrix[i][i] += g
                    rhs[i] += sign * emf * g
                    if other in index:
                        matrix[i][index[other]] -= g
                    else:
                        rhs[i] += fixed[other] * g
        volts = {**fixed, **dict(zip(nets, solve_linear(matrix, rhs)))}
        next_active = {node_id for node_id, a, b, _, drop in branches if drop and volts[a] - volts[b] >= drop - 1e-7}
        if next_active == active:
            break
        active = next_active
    else:
        raise ValueError("This diode network did not converge. Simplify the circuit and try again.")

    conductive = defaultdict(list)
    unsafe = defaultdict(list)
    for t in terminals:
        for other, eid in zero_graph[t]:
            conductive[root(t)].append((root(other), eid))
            unsafe[root(t)].append((root(other), eid))
    conductive[positive].append((ground, None))
    conductive[ground].append((positive, None))
    currents = {}
    for node_id, a, b, resistance, drop in branches:
        current = (volts[a] - volts[b] - drop) / resistance if not drop or node_id in active else 0
        currents[node_id] = current
        if not drop or node_id in active:
            conductive[a].append((b, None))
            conductive[b].append((a, None))
            if by_id[node_id]['type'] not in ('resistor', 'ldr', 'led'):
                unsafe[a].append((b, None))
                unsafe[b].append((a, None))
    powered = {ground}
    queue = deque([ground])
    while queue:
        for other, _ in conductive[queue.popleft()]:
            if other not in powered:
                powered.add(other)
                queue.append(other)
    for n in nodes:
        if n['type'] in ('transistor', 'junction'):
            continue
        a, b = root((n['id'], 'pos')), root((n['id'], 'neg'))
        voltage = volts[a] - volts[b]
        current = currents.get(n['id'], 0)
        connected = a in powered and b in powered
        if n['type'] == 'battery':
            current = sum(i if ba == positive else -i if bb == positive else 0 for nid, ba, bb, _, _ in branches for i in [currents.get(nid, 0)])
        result['measurements'][n['id']] = dict(voltage=round(voltage, 5) if connected else None, current_ma=round(current * 1000, 5) if connected else None)
        if n['type'] == 'led' and result['led_states'][n['id']] != 'BURNT':
            unprotected = path(positive, a, unsafe) is not None and path(b, ground, unsafe) is not None
            if voltage > 3.3 and current > 1e-6 and unprotected:
                result['led_states'][n['id']] = 'BURNT'
                result['alerts'].append(f"LED {n['id']} burnt: over 3.3 V without a series resistor. Add resistance and repair the LED.")
            else:
                # Ignore sub-milliamp leakage for the classroom LED's visible state.
                result['led_states'][n['id']] = 'ON' if current >= 0.0005 else 'OFF'
        if n['type'] in ('voltmeter', 'ammeter', 'oscilloscope'):
            result['instruments'][n['id']] = dict(voltage=round(voltage, 5) if connected else None,
                current_ma=round(current * 1000, 5) if connected else None, connected=connected, signal='voltage', frequency=0)
    result['is_flipflop'] = bool(flip_pair) and any(s == 'ON' for s in result['led_states'].values())
    speakers = [n for n in nodes if n['type'] == 'speaker' and abs(currents.get(n['id'], 0)) > 1e-5]
    result['speaker_active'] = bool(speakers)
    result['siren_pitch'] = 'RISING' if speakers else 'FALLING'
    for n in nodes:
        if n['type'] == 'oscilloscope':
            instrument = result['instruments'][n['id']]
            a, b = root((n['id'], 'pos')), root((n['id'], 'neg'))
            if any({a, b} == {root((s['id'], 'pos')), root((s['id'], 'neg'))} for s in nodes if s['type'] == 'speaker'):
                instrument.update(signal='siren')
            elif result['is_flipflop']:
                instrument.update(signal='voltage', frequency=1 / (2 * half_period))
    return result
