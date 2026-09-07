import { test, expect } from '@playwright/test';
import { template } from '../lib/templates';
import { circuitPayload } from '../lib/circuit';

test('clearing the canvas cancels a pending AI circuit instead of restoring it later', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const received = new Promise<void>(resolve => { started = resolve; });
  await page.route('**/api/ai/generate', async route => { started(); await held; await route.fulfill({ json: template('siren') }); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Transistor Flip-Flop' }).click();
  await page.getByPlaceholder(/Ask AI/).fill('Make a siren');
  await page.getByRole('button', { name: 'Generate Circuit', exact: true }).click();
  await received;
  await page.getByRole('button', { name: 'Clear Canvas', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, clear canvas' }).click();
  release(); await page.unrouteAll({ behavior: 'wait' });
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  await expect(page.getByPlaceholder(/Ask AI/)).toHaveValue('');
});

test('AI gateway errors are readable and allow retry', async ({ page }) => {
  await page.route('**/api/ai/generate', route => route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Gateway error</html>' }));
  await page.goto('/');
  await page.getByPlaceholder(/Ask AI/).fill('LED circuit');
  await page.getByRole('button', { name: 'Generate Circuit', exact: true }).click();
  await expect(page.getByText(/backend returned an invalid response/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Circuit', exact: true })).toBeEnabled();
});

test('a failed simulation request stops the simulator and explains the connection failure', async ({ page }) => {
  await page.route('**/api/simulate', route => route.abort('failed'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Transistor Flip-Flop' }).click();
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  await expect(page.getByRole('alert', { name: 'Studio notification' })).toContainText('Cannot connect to the backend');
  await expect(page.getByRole('button', { name: 'Start Simulator', exact: true })).toBeVisible();
});

test('flip-flop uses both RC timing pairs and ignores unrelated capacitors', async ({ request }) => {
  const graph = template('flipflop');
  const frequency = async () => {
    const response = await request.post('http://127.0.0.1:8000/api/simulate', { data: circuitPayload(graph.nodes, graph.edges) });
    expect(response.ok()).toBe(true);
    return (await response.json()).instruments.scope1.frequency;
  };
  expect(await frequency()).toBeCloseTo(1 / 1.386, 5);
  graph.nodes.find(n => n.id === 'c2')!.data.capacitance = 20;
  expect(await frequency()).toBeCloseTo(1 / 2.079, 5);
  graph.nodes.find(n => n.id === 'rb1')!.data.resistance = 200000;
  expect(await frequency()).toBeCloseTo(1 / 3.465, 5);
  graph.nodes.unshift({ id: 'unrelated', type: 'capacitor', position: { x: 0, y: 0 }, data: { capacitance: 999 } });
  expect(await frequency()).toBeCloseTo(1 / 3.465, 5);
});

test('invalid component values cannot corrupt the canvas or saved circuit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '9V Battery', exact: false }).click();
  const input = page.getByRole('spinbutton', { name: 'Battery voltage' });
  await input.fill('-5');
  await expect(input).toHaveValue('9');
  await expect(page.getByRole('alert', { name: 'Studio notification' })).toContainText('nonnegative');
});
