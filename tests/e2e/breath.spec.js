// @ts-check
const { test, expect } = require('@playwright/test');

// Spy AudioContext prima del caricamento della pagina: registra costruzioni e beep
async function instrumentAudio(page) {
  await page.addInitScript(() => {
    /** @type {{ contexts: number, beeps: number, frequencies: number[] }} */
    const audio = { contexts: 0, beeps: 0, frequencies: [] };
    // @ts-ignore
    window.__audio = audio;

    const RealCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!RealCtx) return;

    class SpyCtx extends RealCtx {
      constructor() {
        super();
        audio.contexts += 1;
      }
      createOscillator() {
        const osc = super.createOscillator();
        const origStart = osc.start.bind(osc);
        osc.start = function (when) {
          audio.beeps += 1;
          audio.frequencies.push(osc.frequency.value);
          return origStart(when);
        };
        return osc;
      }
    }
    // @ts-ignore
    window.AudioContext = SpyCtx;
    // @ts-ignore
    window.webkitAudioContext = SpyCtx;
  });
}

function attachConsoleSpy(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

test.describe('Breath PWA', () => {
  test('pagina carica senza errori console critici', async ({ page }) => {
    const errors = attachConsoleSpy(page);
    await page.goto('/');
    await expect(page.locator('#ball')).toBeVisible();
    await expect(page.locator('#toggle')).toHaveText('Start');
    await expect(page.locator('#phase')).toHaveText('PRONTO');
    await expect(page.locator('#cycles')).toHaveText('0');
    // Filtra eventuali warning innocui (es. SW non disponibile in alcuni contesti)
    const critical = errors.filter((e) => !/wakeLock|SW registration/i.test(e));
    expect(critical, `Errori critici:\n${critical.join('\n')}`).toEqual([]);
  });

  test('manifest è raggiungibile e ben formato', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/application\/manifest\+json/);
    const manifest = await res.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      const iconRes = await request.get('/' + icon.src);
      expect(iconRes.status(), `icon ${icon.src}`).toBe(200);
    }
  });

  test('service worker si registra', async ({ page }) => {
    await page.goto('/');
    const registered = await page.waitForFunction(
      async () => {
        if (!('serviceWorker' in navigator)) return false;
        const reg = await navigator.serviceWorker.getRegistration();
        return !!reg;
      },
      null,
      { timeout: 10_000 }
    );
    expect(await registered.jsonValue()).toBe(true);
  });

  test('sw.js è servito con no-cache', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
    const cc = res.headers()['cache-control'] || '';
    expect(cc).toContain('no-cache');
  });

  test('Start avvia il ciclo: fase INSPIRA, pallino cresce, beep emesso', async ({ page }) => {
    await instrumentAudio(page);
    const errors = attachConsoleSpy(page);
    await page.goto('/');

    const ball = page.locator('#ball');
    const initialScale = await ball.evaluate((el) =>
      parseFloat(getComputedStyle(el).getPropertyValue('--scale'))
    );
    expect(initialScale).toBeLessThan(0.5);

    await page.locator('#toggle').click();

    await expect(page.locator('#phase')).toHaveText('INSPIRA');
    await expect(page.locator('#toggle')).toHaveText('Stop');

    // Wait a beat per far girare l'audio handler
    await page.waitForTimeout(200);
    const audio = await page.evaluate(() => /** @type {any} */ (window).__audio);
    expect(audio.contexts).toBeGreaterThanOrEqual(1);
    expect(audio.beeps).toBeGreaterThanOrEqual(1);
    // Primo beep = inspira = freq più alta del beep espira
    expect(audio.frequencies[0]).toBe(660);

    // Lo scale target durante INSPIRA è 1.0
    const targetScale = await ball.evaluate((el) =>
      parseFloat(getComputedStyle(el).getPropertyValue('--scale'))
    );
    expect(targetScale).toBe(1.0);

    expect(errors.filter((e) => !/wakeLock/i.test(e))).toEqual([]);
  });

  test('dopo un ciclo completo (12s) il contatore è 1 e l\'espira ha frequenza più bassa', async ({ page }) => {
    test.setTimeout(30_000);
    await instrumentAudio(page);
    await page.goto('/');
    await page.locator('#toggle').click();

    // Aspetta INSPIRA → ESPIRA (verifica transizione)
    await expect(page.locator('#phase')).toHaveText('INSPIRA');
    await expect(page.locator('#phase')).toHaveText('ESPIRA', { timeout: 6_000 });

    // Aspetta il ritorno a INSPIRA = un ciclo completato
    await expect(page.locator('#cycles')).toHaveText('1', { timeout: 10_000 });

    const audio = await page.evaluate(() => /** @type {any} */ (window).__audio);
    // Ci aspettiamo almeno 2 beep: uno per INSPIRA(660) e uno per ESPIRA(330)
    expect(audio.beeps).toBeGreaterThanOrEqual(2);
    expect(audio.frequencies).toContain(660);
    expect(audio.frequencies).toContain(330);
  });

  test('Stop ferma il loop e resetta la UI', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('#toggle');
    await toggle.click();
    await expect(page.locator('#phase')).toHaveText('INSPIRA');

    await toggle.click();
    await expect(toggle).toHaveText('Start');
    await expect(page.locator('#phase')).toHaveText('PRONTO');

    // Il contatore di cicli non dev'essere stato resettato a metà (era 0, resta 0)
    await expect(page.locator('#cycles')).toHaveText('0');
  });
});
