import { CHATBOT_URL } from "../constants/index.ts";

export function generateRandomString(length: number): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export function setCookie(name: string): string {
  const expires = new Date();
  expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sessionId = generateRandomString(8);
  document.cookie = `${name}=${sessionId};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  return sessionId;
}

export function getCookie(name: string): string {
  const nameEq = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    const c = ca[i].trim();
    if (c.indexOf(nameEq) === 0) return c.substring(nameEq.length, c.length);
  }
  return "";
}

export function sendSessionCookie(
  sessionCookie: string,
  iframe: HTMLIFrameElement | null,
  isExisted: boolean,
): void {
  const message = {
    type: "session-cookie",
    data: {
      sessionId: sessionCookie,
      cookieIsExisted: isExisted,
    },
  };
  if (!iframe || !iframe.contentWindow) return;
  iframe.contentWindow.postMessage(message, CHATBOT_URL);
}
