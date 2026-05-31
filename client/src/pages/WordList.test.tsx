import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '../lib/lang';
import WordList from './WordList';

function renderWordList() {
  return render(
    <MemoryRouter>
      <LangProvider>
        <WordList />
      </LangProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ words: [] }),
    })
  ) as unknown as typeof fetch;
});

describe('WordList', () => {
  it('renders the title', async () => {
    renderWordList();
    expect(screen.getByText('My Word List')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    renderWordList();
    expect(screen.getByText('Words you double-clicked across all your saved Learning Sessions.')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    renderWordList();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows empty state when no words exist', async () => {
    renderWordList();
    await waitFor(() => {
      expect(screen.getByText('No words saved yet. Save a Learning Session with highlighted words to start your list.')).toBeInTheDocument();
    });
  });

  it('shows word chips when API returns words', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          words: [
            { id: 1, word: 'hund', definitionNo: 'et dyr', definitionEn: 'a dog', sessionId: 1, sessionTheme: 'Animals', createdAt: '2025-03-01T00:00:00Z' },
            { id: 2, word: 'katt', definitionNo: 'et dyr', definitionEn: 'a cat', sessionId: 1, sessionTheme: 'Animals', createdAt: '2025-03-01T00:00:00Z' },
          ],
        }),
      })
    ) as unknown as typeof fetch;

    renderWordList();
    await waitFor(() => {
      expect(screen.getByText('hund')).toBeInTheDocument();
      expect(screen.getByText('katt')).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    ) as unknown as typeof fetch;

    renderWordList();
    await waitFor(() => {
      expect(screen.getByText('Failed to load. Is the server running?')).toBeInTheDocument();
    });
  });
});
