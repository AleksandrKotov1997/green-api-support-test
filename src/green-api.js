const API_URL = 'https://api.green-api.com';
const REQUEST_TIMEOUT_MS = 45000;
const HTTP_METHODS = Object.freeze({
  getSettings: 'GET',
  getStateInstance: 'GET',
  sendMessage: 'POST',
  sendFileByUrl: 'POST',
});

export async function callGreenApi(method, connection, payload) {
  if (!Object.hasOwn(HTTP_METHODS, method)) {
    throw new Error('Неизвестный метод GREEN-API.');
  }
  const httpMethod = HTTP_METHODS[method];

  const { idInstance, apiTokenInstance } = connection;
  const endpoint = `${API_URL}/waInstance${encodeURIComponent(idInstance)}/${method}/${encodeURIComponent(apiTokenInstance)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const options = {
    method: httpMethod,
    signal: controller.signal,
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
  };

  if (httpMethod === 'POST') {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(payload);
  }

  try {
    const response = await fetch(endpoint, options);
    const rawBody = await response.text();
    let body = rawBody;
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Некоторые ошибки API возвращаются как обычный текст или HTML.
    }
    return { ok: response.ok, status: response.status, body };
  } catch {
    if (controller.signal.aborted) {
      throw new Error('GREEN-API не ответил за 45 секунд. Запрос мог быть принят: перед повторной отправкой проверьте чат получателя.');
    }
    throw new Error('Не удалось получить ответ GREEN-API. Проверьте подключение к Интернету и доступность API. Перед повторной отправкой проверьте чат получателя.');
  } finally {
    clearTimeout(timeoutId);
  }
}
