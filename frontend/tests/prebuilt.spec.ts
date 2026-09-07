import { test, expect, type Page } from '@playwright/test';
import { template } from '../lib/templates';
import { circuitPayload } from '../lib/circuit';

async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const probe = { contexts: [] as AudioContext[], analysers: [] as AnalyserNode[], peak: 0 };
    Object.assign(window, { audioProbe: probe });
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) { super(options); probe.contexts.push(this); }
      createGain() {
        const gain = super.createGain();
        const analyser = this.createAnalyser(); analyser.fftSize = 256;
        gain.connect(analyser); probe.analysers.push(analyser);
        return gain;
      }
    };
    setInterval(() => {
      for (const analyser of probe.analysers) {
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        probe.peak = Math.max(probe.peak, ...samples.map(Math.abs));
      }
    }, 10);
  });
}

async function peak(page: Page) {
  return page.evaluate(() => (window as unknown as { audioProbe: { peak: number } }).audioProbe.peak);
}

test.beforeEach(async ({ page }) => { await observeAudio(page); await page.goto('/'); });

test('siren mouse hold produces actual Web Audio samples and stops on release', async ({ page }) => {
  await page.getByRole('button', { name: 'Emergency Siren Circuit', exact: false }).click();
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  await page.getByRole('button', { name: 'PUSH', exact: true }).hover();
  await page.mouse.down();
  await expect.poll(() => peak(page)).toBeGreaterThan(0.01);
  await page.mouse.up();
  await expect(page.getByText('RELEASED', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const probe = (window as unknown as { audioProbe: { analysers: AnalyserNode[] } }).audioProbe;
    const samples = new Float32Array(256); probe.analysers[0].getFloatTimeDomainData(samples);
    return Math.max(...samples.map(Math.abs));
  })).toBeLessThan(0.001);
});

test('a quick siren tap is audible even with a slow simulation response', async ({ page }) => {
  await page.route('**/api/simulate', async route => {
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Emergency Siren Circuit', exact: false }).click();
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  await page.getByRole('button', { name: 'PUSH', exact: true }).click();
  await expect.poll(() => peak(page)).toBeGreaterThan(0.01);
  await expect(page.getByText('RELEASED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop Simulator', exact: true }).click();
  await page.unrouteAll({ behavior: 'wait' });
});

test('LDR template turns the LED off in darkness and on in bright light', async ({ page }) => {
  await page.getByRole('button', { name: 'LDR Light Sensor', exact: false }).click();
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  const slider = page.locator('[data-id="ldr1"] input');
  await slider.focus(); await page.keyboard.press('End');
  await expect(page.locator('[data-id="led1"] .rounded-full')).toHaveClass(/bg-yellow-400/);
  await page.keyboard.press('Home');
  await expect(page.locator('[data-id="led1"] .rounded-full')).toHaveClass(/bg-gray-200/);
  await expect(page.getByLabel('LED burnt out')).toHaveCount(0);
});

test('all prebuilt graphs return the expected electrical states', async ({ request }) => {
  const simulate = async (name: string, elapsed: number, values: Record<string, unknown> = {}) => {
    const graph = template(name);
    graph.nodes.forEach(n => { if (n.type === 'pushbutton' || n.type === 'ldr') Object.assign(n.data, values); });
    const response = await request.post('http://127.0.0.1:8000/api/simulate', { data: { ...circuitPayload(graph.nodes, graph.edges), elapsed } });
    expect(response.ok()).toBe(true);
    const result = await response.json(); expect(result.short_circuit).toBe(false); expect(result.alerts).toEqual([]);
    return result;
  };
  expect((await simulate('siren', 0)).speaker_active).toBe(false);
  expect((await simulate('siren', 0, { isPressed: true })).speaker_active).toBe(true);
  expect((await simulate('flipflop', 0)).led_states).toEqual({ led1: 'ON', led2: 'OFF' });
  expect((await simulate('flipflop', 0.8)).led_states).toEqual({ led1: 'OFF', led2: 'ON' });
  expect((await simulate('ldr', 0, { lightLevel: 0 })).led_states.led1).toBe('OFF');
  const bright = await simulate('ldr', 0, { lightLevel: 100 });
  expect(bright.led_states.led1).toBe('ON');
  expect(bright.measurements.led1.current_ma).toBeLessThan(25);
});

test('PUSH resumes suspended audio and stopping while held silences it', async ({ page }) => {
  await page.getByRole('button', { name: 'Emergency Siren Circuit', exact: false }).click();
  await expect(page.getByRole('button', { name: 'PUSH', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Start Simulator', exact: true }).click();
  await page.evaluate(async () => {
    const probe = (window as unknown as { audioProbe: { contexts: AudioContext[] } }).audioProbe;
    await probe.contexts[0].suspend();
  });
  await page.getByRole('button', { name: 'PUSH', exact: true }).focus();
  await page.keyboard.down('Space');
  await expect.poll(() => peak(page)).toBeGreaterThan(0.01);
  await page.getByRole('button', { name: 'Stop Simulator', exact: true }).click();
  await page.keyboard.up('Space');
  await expect(page.getByRole('button', { name: 'PUSH', exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => {
    const probe = (window as unknown as { audioProbe: { analysers: AnalyserNode[] } }).audioProbe;
    const samples = new Float32Array(256); probe.analysers[0].getFloatTimeDomainData(samples);
    return Math.max(...samples.map(Math.abs));
  })).toBeLessThan(0.001);
});
