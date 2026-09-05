// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GruiaStylePicker } from '../../src/components/GruiaStylePicker';
import type { DesignSystemSummary } from '../../src/types';
const systems = Array.from({ length: 15 }, (_, i) => ({ id: `style-${i}`, title: `Style ${i}`, category: i === 14 ? 'B2B' : 'SaaS', summary: 'A reference', swatches: ['#112233'] })) as DesignSystemSummary[];
afterEach(cleanup);
it('searches beyond the initial page and only selects on an explicit choice', () => {
  const select = vi.fn();
  render(<GruiaStylePicker systems={systems} selectedId={null} loading={false} onSelect={select} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(12);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'b2b' } });
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Elegir' }));
  expect(select).toHaveBeenCalledWith('style-14');
});
it('compares at most three without changing the selected style', () => {
  const select = vi.fn();
  render(<GruiaStylePicker systems={systems} selectedId={null} loading={false} onSelect={select} />);
  for (let i = 0; i < 3; i++) fireEvent.click(within(screen.getAllByRole('listitem')[i]!).getByRole('button', { name: 'Comparar' }));
  expect(screen.getByRole('button', { name: 'Quitar Style 0 de la comparación' })).toBeTruthy();
  expect(screen.getAllByTitle(/Vista previa de/)).toHaveLength(3);
  expect((screen.getAllByRole('button', { name: 'Comparar' })[0] as HTMLButtonElement).disabled).toBe(true);
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar Style 0 de la comparación' }));
  expect(screen.getAllByTitle(/Vista previa de/)).toHaveLength(2);
});
