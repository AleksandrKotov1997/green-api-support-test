import { callGreenApi } from './green-api.js';
import { ValidationError, validateConnection, getChatId, validateMessage, getFileParameters } from './validation.js';

const instanceInput = document.getElementById('idInstance');
const tokenInput = document.getElementById('apiTokenInstance');
const responseField = document.getElementById('apiResponse');
const statusElement = document.getElementById('requestStatus');
const responsePanel = document.querySelector('.response-panel');
const methodButtons = [...document.querySelectorAll('[data-method]')];
const inputs = [...document.querySelectorAll('.controls input, .controls textarea')];
let requestInProgress = false;

function setStatus(message, state) {
  statusElement.textContent = message;
  statusElement.dataset.state = state;
}

function setBusy(busy, method) {
  requestInProgress = busy;
  responsePanel.setAttribute('aria-busy', String(busy));
  for (const button of methodButtons) {
    button.disabled = busy;
    button.textContent = busy && button.dataset.method === method ? `${method}…` : button.dataset.method;
  }
}

function getPayload(method) {
  if (method === 'sendMessage') {
    return {
      chatId: getChatId(document.getElementById('messagePhone').value, 'messagePhone'),
      message: validateMessage(document.getElementById('messageText').value),
    };
  }
  if (method === 'sendFileByUrl') {
    return {
      chatId: getChatId(document.getElementById('filePhone').value, 'filePhone'),
      ...getFileParameters(document.getElementById('fileUrl').value),
    };
  }
  return undefined;
}

function formatResponse(body) {
  return typeof body === 'string' ? body : JSON.stringify(body, null, 2);
}

async function runMethod(method) {
  if (requestInProgress) return;
  for (const input of inputs) input.removeAttribute('aria-invalid');

  let connection;
  let payload;
  try {
    connection = validateConnection(instanceInput.value, tokenInput.value);
    payload = getPayload(method);
  } catch (error) {
    if (error instanceof ValidationError) {
      const field = document.getElementById(error.fieldId);
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
    responseField.value = JSON.stringify({ error: error.message }, null, 2);
    setStatus(error.message, 'error');
    return;
  }

  setBusy(true, method);
  responseField.value = '';
  setStatus(`Выполняется ${method}…`, 'loading');

  try {
    const result = await callGreenApi(method, connection, payload);
    responseField.value = formatResponse(result.body);
    if (!result.ok) {
      setStatus(`${method} · HTTP ${result.status}. GREEN-API вернул ошибку; подробности в поле ответа.`, 'error');
    } else if (payload) {
      setStatus(`${method} · HTTP ${result.status}. Запрос принят. Доставку проверьте в WhatsApp.`, 'success');
    } else {
      setStatus(`${method} · HTTP ${result.status}. Ответ получен.`, 'success');
    }
  } catch (error) {
    responseField.value = JSON.stringify({ error: error.message }, null, 2);
    setStatus(error.message, 'error');
  } finally {
    setBusy(false, method);
  }
}

for (const button of document.querySelectorAll('.account-actions button')) {
  button.addEventListener('click', () => runMethod(button.dataset.method));
}
document.getElementById('messageForm').addEventListener('submit', (event) => {
  event.preventDefault();
  runMethod('sendMessage');
});
document.getElementById('fileForm').addEventListener('submit', (event) => {
  event.preventDefault();
  runMethod('sendFileByUrl');
});
for (const input of inputs) {
  input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
}
