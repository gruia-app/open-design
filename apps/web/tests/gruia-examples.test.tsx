// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GruiaExamples } from '../src/components/GruiaExamples';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('GruiaExamples', () => {
  it('is managed-only and filters the nine original prompts', () => {
    vi.stubEnv('NEXT_PUBLIC_GRUIA_MANAGED', '1');
    render(<GruiaExamples onUsePrompt={vi.fn()} />);

    expect(screen.getAllByRole('article')).toHaveLength(9);
    fireEvent.click(screen.getByRole('button', { name: 'B2B' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'roi' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Calculadora de ROI')).toBeTruthy();
  });

  it('hands the selected original prompt to the caller', () => {
    vi.stubEnv('NEXT_PUBLIC_GRUIA_MANAGED', '1');
    const onUsePrompt = vi.fn();
    render(<GruiaExamples onUsePrompt={onUsePrompt} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Usar prompt' })[0]!);
    expect(onUsePrompt).toHaveBeenCalledWith(expect.objectContaining({ id: 'b2b-saas-command-center', prompt: expect.stringContaining('prototipo web en español') }));
  });

  it('renders nothing when the managed flag is absent', () => {
    render(<GruiaExamples onUsePrompt={vi.fn()} />);
    expect(screen.queryByText('9 ideas listas para prototipar')).toBeNull();
  });
});
