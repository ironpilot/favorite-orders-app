import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';

const state = vi.hoisted(() => ({
  notes: null as string | null,
  calls: [] as [string, string, unknown?][],
  pick: null as unknown,
  composed: [] as [string, string][],
  canText: true,
  copied: [] as string[],
  copyOk: true,
  composeThrows: false,
}));

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  }
  return {
    ApiError,
    getToken: () => 'token',
    setToken: () => undefined,
    api: async (method: string, path: string, body?: unknown) => {
      state.calls.push([method, path, body]);
      if (path === '/api/auth/me') return { id: 'me', emailVerified: true };
      if (path === '/api/restaurants/r1') return { id: 'r1', name: 'Taco Town', updatedAt: '' };
      if (path === '/api/orders/o1') {
        return {
          id: 'o1', restaurantId: 'r1', title: 'Lunch', notes: state.notes, isDefault: true, createdAt: '', updatedAt: 'u1',
          items: [{ name: 'Taco', quantity: 2, customizations: [{ kind: 'remove', ingredient: 'Onions' }] }],
        };
      }
      return [];
    },
  };
});

vi.mock('@/services/native/texting', () => ({
  pickContact: async () => state.pick,
  canText: () => state.canText,
  openComposer: (phone: string, body: string) => {
    if (state.composeThrows) throw new Error('no handler');
    state.composed.push([phone, body]);
  },
}));

vi.mock('@/services/native/clipboard', () => ({
  copyText: async (text: string) => { if (state.copyOk) state.copied.push(text); return state.copyOk; },
}));

import { buildOrderMessage } from '@/services/orderMessage';
import OrderDetailPage from '@/views/OrderDetailPage.vue';
import { buildRouter } from '@/router';

const order = {
  title: 'Lunch',
  notes: 'Extra napkins',
  items: [
    { name: 'Burger', quantity: 2, customizations: [
      { kind: 'remove' as const, ingredient: 'Lettuce' },
      { kind: 'add' as const, ingredient: 'Onions' },
      { kind: 'substitute' as const, ingredient: 'Swiss', insteadOf: 'Cheddar' },
    ] },
    { name: 'Fries', quantity: 1, customizations: [] },
  ],
};

describe('buildOrderMessage', () => {
  it('includes restaurant, name, items with quantities and customizations', () => {
    expect(buildOrderMessage(order, 'Burger Barn')).toBe(
      'Burger Barn\nLunch\n\n2× Burger\n  - No Lettuce\n  - Add Onions\n  - Swiss instead of Cheddar\n1× Fries',
    );
  });

  it('omits the name line when there is no name', () => {
    const msg = buildOrderMessage({ ...order, title: '' }, 'Burger Barn');
    expect(msg.startsWith('Burger Barn\n\n2× Burger')).toBe(true);
  });

  it('includes notes only when requested', () => {
    expect(buildOrderMessage(order, 'B')).not.toContain('Extra napkins');
    expect(buildOrderMessage(order, 'B', { includeNotes: true })).toContain('Notes: Extra napkins');
  });

  it('adds no notes section when the order has no notes', () => {
    expect(buildOrderMessage({ ...order, notes: null }, 'B', { includeNotes: true })).not.toContain('Notes');
  });

  it('does not truncate long orders and has no link', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ name: `Item ${i}`, quantity: 1, customizations: [] }));
    const msg = buildOrderMessage({ title: 'Big', notes: null, items }, 'R');
    expect(msg).toContain('1× Item 199');
    expect(msg.split('\n')).toHaveLength(203);
    expect(msg).not.toMatch(/https?:|www\./);
  });

  it('builds the composer URL for the chosen number', async () => {
    const { smsUrl } = await vi.importActual<typeof import('@/services/native/texting')>('@/services/native/texting');
    expect(smsUrl('+1 (555) 123-4567', 'a b')).toBe('sms:+15551234567?&body=a%20b');
  });
});

