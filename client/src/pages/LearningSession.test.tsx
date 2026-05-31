import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '../lib/lang';
import LearningSession from './LearningSession';

function renderLearningSession() {
  return render(
    <MemoryRouter>
      <LangProvider>
        <LearningSession />
      </LangProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
  ) as unknown as typeof fetch;
});

describe('LearningSession', () => {
  it('renders the Paste button when no text loaded', () => {
    renderLearningSession();
    expect(screen.getByText('Paste')).toBeInTheDocument();
  });

  it('renders the Load Text button', () => {
    renderLearningSession();
    expect(screen.getByText('Load Text')).toBeInTheDocument();
  });

  it('renders the Save button', () => {
    renderLearningSession();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('Save button is disabled when no text loaded', () => {
    renderLearningSession();
    const saveButton = screen.getByText('Save');
    expect(saveButton).toBeDisabled();
  });

  it('does not show Clear All button initially (no annotations)', () => {
    renderLearningSession();
    expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
  });
});
