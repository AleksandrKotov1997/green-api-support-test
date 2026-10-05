import test from 'node:test';
import assert from 'node:assert/strict';
import { callGreenApi } from '../src/green-api.js';

const connection = { idInstance: '1101000001', apiTokenInstance: 'test-token' };

test('Методы аккаунта используют GET без тела и возвращают JSON', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ stateInstance: 'authorized' }), { status: 200 });
  });
  for (const method of ['getSettings', 'getStateInstance']) {
    const result = await callGreenApi(method, connection);
    assert.deepEqual(result, { ok: true, status: 200, body: { stateInstance: 'authorized' } });
  }
  for (const [index, method] of ['getSettings', 'getStateInstance'].entries()) {
    assert.equal(calls[index].url, `https://api.green-api.com/waInstance1101000001/${method}/test-token`);
    assert.equal(calls[index].options.method, 'GET');
    assert.equal(calls[index].options.body, undefined);
    assert.equal(calls[index].options.credentials, 'omit');
    assert.equal(calls[index].options.referrerPolicy, 'no-referrer');
  }
});

test('Отправка сообщения и файла использует POST и точное JSON-тело', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return new Response('{"idMessage":"message-id"}', { status: 200 });
  });
  const message = { chatId: '77771234567@c.us', message: 'Проверка\n🙂' };
  const file = { chatId: '77771234567@c.us', urlFile: 'https://example.com/image.png', fileName: 'image.png' };
  for (const [method, payload] of [['sendMessage', message], ['sendFileByUrl', file]]) {
    const result = await callGreenApi(method, connection, payload);
    const { url, options } = calls.at(-1);
    assert.ok(url.includes(`/${method}/`));
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), payload);
    assert.equal(result.body.idMessage, 'message-id');
  }
});

test('HTTP-ошибка сохраняет код и тело ответа API', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"error":"Unauthorized"}', { status: 401 }));
  assert.deepEqual(await callGreenApi('getSettings', connection), {
    ok: false, status: 401, body: { error: 'Unauthorized' },
  });
});

test('Ответ HTML и пустой ответ отображаются без ошибки парсинга JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<h1>Bad Gateway</h1>', { status: 502 }));
  assert.equal((await callGreenApi('getSettings', connection)).body, '<h1>Bad Gateway</h1>');
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.deepEqual(await callGreenApi('getSettings', connection), { ok: true, status: 204, body: '' });
});

test('Сетевая ошибка не раскрывает URL с токеном и не повторяет отправку', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls += 1;
    throw new TypeError(`Failed to fetch ${url}`);
  });
  await assert.rejects(callGreenApi('sendMessage', connection, { chatId: '77771234567@c.us', message: 'Проверка' }), error => {
    assert.ok(!error.message.includes('test-token'));
    assert.ok(error.message.includes('проверьте чат получателя'));
    return true;
  });
  assert.equal(calls, 1);
});

test('Таймаут отменяет ожидание и сообщает о возможной принятой отправке', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  const request = callGreenApi('sendMessage', connection, { chatId: '77771234567@c.us', message: 'Проверка' });
  const rejection = assert.rejects(request, /45 секунд.*Запрос мог быть принят/);
  t.mock.timers.tick(45000);
  await rejection;
});

test('Неизвестные методы отклоняются до сети', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { assert.fail('Сетевой запрос недопустим'); });
  for (const method of ['deleteInstanceAccount', 'toString', '__proto__']) {
    await assert.rejects(callGreenApi(method, connection), /Неизвестный метод/);
  }
});
