import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError, validateConnection, getChatId, validateMessage, getFileParameters } from '../src/validation.js';

test('Параметры подключения сохраняются строками, пробелы по краям удаляются', () => {
  assert.deepEqual(validateConnection(' 1101000001 ', ' test-token '), {
    idInstance: '1101000001', apiTokenInstance: 'test-token',
  });
});

test('Неверные параметры подключения указывают поле для исправления', () => {
  for (const id of ['', '123abc', '1/2', '1 2']) {
    assert.throws(() => validateConnection(id, 'test-token'), error => error instanceof ValidationError && error.fieldId === 'idInstance');
  }
  for (const token of ['', ' ', 'token with spaces']) {
    assert.throws(() => validateConnection('1101000001', token), error => error.fieldId === 'apiTokenInstance');
  }
});

test('Номер с форматированием преобразуется в WhatsApp chatId', () => {
  assert.equal(getChatId('+7 (777) 123-45-67', 'messagePhone'), '77771234567@c.us');
  assert.equal(getChatId('77771234567', 'filePhone'), '77771234567@c.us');
});

test('Ошибочные номера не исправляются молча и не отправляются', () => {
  for (const phone of ['', '123', '01234567890', '77771234567abc', '++77771234567', '77771234567@g.us', '1234567890123456']) {
    assert.throws(() => getChatId(phone, 'filePhone'), error => error.fieldId === 'filePhone');
  }
});

test('Текст сообщения сохраняет переносы, пробелы и emoji', () => {
  const message = '  Первая строка\nВторая строка 🙂  ';
  assert.equal(validateMessage(message), message);
});

test('Пустое сообщение и превышение лимита отклоняются', () => {
  assert.throws(() => validateMessage(' \n\t'), ValidationError);
  assert.equal(validateMessage('а'.repeat(20000)).length, 20000);
  assert.throws(() => validateMessage('а'.repeat(20001)), ValidationError);
});

test('Имя файла берётся из пути, параметры ссылки сохраняются', () => {
  assert.deepEqual(getFileParameters(' https://example.com/files/image.png?download=1 '), {
    urlFile: 'https://example.com/files/image.png?download=1', fileName: 'image.png',
  });
  assert.equal(getFileParameters('https://example.com/%D1%84%D0%B0%D0%B9%D0%BB.pdf').fileName, 'файл.pdf');
});

test('Небезопасные или неполные ссылки дают ошибку поля', () => {
  for (const url of ['', '/image.png', 'javascript:alert(1)', 'file:///image.png', 'https://user:pass@example.com/image.png', 'https://example.com/image.png#fragment', 'https://example.com/', 'https://example.com/download', 'https://example.com/bad%ZZ.png', 'https://example.com/a%2Fb.png', 'https://example.com/a b.png']) {
    assert.throws(() => getFileParameters(url), error => error instanceof ValidationError && error.fieldId === 'fileUrl');
  }
});
