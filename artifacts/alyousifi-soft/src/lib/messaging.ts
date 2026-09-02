import { Capacitor, registerPlugin } from '@capacitor/core';

export type WhatsAppPackage = 'com.whatsapp' | 'com.whatsapp.w4b' | 'system';

type MessagingPlugin = {
  sendSms(options: { phone: string; message: string }): Promise<{ sent: boolean }>;
  openWhatsApp(options: { phone: string; message: string; packageName: WhatsAppPackage }): Promise<void>;
};

const Messaging = registerPlugin<MessagingPlugin>('Messaging');

export async function sendSms(phone: string, message: string) {
  if (Capacitor.isNativePlatform()) {
    return Messaging.sendSms({ phone, message });
  }

  const url = `sms:${phone}?body=${encodeURIComponent(message)}`;
  const opened = window.open(url, '_blank');
  if (!opened) window.location.href = url;
  return { sent: false };
}

export async function openWhatsApp(phone: string, message: string, packageName: WhatsAppPackage) {
  if (Capacitor.isNativePlatform()) {
    await Messaging.openWhatsApp({ phone, message, packageName });
    return;
  }

  const normalizedPhone = phone.replace(/\D/g, '');
  const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  const opened = window.open(url, '_blank');
  if (!opened) window.location.href = url;
}