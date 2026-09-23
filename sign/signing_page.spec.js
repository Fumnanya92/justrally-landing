const { test, expect } = require('@playwright/test');

const edgeUrl = '**/functions/v1/documents-sign';

function session(draft = {}) {
  return {
    documentTitle: 'Two page agreement',
    pdfUrl: 'http://127.0.0.1:4179/sign/fixtures/two-page.pdf',
    pageCount: 2,
    status: 'pending',
    recipientName: 'Ada Lovelace',
    serverTime: '2026-09-22T12:00:00.000Z',
    consentText: 'I consent to sign electronically.',
    fields: [
      { id: 'name', field_type: 'name', label: 'Full name', required: true, page_number: 1, pos_x: .12, pos_y: .28, width: .30, height: .06 },
      { id: 'signature', field_type: 'signature', label: 'Signature', required: true, page_number: 2, pos_x: .20, pos_y: .70, width: .35, height: .08 },
    ],
    completedFields: [],
    draft,
    processingStatus: 'pending',
  };
}

test('reads every page, resumes a draft, reviews, and submits Rally Signed', async ({ page }) => {
  let savedDraft = {};
  const actions = [];
  await page.route(edgeUrl, async (route) => {
    const body = route.request().postDataJSON();
    actions.push(body.action);
    if (body.action === 'session') return route.fulfill({ json: session(savedDraft) });
    if (body.action === 'save_draft') {
      savedDraft = {
        fieldValues: body.fieldValues,
        signatures: body.signatures,
        acknowledgements: body.acknowledgements,
        consent: body.consent,
      };
    }
    if (body.action === 'review') return route.fulfill({ json: { ok: true, draft: body, signedAt: '2026-09-22T12:01:00Z' } });
    if (body.action === 'submit') return route.fulfill({ json: { ok: true, completed: true, processingStatus: 'completed' } });
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto('http://127.0.0.1:4179/sign/?token=' + 'a'.repeat(64));
  await expect(page.locator('.pdf-page-wrap')).toHaveCount(2);
  await expect(page.locator('#pdf-page-count')).toHaveText('2 pages');
  await expect(page.locator('#pdf-open-link')).toHaveAttribute('href', /two-page\.pdf/);
  await page.locator('#fill-form-fab').click();
  await page.locator('#input-name').fill('Ada Lovelace');
  await page.waitForTimeout(650);
  expect(actions).toContain('save_draft');

  await page.reload();
  await page.locator('#fill-form-fab').click();
  await expect(page.locator('#input-name')).toHaveValue('Ada Lovelace');
  await page.locator('#field-signature').scrollIntoViewIfNeeded();
  await page.locator('#field-signature').click();
  await page.locator('.sig-tab[data-mode="rally"]').click();
  await expect(page.locator('#sig-rally-name-input-signature')).toHaveValue('Ada Lovelace');
  await page.locator('#sig-modal-done').click();
  await page.locator('#consent-check').check();
  await page.locator('#submit-btn').click();
  await expect(page.locator('#review-modal-overlay')).toBeVisible();
  await expect(page.locator('#review-modal-body')).toContainText('Signature (rally_stamp)');
  await page.locator('#review-confirm-btn').click();
  await expect(page.locator('#completed-view')).toBeVisible();
  expect(actions).toContain('review');
  expect(actions).toContain('submit');
});

test('keeps all pages and fields usable on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(edgeUrl, (route) => route.fulfill({ json: session() }));
  await page.goto('http://127.0.0.1:4179/sign/?token=' + 'b'.repeat(64));
  await expect(page.locator('.pdf-page-wrap')).toHaveCount(2);
  await expect(page.locator('#fill-form-fab')).toBeVisible();
  await expect(page.locator('.field-overlay .overlay-input-box')).toHaveCount(0);
  const width = await page.locator('.wrap').evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(390);
});

test('collects fields in the floating form panel and leaves the PDF unobstructed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(edgeUrl, (route) => route.fulfill({ json: session() }));

  await page.goto('http://127.0.0.1:4179/sign/?token=' + 'd'.repeat(64));
  await expect(page.locator('#fill-form-fab')).toBeVisible();
  await expect(page.locator('#fill-form-panel #input-name')).toBeHidden();

  await page.locator('#fill-form-fab').click();
  await expect(page.locator('#fill-form-panel')).toBeVisible();
  await expect(page.locator('#fill-form-panel')).toContainText('Complete your details');
  await expect(page.locator('#fill-form-panel')).toContainText('Document page 1');
  await expect(page.locator('#fill-form-panel')).toContainText('Document page 2');
  await expect(page.locator('#fill-form-panel #input-name')).toBeVisible();
  await expect(page.locator('#field-name .error-text')).toBeHidden();
  const nameInputWidth = await page.locator('#input-name').evaluate((el) => el.getBoundingClientRect().width);
  const nameCardWidth = await page.locator('#field-name').evaluate((el) => el.getBoundingClientRect().width);
  expect(nameInputWidth).toBeGreaterThan(nameCardWidth * .75);
  await page.locator('#fill-form-panel #input-name').fill('Ada Lovelace');
  await page.locator('#fill-form-preview').click();
  await expect(page.locator('#preview-name')).toContainText('Ada Lovelace');
  await page.locator('#fill-form-fab').click();
  await page.locator('#fill-form-panel #field-signature').click();
  await expect(page.locator('#sig-modal-overlay')).toBeVisible();
});

test('does not substitute the invitation name into Rally Signed', async ({ page }) => {
  const invitationOnly = session();
  invitationOnly.fields = [invitationOnly.fields[1]];
  invitationOnly.recipientName = 'David';
  await page.route(edgeUrl, (route) => route.fulfill({ json: invitationOnly }));

  await page.goto('http://127.0.0.1:4179/sign/?token=' + 'e'.repeat(64));
  await page.locator('#fill-form-fab').click();
  await page.locator('#field-signature').click();
  await page.locator('.sig-tab[data-mode="rally"]').click();
  await expect(page.locator('#sig-rally-name-input-signature')).toHaveValue('');
});

test('shows a safe retry when final PDF generation failed', async ({ page }) => {
  let retried = false;
  await page.route(edgeUrl, (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'session') {
      return route.fulfill({ json: {
        ...session(),
        status: 'completed',
        processingStatus: 'failed',
        processingError: 'final_upload_failed',
      } });
    }
    if (body.action === 'retry_finalization') {
      retried = true;
      return route.fulfill({ json: { ok: true, completed: true, processingStatus: 'completed' } });
    }
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto('http://127.0.0.1:4179/sign/?token=' + 'c'.repeat(64));
  await expect(page.locator('#retry-finalization-btn')).toBeVisible();
  await page.locator('#retry-finalization-btn').click();
  await expect(page.locator('#retry-finalization-btn')).toBeHidden();
  expect(retried).toBe(true);
});
