import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';

export type DeviceContact = {
  id: string;
  name: string;
  phone: string;
};

type WebContact = {
  name?: string[];
  tel?: string[];
};

type WebContactsApi = {
  select: (properties: string[], options: { multiple: boolean }) => Promise<WebContact[]>;
};

const webContactsApi = (): WebContactsApi | undefined => (
  (navigator as Navigator & { contacts?: WebContactsApi }).contacts
);

const contactName = (contact: { name?: { display?: string | null; given?: string | null; middle?: string | null; family?: string | null } }): string => {
  const name = contact.name;
  return name?.display?.trim()
    || [name?.given, name?.middle, name?.family].filter(Boolean).join(' ').trim();
};

const contactPhone = (contact: { phones?: Array<{ number: string | null }> }): string => (
  contact.phones?.find((phone) => phone.number?.trim())?.number?.trim() ?? ''
);

const ensureNativePermission = async () => {
  const current = await Contacts.checkPermissions();
  if (current.contacts === 'granted' || current.contacts === 'limited') return;
  const requested = await Contacts.requestPermissions();
  if (requested.contacts !== 'granted' && requested.contacts !== 'limited') {
    throw new Error('CONTACTS_PERMISSION_DENIED');
  }
};

const mapNativeContact = (contact: Awaited<ReturnType<typeof Contacts.getContacts>>['contacts'][number]): DeviceContact | null => {
  const name = contactName(contact);
  const phone = contactPhone(contact);
  if (!name || !phone) return null;
  return { id: contact.contactId, name, phone };
};

export const isNativeContactsAvailable = () => Capacitor.isNativePlatform();

export async function pickDeviceContact(): Promise<DeviceContact | null> {
  if (Capacitor.isNativePlatform()) {
    await ensureNativePermission();
    const result = await Contacts.pickContact({ projection: { name: true, phones: true } });
    return mapNativeContact(result.contact);
  }

  const contacts = webContactsApi();
  if (!contacts) throw new Error('CONTACTS_UNAVAILABLE');
  const result = await contacts.select(['name', 'tel'], { multiple: false });
  const contact = result[0];
  if (!contact) return null;
  const name = contact.name?.find(Boolean)?.trim() ?? '';
  const phone = contact.tel?.find(Boolean)?.trim() ?? '';
  return name && phone ? { id: `web-${name}-${phone}`, name, phone } : null;
}

export async function getDeviceContacts(): Promise<DeviceContact[]> {
  if (Capacitor.isNativePlatform()) {
    await ensureNativePermission();
    const result = await Contacts.getContacts({ projection: { name: true, phones: true } });
    return result.contacts.map(mapNativeContact).filter((contact): contact is DeviceContact => Boolean(contact));
  }

  const contacts = webContactsApi();
  if (!contacts) throw new Error('CONTACTS_UNAVAILABLE');
  const result = await contacts.select(['name', 'tel'], { multiple: true });
  return result.flatMap((contact, index) => {
    const name = contact.name?.find(Boolean)?.trim() ?? '';
    const phone = contact.tel?.find(Boolean)?.trim() ?? '';
    return name && phone ? [{ id: `web-${index}-${name}-${phone}`, name, phone }] : [];
  });
}