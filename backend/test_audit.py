import math
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from fastapi.testclient import TestClient
import main
from simulation import simulate
from test_simulation import circuit, node


class PhysicsAuditTest(unittest.TestCase):
    def test_voltage_divider_and_reversed_probe(self):
        c = circuit([node('b', 'battery'), node('r1', 'resistor', resistance=1000), node('r2', 'resistor', resistance=1000), node('v', 'voltmeter')],
            [('b','pos','r1','pos'), ('r1','neg','r2','pos'), ('r2','neg','b','neg'), ('v','neg','r2','pos'), ('v','pos','b','neg')])
        r = simulate(c)
        self.assertAlmostEqual(r['instruments']['v']['voltage'], -4.5, places=4)
        self.assertAlmostEqual(r['measurements']['b']['current_ma'], 4.5, places=4)

    def test_two_unprotected_series_leds_burn(self):
        c = circuit([node('b','battery'), node('l1','led'), node('l2','led')],
            [('b','pos','l1','pos'), ('l1','neg','l2','pos'), ('l2','neg','b','neg')])
        self.assertEqual(simulate(c)['led_states'], {'l1':'BURNT', 'l2':'BURNT'})

    def test_capacitor_blocks_dc_and_reads_supply_voltage(self):
        c = circuit([node('b','battery'), node('c','capacitor'), node('l','led')],
            [('b','pos','c','pos'), ('c','neg','l','pos'), ('l','neg','b','neg')])
        r = simulate(c)
        self.assertEqual(r['led_states']['l'], 'OFF')
        self.assertEqual(r['measurements']['c']['current_ma'], 0)

    def test_transistor_switch_accepts_base_resistor_and_respects_emitter(self):
        c = circuit([node('b','battery'), node('rb','resistor', resistance=10000), node('r','resistor', resistance=330), node('l','led'), node('q','transistor')],
            [('b','pos','rb','pos'), ('rb','neg','q','base'), ('b','pos','r','pos'), ('r','neg','l','pos'), ('l','neg','q','collector'), ('q','emitter','b','neg')])
        r = simulate(c)
        self.assertEqual(r['led_states']['l'], 'ON')
        self.assertGreater(r['measurements']['q']['current_ma'], 10)
        c['edges'][0]['sourceHandle'] = 'neg'
        self.assertEqual(simulate(c)['led_states']['l'], 'OFF')

    def test_low_supply_does_not_turn_on_transistor(self):
        c = circuit([node('b','battery', voltage=0.5), node('r','resistor', resistance=100), node('q','transistor')],
            [('b','pos','r','pos'), ('r','neg','q','collector'), ('q','base','b','pos'), ('q','emitter','b','neg')])
        self.assertEqual(simulate(c)['measurements']['q']['current_ma'], 0)

    def test_invalid_numeric_extremes_are_rejected(self):
        for value in [1e-300, float('inf'), float('nan'), -1, True]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                simulate(circuit([node('b','battery'), node('r','resistor', resistance=value)], []))

    def test_short_path_through_multiple_wires(self):
        c = circuit([node('b','battery'), node('j','junction'), node('s','switch', isOpen=False)],
            [('b','pos','j','pos'), ('j','pos','s','pos'), ('s','neg','b','neg')])
        self.assertEqual(simulate(c)['fault_edges'], ['e0','e1','e2'])

    def test_zero_supply_and_parallel_resistors_are_finite(self):
        for voltage in [0, 9, 1e7]:
            c = circuit([node('b','battery', voltage=voltage), node('r1','resistor', resistance=0.001), node('r2','resistor', resistance=1e7)],
                [('b','pos','r1','pos'), ('b','neg','r1','neg'), ('b','pos','r2','pos'), ('b','neg','r2','neg')])
            r = simulate(c)
            self.assertTrue(math.isfinite(r['measurements']['b']['current_ma']))

    def test_series_resistors_conserve_current(self):
        values = [1, 10, 100, 1000, 10000]
        nodes = [node('b','battery')] + [node(f'r{i}','resistor', resistance=r) for i, r in enumerate(values)]
        wires = [('b','pos','r0','pos')] + [(f'r{i}','neg',f'r{i+1}','pos') for i in range(len(values)-1)] + [('r4','neg','b','neg')]
        result = simulate(circuit(nodes, wires))
        for i in range(len(values)):
            self.assertAlmostEqual(result['measurements'][f'r{i}']['current_ma'], 9000 / sum(values), places=4)

    def test_large_floating_canvas_does_not_crash(self):
        c = circuit([node('b','battery')] + [node(f'r{i}','resistor', resistance=0.001) for i in range(99)], [])
        result = simulate(c)
        self.assertIsNone(result['measurements']['r98']['voltage'])


class APIAuditTest(unittest.TestCase):
    def setUp(self):
        self.http = TestClient(main.app)

    def test_nonfinite_request_returns_422_not_500(self):
        response = self.http.post('/api/simulate', content='{"nodes":[{"id":"b","type":"battery","data":{"voltage":NaN}}],"edges":[]}', headers={'Content-Type':'application/json'})
        self.assertEqual(response.status_code, 422)

    def test_bad_booleans_and_node_types_are_rejected(self):
        for n in [node('s','switch', isOpen=None), node('b','not-a-component'), node('s','switch', isOpen='false')]:
            self.assertEqual(self.http.post('/api/simulate', json={'nodes':[n], 'edges':[]}).status_code, 422)

    def test_empty_ai_prompt_rejected(self):
        self.assertEqual(self.http.post('/api/ai/generate', json={'prompt':'  '}).status_code, 422)

    def test_ai_dangling_wire_rejected_before_render(self):
        text = '{"nodes":[{"id":"b","type":"battery","position":{"x":0,"y":0}}],"edges":[{"id":"e","source":"b","sourceHandle":"pos","target":"missing","targetHandle":"pos"}]}'
        with patch.object(main, 'generate_content', return_value=SimpleNamespace(text=text)):
            self.assertEqual(self.http.post('/api/ai/generate', json={'prompt':'LED'}).status_code, 502)


if __name__ == '__main__':
    unittest.main()
