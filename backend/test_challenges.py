import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from fastapi.testclient import TestClient
import main


class ChallengeTest(unittest.TestCase):
    def setUp(self):
        self.http = TestClient(main.app)
        main.challenges.clear()

    def create(self):
        with patch.object(main, 'generate_content', return_value=SimpleNamespace(text=json.dumps(dict(title='LED circuit', task='Light one LED safely with 9 V and 330 ohms.', criteria=['One powered LED', '330 ohm resistor in series'])))):
            response = self.http.post('/api/ai/challenge')
        self.assertEqual(response.status_code, 200)
        return response.json()['id']

    def test_create_and_empty_solution(self):
        id = self.create()
        response = self.http.post('/api/ai/challenge/verify', json=dict(challenge_id=id, nodes=[], edges=[]))
        self.assertEqual(response.json()['score'], 0)

    def test_expired_challenge(self):
        response = self.http.post('/api/ai/challenge/verify', json=dict(challenge_id='missing', nodes=[], edges=[]))
        self.assertEqual(response.status_code, 404)

    def test_grade_uses_saved_challenge_and_caps_short(self):
        id = self.create()
        with patch.object(main, 'generate_content', return_value=SimpleNamespace(text=json.dumps(dict(score=100, feedback='Looks good', hints=[])))) as generate:
            response = self.http.post('/api/ai/challenge/verify', json=dict(challenge_id=id,
                nodes=[dict(id='b', type='battery', data=dict(voltage=9))],
                edges=[dict(id='e', source='b', sourceHandle='pos', target='b', targetHandle='neg')]))
        self.assertEqual(response.json()['score'], 40)
        self.assertIn('330 ohm resistor in series', generate.call_args.kwargs['contents'])

    def test_invalid_ai_response_is_actionable(self):
        with patch.object(main, 'generate_content', return_value=SimpleNamespace(text='{}')):
            self.assertEqual(self.http.post('/api/ai/challenge').status_code, 502)


if __name__ == '__main__':
    unittest.main()
