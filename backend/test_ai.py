import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from google.genai import errors

import main


class AIRoutesTest(unittest.TestCase):
    def setUp(self):
        self.http = TestClient(main.app)
        self.provider = Mock()
        self.client_patch = patch.object(main, "client", self.provider)
        self.client_patch.start()
        self.addCleanup(self.client_patch.stop)

    def test_generation(self):
        self.provider.models.generate_content.return_value = SimpleNamespace(text='{"nodes": [], "edges": []}')
        response = self.http.post('/api/ai/generate', json={"prompt": "LED circuit"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"nodes": [], "edges": []})
        self.assertEqual(self.provider.models.generate_content.call_args.kwargs['model'], main.gemini_model)

    def test_missing_key_does_not_break_simulation(self):
        with patch.object(main, 'client', None):
            response = self.http.post('/api/ai/generate', json={"prompt": "LED circuit"})
            self.assertEqual(response.status_code, 503)
            self.assertIn('GEMINI_API_KEY', response.json()['detail'])
            self.assertEqual(self.http.post('/api/simulate', json={"nodes": [], "edges": []}).status_code, 200)

    def test_provider_errors_on_both_routes(self):
        for code, message, expected_status, expected_text in [
            (400, 'API key not valid. secret-value', 502, 'rejected'),
            (403, 'Permission denied. secret-value', 502, 'permissions'),
            (404, 'Model not found. secret-value', 502, 'GEMINI_MODEL'),
            (429, 'Quota exceeded. secret-value', 429, 'quota'),
        ]:
            for route, payload in [('/api/ai/generate', {"prompt": "LED"}), ('/api/ai/analyze', {"nodes": [], "edges": []})]:
                with self.subTest(code=code, route=route):
                    self.provider.models.generate_content.side_effect = errors.ClientError(code, {"error": {"message": message}})
                    response = self.http.post(route, json=payload)
                    self.assertEqual(response.status_code, expected_status)
                    self.assertIn(expected_text, response.json()['detail'])
                    self.assertNotIn('secret-value', response.text)

    def test_invalid_generated_json(self):
        for text in [None, 'not json', '{}', '[]']:
            with self.subTest(text=text):
                self.provider.models.generate_content.return_value = SimpleNamespace(text=text)
                self.assertEqual(self.http.post('/api/ai/generate', json={"prompt": "LED"}).status_code, 502)

    def test_analysis_and_empty_response(self):
        self.provider.models.generate_content.return_value = SimpleNamespace(text=' Circuit is open. ')
        self.assertEqual(self.http.post('/api/ai/analyze', json={"nodes": [], "edges": []}).json(), {"analysis": 'Circuit is open.'})
        self.provider.models.generate_content.return_value = SimpleNamespace(text=None)
        self.assertEqual(self.http.post('/api/ai/analyze', json={"nodes": [], "edges": []}).status_code, 502)

    def test_local_frontend_origins(self):
        for origin in ['http://localhost:3000', 'http://127.0.0.1:3000']:
            response = self.http.options('/api/ai/generate', headers={'Origin': origin, 'Access-Control-Request-Method': 'POST'})
            self.assertEqual(response.headers['access-control-allow-origin'], origin)


if __name__ == '__main__':
    unittest.main()
