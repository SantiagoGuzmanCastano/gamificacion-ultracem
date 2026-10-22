import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { isValidProfileImage, profileImageExtension } from '../src/profile.js';

function setup({ upload, updateError = null, confirmations = [] } = {}) {
  const requests = [], notices = [];
  const controls = [{ disabled: false }, { disabled: false }];
  const label = { dataset: { defaultLabel: 'Cambiar foto' }, textContent: 'Cambiar foto' };
  const status = { textContent: '' };
  const section = { setAttribute() {} };
  const storage = {
    upload: async (...args) => { requests.push('upload'); return upload ? upload(...args) : { error: null }; },
    remove: async () => { requests.push('remove'); return { error: null }; },
    createSignedUrl: async () => ({ data: { signedUrl: '/saved-photo.png' } }),
  };
  const db = {
    storage: { from: () => storage },
    from: () => ({ update: () => ({ eq: async () => { requests.push('update'); return { error: updateError }; } }) }),
    rpc: async () => { requests.push('rpc'); return { error: null }; },
  };
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const functions = source.slice(source.indexOf('async function uploadProfilePhoto('), source.indexOf('function openProfilePanel('));
  let renders = 0;
  const api = runInNewContext(`
    let profilePhotoSaving = false, profilePhotoPromptPending = true;
    let user = { id: 'advisor-id' }, profile = { avatar_path: 'previous.png', avatar_url: '/previous.png' }, ranking = [];
    ${functions}
    ({ uploadProfilePhoto, removeProfilePhoto, deleteAccount, saving: () => profilePhotoSaving, profile: () => profile });
  `, {
    db, isValidProfileImage, profileImageExtension,
    crypto: { randomUUID: () => 'photo-id' },
    Date,
    window: { confirm: () => confirmations.shift() ?? false },
    document: {
      querySelectorAll: selector => selector === '.profile-photo-action' ? controls : selector === '.profile-upload-label' ? [label] : [status],
      querySelector: selector => selector === '.profile-photo-settings' ? section : null,
    },
    notice: (...args) => notices.push(args),
    render: () => renders++, scheduleProfilePhotoUrlRefresh() {},
  });
  return { api, requests, notices, controls, label, status, renders: () => renders };
}

const file = { type: 'image/png', size: 2048 };

test('upload shows busy feedback, ignores repeated submissions and restores controls', async () => {
  let finish;
  const state = setup({ upload: () => new Promise(resolve => { finish = resolve; }) });
  const pending = state.api.uploadProfilePhoto(file);
  assert.equal(state.api.saving(), true);
  assert.ok(state.controls.every(control => control.disabled));
  assert.equal(state.label.textContent, 'Guardando foto…');
  assert.equal(state.status.textContent, 'Guardando foto…');
  await state.api.uploadProfilePhoto(file);
  assert.deepEqual(state.requests, ['upload']);
  finish({ error: null }); await pending;
  assert.equal(state.api.profile().avatar_url, '/saved-photo.png');
  assert.deepEqual(state.requests, ['upload', 'update', 'remove']);
  assert.equal(state.api.saving(), false);
  assert.ok(state.controls.every(control => !control.disabled));
  assert.equal(state.label.textContent, 'Cambiar foto');
});

test('invalid files never upload or change the existing avatar', async () => {
  const state = setup();
  for (const invalid of [{ type: 'image/gif', size: 100 }, { type: 'image/png', size: 0 }, { type: 'image/png', size: 5242881 }]) {
    await state.api.uploadProfilePhoto(invalid);
  }
  assert.deepEqual(state.requests, []);
  assert.equal(state.api.profile().avatar_url, '/previous.png');
  assert.equal(state.notices.length, 3);
});

test('upload and profile-save failures retain the old avatar and release busy controls', async () => {
  for (const options of [
    { upload: async () => ({ error: { message: 'failed' } }) },
    { upload: async () => { throw new Error('offline'); } },
    { updateError: { message: 'failed' } },
  ]) {
    const state = setup(options);
    await state.api.uploadProfilePhoto(file);
    assert.equal(state.api.profile().avatar_url, '/previous.png');
    assert.equal(state.api.saving(), false);
    assert.ok(state.controls.every(control => !control.disabled));
    assert.equal(state.notices.at(-1)[1], true);
    assert.equal(state.renders(), 0);
  }
});

test('photo removal retains its confirmation and clears the avatar on success', async () => {
  const cancelled = setup();
  await cancelled.api.removeProfilePhoto();
  assert.deepEqual(cancelled.requests, []);
  const state = setup({ confirmations: [true] });
  await state.api.removeProfilePhoto();
  assert.equal(state.api.profile().avatar_url, '');
  assert.deepEqual(state.requests, ['remove', 'update']);
  assert.equal(state.renders(), 1);
  assert.equal(state.notices.at(-1)?.[0], 'Foto de perfil eliminada.');
  assert.equal(cancelled.notices.length, 0);
});

test('cancelling either account deletion confirmation never calls the RPC', async () => {
  for (const confirmations of [[false], [true, false]]) {
    const state = setup({ confirmations });
    await state.api.deleteAccount();
    assert.deepEqual(state.requests, []);
    assert.equal(state.renders(), 0);
  }
});
