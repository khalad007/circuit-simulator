import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { template } from '../lib/templates';
import { parseCircuit, saveCircuit } from '../lib/circuit';

const node = (id: string, type: string, x: number, y: number, data = {}) => ({ id, type, position: { x, y }, data });
const wire = (id: string, source: string, sourceHandle: string, target: string, targetHandle: string) => ({ id, source, sourceHandle, target, targetHandle });
const direct = {
  nodes: [node('b', 'battery', 60, 120, { voltage: 9 }), node('l', 'led', 320, 120)],
  edges: [wire('e1', 'b', 'pos', 'l', 'pos'), wire('e2', 'b', 'neg', 'l', 'neg')],
};
async function load(page: Page, value: unknown) {
  await page.getByLabel('Load circuit JSON').setInputFiles({ name: 'test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await expect(page.getByRole('alert', { name: 'Studio notification' })).toContainText('Circuit loaded');
}

test('serialization validates references and strips callbacks/readings', () => {
  const c = template('flipflop');
  c.nodes[0].data.onChangeVoltage = () => {};
  c.nodes[0].data.reading = { voltage: 9 };
  const text = saveCircuit(c.nodes, c.edges, { x: 1, y: 2, zoom: 0.5 });
  expect(text).not.toContain('onChange'); expect(text).not.toContain('reading');
  expect(parseCircuit(JSON.parse(text)).nodes).toHaveLength(c.nodes.length);
  expect(() => parseCircuit({ ...direct, edges: [wire('bad', 'missing', 'pos', 'l', 'pos')] })).toThrow('Invalid wire');
});

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('LED explodes, stays burnt after restart, and can be repaired', async ({ page }) => {
  await load(page, direct);
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  await expect(page.getByLabel('LED burnt out')).toBeVisible();
  await expect(page.getByRole('alert', { name: 'Studio notification' })).toContainText('series resistor');
  await page.getByRole('button', { name: 'Stop Simulator', exact: true }).click();
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  await expect(page.getByLabel('LED burnt out')).toBeVisible();
  await page.getByRole('button', { name: 'Repair LEDs' }).click();
  await expect(page.getByLabel('LED burnt out')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start Simulator', exact: true })).toBeVisible();
});

test('short circuit makes the wire red and stops simulation', async ({ page }) => {
  await load(page, { nodes: [direct.nodes[0]], edges: [wire('short', 'b', 'pos', 'b', 'neg')] });
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  await expect(page.getByRole('alert', { name: 'Studio notification' })).toContainText('High current');
  await expect(page.getByRole('button', { name: 'Start Simulator', exact: true })).toBeVisible();
  await expect(page.locator('.react-flow__edge-path')).toHaveCSS('stroke', 'rgb(220, 38, 38)');
});

test('meters read a real series circuit and stop showing live values when paused', async ({ page }) => {
  await load(page, {
    nodes: [direct.nodes[0], node('r', 'resistor', 330, 100, { resistance: 1000 }), node('a', 'ammeter', 320, 350), node('v', 'voltmeter', 600, 120)],
    edges: [wire('1', 'b', 'pos', 'a', 'pos'), wire('2', 'a', 'neg', 'r', 'pos'), wire('3', 'r', 'neg', 'b', 'neg'), wire('4', 'v', 'pos', 'r', 'pos'), wire('5', 'v', 'neg', 'r', 'neg')],
  });
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  await expect(page.locator('[data-id="a"]')).toContainText('9.00');
  await expect(page.locator('[data-id="v"]')).toContainText('9.00');
  await page.getByRole('button', { name: 'Stop Simulator', exact: true }).click();
  await expect(page.locator('[data-id="a"]')).toContainText('Start simulation to measure');
});

test('JSON round-trip restores editable values and malformed loads leave graph intact', async ({ page }) => {
  await load(page, direct);
  await page.locator('[data-id="b"] input').fill('12');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save JSON' }).click();
  const downloaded = await pending;
  const saved = JSON.parse(await readFile(await downloaded.path() as string, 'utf8'));
  expect(saved.nodes[0].data.voltage).toBe(12);
  expect(saved.nodes[0].data.onChangeVoltage).toBeUndefined();
  await page.getByLabel('Load circuit JSON').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nodes":42}') });
  await expect(page.getByRole('alert', { name: 'Studio notification' })).toContainText('Choose a circuit JSON');
  await expect(page.locator('[data-id="b"] input')).toHaveValue('12');
  await load(page, saved);
  await page.locator('[data-id="b"] input').fill('5');
  await expect(page.locator('[data-id="b"] input')).toHaveValue('5');
});

test('PNG export includes circuit pixels and all offscreen nodes', async ({ page }) => {
  await load(page, { ...template('flipflop'), viewport: { x: 5000, y: 5000, zoom: 1 } });
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  const downloaded = await pending;
  expect(downloaded.suggestedFilename()).toBe('circuit.png');
  await downloaded.saveAs('test-results/exported-circuit.png');
  const bytes = await readFile(await downloaded.path() as string);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1600);
  expect(bytes.length).toBeGreaterThan(15_000);
  const nonwhite = await page.evaluate(async (url) => {
    const img = new Image(); img.src = url; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 200 && data[i + 1] < 200 && data[i + 2] < 200 && data[i + 3] > 0) count++;
    return count;
  }, `data:image/png;base64,${bytes.toString('base64')}`);
  expect(nonwhite).toBeGreaterThan(1000);
});

test('flip-flop template alternates and draws a live scope trace', async ({ page }) => {
  await page.getByRole('button', { name: 'Transistor Flip-Flop' }).click();
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  const led = page.locator('[data-id="led1"] .rounded-full');
  await expect(led).toHaveClass(/bg-yellow-400/);
  await expect(led).toHaveClass(/bg-gray-200/);
  await expect(page.locator('[data-id="scope1"]')).toContainText('LIVE');
  await expect(page.locator('[data-id="scope1"]')).toContainText('flip-flop model');
  await page.screenshot({ path: 'test-results/studio.png', fullPage: true });
});

test('challenge UI shows AI score and hints, then marks edited solutions stale', async ({ page }) => {
  await page.route('**/api/ai/challenge', route => route.fulfill({ json: { id: 'challenge-1', title: 'Parallel LEDs', task: 'Build two safe LED branches.', criteria: ['Two parallel branches'] } }));
  await page.route('**/api/ai/challenge/verify', route => {
    expect(route.request().postDataJSON().challenge_id).toBe('challenge-1');
    return route.fulfill({ json: { score: 60, feedback: 'One branch is missing.', hints: ['Add the second LED branch.'] } });
  });
  await page.getByRole('button', { name: 'Generate Challenge' }).click();
  await expect(page.getByText('Build two safe LED branches.')).toBeVisible();
  await page.getByRole('button', { name: 'Verify Solution' }).click();
  await expect(page.getByText('60/100', { exact: false })).toBeVisible();
  await expect(page.getByText('Add the second LED branch.')).toBeVisible();
  await page.getByRole('button', { name: 'LED Light', exact: false }).click();
  await expect(page.getByText('Circuit changed since grading.', { exact: false })).toBeVisible();
});

test('double-clicking a wire adds a probe junction or inserts the selected ammeter', async ({ page }) => {
  await load(page, { nodes: [direct.nodes[0], node('r', 'resistor', 450, 300, { resistance: 1000 })], edges: [wire('e1', 'b', 'pos', 'r', 'pos'), wire('e2', 'b', 'neg', 'r', 'neg')] });
  await page.locator('[data-id="e1"] .react-flow__edge-interaction').dispatchEvent('dblclick', { clientX: 700, clientY: 550 });
  await expect(page.locator('.react-flow__node-junction')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  await page.getByRole('button', { name: 'Ammeter (series)', exact: false }).click();
  await page.locator('.react-flow__node-ammeter').click();
  await page.locator('[data-id="e2"] .react-flow__edge-interaction').dispatchEvent('dblclick', { clientX: 710, clientY: 560 });
  await expect(page.getByRole('alert', { name: 'Studio notification' })).toContainText('Ammeter inserted in series');
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  await expect(page.locator('.react-flow__node-ammeter')).toContainText('9.00');
});

test('siren scope shows rising and falling pitch and releases a held button', async ({ page }) => {
  await page.getByRole('button', { name: 'Emergency Siren Circuit', exact: false }).click();
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  const button = page.getByRole('button', { name: 'PUSH', exact: true });
  await button.focus(); await page.keyboard.down('Space');
  const scope = page.locator('[data-id="scope1"]');
  await expect.poll(async () => Number((await scope.textContent())?.match(/Pitch: (\d+)/)?.[1] ?? 0)).toBeGreaterThan(400);
  await page.keyboard.up('Space');
  await expect(page.getByText('RELEASED', { exact: true })).toBeVisible();
  await expect.poll(async () => Number((await scope.textContent())?.match(/Pitch: (\d+)/)?.[1] ?? 0)).toBe(300);
});
