export class ValidationError extends Error {
  constructor(message, fieldId) {
    super(message);
    this.name = 'ValidationError';
    this.fieldId = fieldId;
  }
}

export function validateConnection(idInstance, apiTokenInstance) {
  const instanceId = idInstance.trim();
  const token = apiTokenInstance.trim();

  if (!/^\d+$/.test(instanceId)) {
    throw new ValidationError('Введите idInstance: только цифры из личного кабинета.', 'idInstance');
  }
  if (!token || /\s/.test(token)) {
    throw new ValidationError('Введите ApiTokenInstance без пробелов из личного кабинета.', 'apiTokenInstance');
  }

  return { idInstance: instanceId, apiTokenInstance: token };
}

export function getChatId(phone, fieldId) {
  const value = phone.trim();
  if (!/^\+?[\d\s()-]+$/.test(value)) {
    throw new ValidationError('Введите номер получателя с кодом страны.', fieldId);
  }
  const digits = value.replace(/\D/g, '');
  if (!/^[1-9]\d{6,14}$/.test(digits)) {
    throw new ValidationError('Номер должен содержать от 7 до 15 цифр и код страны.', fieldId);
  }
  return `${digits}@c.us`;
}

export function validateMessage(message) {
  if (!message.trim()) {
    throw new ValidationError('Введите текст сообщения.', 'messageText');
  }
  if (message.length > 20000) {
    throw new ValidationError('Сообщение не должно превышать 20 000 символов.', 'messageText');
  }
  return message;
}

export function getFileParameters(value) {
  const urlFile = value.trim();
  let url;
  try {
    url = new URL(urlFile);
  } catch {
    throw new ValidationError('Введите полную ссылку на файл, начинающуюся с https:// или http://.', 'fileUrl');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash || /\s/.test(urlFile)) {
    throw new ValidationError('Укажите прямую HTTP(S)-ссылку на файл без пробелов, пароля и фрагмента #.', 'fileUrl');
  }

  let fileName;
  try {
    fileName = decodeURIComponent(url.pathname.split('/').at(-1));
  } catch {
    throw new ValidationError('В ссылке на файл есть некорректные символы.', 'fileUrl');
  }
  if (!/^.+\.[a-zA-Z0-9]{1,10}$/.test(fileName) || /[\x00-\x1f\x7f/\\]/.test(fileName)) {
    throw new ValidationError('Ссылка должна содержать название файла с расширением, например image.png.', 'fileUrl');
  }
  return { urlFile, fileName };
}
