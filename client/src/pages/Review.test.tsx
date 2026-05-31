import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '../lib/lang';
import Review from './Review';

function renderReview() {
  return render(
    <MemoryRouter>
      <LangProvider>
        <Review />
      </LangProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ sessions: [] }),
    })
  ) as unknown as typeof fetch;
});

describe('Review', () => {
  it('renders the title', async () => {
    renderReview();
    await waitFor(() => {
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    // Make fetch hang so loading persists
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    renderReview();
    expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
  });

  it('shows empty state when no sessions exist', async () => {
    renderReview();
    await waitFor(() => {
      expect(screen.getByText('No saved sessions yet. Start a learning session and save one.')).toBeInTheDocument();
    });
  });

  it('shows sessions when API returns data', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          sessions: [
            { id: 1, sessionTheme: 'Travel', text: 'Some text', createdAt: '2025-04-01T00:00:00Z' },
          ],
        }),
      })
    ) as unknown as typeof fetch;

    renderReview();
    await waitFor(() => {
      expect(screen.getByText('Travel')).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500 })
    ) as unknown as typeof fetch;

    renderReview();
    await waitFor(() => {
      expect(screen.getByText('Failed to load sessions')).toBeInTheDocument();
    });
  });
});
