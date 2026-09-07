import unittest
from simulation import simulate


def node(id, kind, **data):
    return dict(id=id, type=kind, data=data)


def circuit(nodes, connections):
    return dict(nodes=nodes, edges=[dict(id=f'e{i}', source=a, sourceHandle=ah, target=b, targetHandle=bh)
        for i, (a, ah, b, bh) in enumerate(connections)])


class SimulationTest(unittest.TestCase):
    def led_circuit(self, resistor=True):
        nodes = [node('b', 'battery', voltage=9), node('l', 'led')]
        wires = [('b', 'neg', 'l', 'neg')]
        if resistor:
            nodes.append(node('r', 'resistor', resistance=330))
            wires += [('b', 'pos', 'r', 'pos'), ('r', 'neg', 'l', 'pos')]
        else:
            wires += [('b', 'pos', 'l', 'pos')]
        return circuit(nodes, wires)

    def test_direct_led_burns(self):
        self.assertEqual(simulate(self.led_circuit(False))['led_states']['l'], 'BURNT')

    def test_series_resistor_limits_current(self):
        result = simulate(self.led_circuit())
        self.assertEqual(result['led_states']['l'], 'ON')
        self.assertAlmostEqual(result['measurements']['l']['current_ma'], 7000 / 340, places=3)
        self.assertLess(result['measurements']['l']['voltage'], 3.3)

    def test_disconnected_resistor_does_not_protect(self):
        c = self.led_circuit(False)
        c['nodes'].append(node('r', 'resistor', resistance=330))
        self.assertEqual(simulate(c)['led_states']['l'], 'BURNT')

    def test_bypassed_resistor_does_not_protect(self):
        c = self.led_circuit()
        c['edges'].append(dict(id='bypass', source='r', sourceHandle='pos', target='r', targetHandle='neg'))
        self.assertEqual(simulate(c)['led_states']['l'], 'BURNT')

    def test_open_and_reverse_led_do_not_light(self):
        c = self.led_circuit()
        c['edges'].pop(0)
        self.assertEqual(simulate(c)['led_states']['l'], 'OFF')
        c = self.led_circuit()
        for e in c['edges']:
            if e['target'] == 'l':
                e['targetHandle'] = 'pos' if e['targetHandle'] == 'neg' else 'neg'
        self.assertEqual(simulate(c)['led_states']['l'], 'OFF')

    def test_burnt_led_remains_open(self):
        c = self.led_circuit()
        c['nodes'][1]['data']['status'] = 'BURNT'
        result = simulate(c)
        self.assertEqual(result['led_states']['l'], 'BURNT')
        self.assertEqual(result['measurements']['l']['current_ma'], 0)

    def test_short_circuit_highlights_path(self):
        c = circuit([node('b', 'battery', voltage=9)], [('b', 'pos', 'b', 'neg')])
        result = simulate(c)
        self.assertTrue(result['short_circuit'])
        self.assertEqual(result['fault_edges'], ['e0'])

    def test_zero_resistor_and_ammeter_short(self):
        for kind in ['resistor', 'ammeter']:
            c = circuit([node('b', 'battery'), node('r', kind, resistance=0)], [('b', 'pos', 'r', 'pos'), ('r', 'neg', 'b', 'neg')])
            self.assertTrue(simulate(c)['short_circuit'])

    def test_switch_only_controls_its_branch(self):
        c = self.led_circuit()
        c['nodes'].append(node('s', 'switch', isOpen=True))
        self.assertEqual(simulate(c)['led_states']['l'], 'ON')

    def test_open_switch_blocks_short(self):
        c = circuit([node('b', 'battery'), node('s', 'switch', isOpen=True)], [('b', 'pos', 's', 'pos'), ('s', 'neg', 'b', 'neg')])
        self.assertFalse(simulate(c)['short_circuit'])
        c['nodes'][1]['data']['isOpen'] = False
        self.assertTrue(simulate(c)['short_circuit'])

    def test_voltmeter_does_not_short_or_load_battery(self):
        c = circuit([node('b', 'battery', voltage=9), node('v', 'voltmeter')], [('b', 'pos', 'v', 'pos'), ('b', 'neg', 'v', 'neg')])
        result = simulate(c)
        self.assertFalse(result['short_circuit'])
        self.assertEqual(result['instruments']['v']['voltage'], 9)
        self.assertEqual(result['measurements']['b']['current_ma'], 0)

    def test_series_ammeter_and_parallel_branches(self):
        c = circuit([node('b', 'battery', voltage=9), node('a', 'ammeter'), node('r1', 'resistor', resistance=1000), node('r2', 'resistor', resistance=1000)],
            [('b', 'pos', 'a', 'pos'), ('a', 'neg', 'r1', 'pos'), ('r1', 'neg', 'b', 'neg'), ('b', 'pos', 'r2', 'pos'), ('r2', 'neg', 'b', 'neg')])
        result = simulate(c)
        self.assertAlmostEqual(result['instruments']['a']['current_ma'], 9, places=3)
        self.assertAlmostEqual(result['measurements']['b']['current_ma'], 18, places=3)

    def test_unconnected_probe_is_not_a_fake_reading(self):
        c = circuit([node('b', 'battery'), node('v', 'voltmeter')], [('b', 'pos', 'v', 'pos')])
        self.assertIsNone(simulate(c)['instruments']['v']['voltage'])

    def test_invalid_connections_and_values_rejected(self):
        c = self.led_circuit()
        c['edges'][0]['targetHandle'] = 'missing'
        with self.assertRaises(ValueError): simulate(c)
        c = self.led_circuit()
        c['nodes'][0]['data']['voltage'] = float('nan')
        with self.assertRaises(ValueError): simulate(c)

    def test_wire_direction_does_not_change_physics(self):
        c = self.led_circuit()
        expected = simulate(c)['measurements']
        for e in c['edges']:
            e['source'], e['target'] = e['target'], e['source']
            e['sourceHandle'], e['targetHandle'] = e['targetHandle'], e['sourceHandle']
        self.assertEqual(simulate(c)['measurements'], expected)

    def test_unwired_transistors_do_not_create_flipflop(self):
        c = self.led_circuit()
        c['nodes'] += [node('q1', 'transistor'), node('q2', 'transistor'), node('c1', 'capacitor'), node('c2', 'capacitor'), node('l2', 'led')]
        self.assertFalse(simulate(c)['is_flipflop'])


if __name__ == '__main__':
    unittest.main()
