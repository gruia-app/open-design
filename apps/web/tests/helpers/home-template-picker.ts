import { act } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { HOME_APPLY_TEMPLATE_EVENT } from '../../src/components/home-hero/chips';

export function homeTemplateTrigger(): HTMLButtonElement {
  return screen.getByTestId('home-hero-template-trigger').querySelector('button')!;
}

export async function pickHomeTemplate(id: string): Promise<void> {
  await screen.findByTestId('home-hero-template-trigger');
  if (id === 'mobile' || id === 'wireframe') {
    await act(async () => {
      window.dispatchEvent(new CustomEvent(HOME_APPLY_TEMPLATE_EVENT, { detail: { chipId: id } }));
    });
    return;
  }
  // The trigger disables while a pick (including the Prototype auto-default)
  // resolves, so an enabled observation can go stale before the click lands.
  // Retry the open until the menu is mounted instead of clicking once.
  await waitFor(() => {
    if (screen.queryByTestId('home-hero-template-menu')) return;
    const trigger = homeTemplateTrigger();
    if (!trigger.disabled) fireEvent.click(trigger);
    if (!screen.queryByTestId('home-hero-template-menu')) throw new Error('template menu not open');
  });
  const option = screen.getByTestId('home-hero-template-menu').querySelector(`[data-chip="${id}"]`);
  expect(option, `creation type ${id} is available in the dropdown`).not.toBeNull();
  fireEvent.click(option!);
}
