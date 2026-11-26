import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';

/** A contact chosen by the user; only the phone number is read. */
export interface PickedContact {
  name?: string;
  phone: string;
}

/**
 * `null`: cancelled. `no-phone`: the chosen contact has no number. `denied`: contacts access was refused.
 * `unsupported`: no contact picker on this device (PWA), so the user types a number instead.
 */
export type PickResult = PickedContact | null | 'no-phone' | 'denied' | 'unsupported';

interface ContactsManager {
  select(props: string[], options?: { multiple?: boolean }): Promise<{ name?: string[]; tel?: string[] }[]>;
}

const isDenied = (e: unknown) => /denied|permission|not ?allowed|unauthori[sz]ed/i.test(String((e as Error)?.message ?? e));
const isCancel = (e: unknown) => /cancel/i.test(String((e as Error)?.message ?? e));

/** Opens the OS contact picker for one contact (no full-contact-list permission) and reads only its phone number. */
async function pickNative(): Promise<PickResult> {
  try {
    const { contact } = await Contacts.pickContact({ projection: { name: true, phones: true } });
    if (!contact) return null;
    const phone = contact.phones?.map((p) => p.number?.trim()).find(Boolean);
    return phone ? { name: contact.name?.display ?? undefined, phone } : 'no-phone';
  } catch (e) {
    if (isDenied(e)) return 'denied';
    if (isCancel(e)) return null;
    throw e;
  }
}

/** Browser Contact Picker (Android Chrome); other browsers get `unsupported`. */
async function pickWeb(): Promise<PickResult> {
  const contacts = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
  if (!contacts?.select) return 'unsupported';
  try {
    const [picked] = await contacts.select(['name', 'tel'], { multiple: false });
    if (!picked) return null;
    const phone = picked.tel?.map((t) => t.trim()).find(Boolean);
    return phone ? { name: picked.name?.[0], phone } : 'no-phone';
  } catch (e) {
    return isDenied(e) && !isCancel(e) ? 'denied' : null;
  }
}

/** Lets the user choose one device contact. Throws only for unexpected picker failures. */
export function pickContact(): Promise<PickResult> {
  return Capacitor.isNativePlatform() ? pickNative() : pickWeb();
}

/** Whether the device can hand a message to a text composer (phones and the native apps; not desktop browsers). */
export function canText(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent ?? '');
}

/** The `sms:` URL that opens the native composer addressed to `phone` with `body` prefilled. */
export function smsUrl(phone: string, body: string): string {
  const to = phone.replace(/[^\d+]/g, '');
  return `sms:${to}?&body=${encodeURIComponent(body)}`;
}

/** Hands the message to the device's text composer; the user reviews and sends it there. */
export function openComposer(phone: string, body: string): void {
  window.location.href = smsUrl(phone, body);
}