describe('texting from the order detail view', () => {
  type Vm = {
    textOrder: () => void;
    continueText: (include: boolean) => Promise<void>;
    sendTo: (phone: string) => boolean;
    notesPrompt: boolean;
    numberPrompt: boolean;
  };

  async function mountPage() {
    const router = buildRouter(createMemoryHistory());
    await router.push('/tabs/restaurants/r1/orders/o1');
    const wrapper = mount(OrderDetailPage, { props: { id: 'r1', orderId: 'o1' }, global: { plugins: [router] } });
    await flushPromises();
    state.calls = [];
    return wrapper;
  }

  const writes = () => state.calls.filter(([m]) => m !== 'GET');

  beforeEach(() => {
    state.notes = null;
    state.calls = [];
    state.pick = { phone: '5551234' };
    state.composed = [];
    state.canText = true;
    state.copied = [];
    state.copyOk = true;
    state.composeThrows = false;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('shows the text button right after the share action', async () => {
    const wrapper = await mountPage();
    const ids = wrapper.findAll('[data-testid]').map((n) => n.attributes('data-testid'));
    expect(ids.indexOf('text-order')).toBe(ids.indexOf('share-order') + 1);
  });

  it('skips the notes prompt without notes and opens the composer for the contact', async () => {
    const wrapper = await mountPage();
    await wrapper.find('[data-testid="text-order"]').trigger('click');
    await flushPromises();
    const vm = wrapper.vm as unknown as Vm;
    expect(vm.notesPrompt).toBe(false);
    expect(state.composed).toEqual([['5551234', 'Taco Town\nLunch\n\n2× Taco\n  - No Onions']]);
    expect(writes()).toEqual([]);
  });

  it('asks about notes when there are notes and passes the choice on', async () => {
    state.notes = 'Hot sauce';
    const wrapper = await mountPage();
    const vm = wrapper.vm as unknown as Vm;
    vm.textOrder();
    expect(vm.notesPrompt).toBe(true);
    await vm.continueText(true);
    await vm.continueText(false);
    expect(state.composed[0][1]).toContain('Notes: Hot sauce');
    expect(state.composed[1][1]).not.toContain('Hot sauce');
  });

  it('sends nothing and changes nothing when the contact chooser is cancelled', async () => {
    state.pick = null;
    const wrapper = await mountPage();
    await (wrapper.vm as unknown as Vm).continueText(false);
    expect(state.composed).toEqual([]);
    expect(state.calls).toEqual([]);
  });

  it('falls back to typing a number when there is no contact picker', async () => {
    state.pick = 'unsupported';
    const wrapper = await mountPage();
    const vm = wrapper.vm as unknown as Vm;
    await vm.continueText(false);
    expect(vm.numberPrompt).toBe(true);
    expect(vm.sendTo('  ')).toBe(false);
    expect(vm.sendTo('555 0000')).toBe(true);
    expect(state.composed[0][0]).toBe('555 0000');
  });

  type Alert = { open: boolean; header: string; message: string; buttons: { text: string; handler?: () => void }[] };
  const alertOf = (w: { vm: unknown }) => (w.vm as unknown as { textAlert: Alert }).textAlert;
  const MESSAGE = 'Taco Town\nLunch\n\n2× Taco\n  - No Onions';

  it('offers copy when there is no text handler and copies the prepared message', async () => {
    state.canText = false;
    const wrapper = await mountPage();
    await (wrapper.vm as unknown as Vm).continueText(false);
    const alert = alertOf(wrapper);
    expect(alert.message).toContain('cannot send text messages');
    alert.buttons.find((b) => b.text === 'Copy')!.handler!();
    await flushPromises();
    expect(state.copied).toEqual([MESSAGE]);
    expect(alert.header).toBe('Copied');
    expect(state.composed).toEqual([]);
    expect(writes()).toEqual([]);
  });

  it('"Copy order" copies exactly the prepared message offline and confirms', async () => {
    const wrapper = await mountPage();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await wrapper.find('[data-testid="copy-order"]').trigger('click');
    await flushPromises();
    expect(state.copied).toEqual([MESSAGE]);
    expect(alertOf(wrapper)).toMatchObject({ open: true, header: 'Copied' });
    expect(state.calls).toEqual([]);
  });

  it('shows an alert when copying fails', async () => {
    state.copyOk = false;
    const wrapper = await mountPage();
    await wrapper.find('[data-testid="copy-order"]').trigger('click');
    await flushPromises();
    expect(alertOf(wrapper).message).toContain('could not be copied');
  });

  it('shows an alert when contacts access is denied', async () => {
    state.pick = 'denied';
    const wrapper = await mountPage();
    await (wrapper.vm as unknown as Vm).continueText(false);
    expect(alertOf(wrapper)).toMatchObject({ open: true, header: 'Contacts access denied' });
    expect(alertOf(wrapper).message).toContain('cannot be sent');
    expect(state.composed).toEqual([]);
    expect(state.calls).toEqual([]);
  });

  it('tells the user when the contact has no phone number and lets them pick another', async () => {
    state.pick = 'no-phone';
    const wrapper = await mountPage();
    await (wrapper.vm as unknown as Vm).continueText(false);
    const alert = alertOf(wrapper);
    expect(alert.header).toBe('No phone number');
    expect(state.composed).toEqual([]);
    state.pick = { phone: '5559999' };
    alert.buttons.find((b) => b.text === 'Pick another')!.handler!();
    await flushPromises();
    expect(state.composed).toEqual([['5559999', MESSAGE]]);
  });

  it('shows an alert when the message cannot be sent', async () => {
    state.composeThrows = true;
    const wrapper = await mountPage();
    await (wrapper.vm as unknown as Vm).continueText(false);
    expect(alertOf(wrapper).message).toContain('cannot be sent');
    expect(writes()).toEqual([]);
  });

  it('works offline without any requests', async () => {
    const wrapper = await mountPage();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const button = wrapper.find('[data-testid="text-order"]');
    expect(button.attributes('disabled')).toBeUndefined();
    await button.trigger('click');
    await flushPromises();
    expect(state.composed).toHaveLength(1);
    expect(state.calls).toEqual([]);
  });
});
