import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '../lib/lang';
import Home from './Home';

// Wrap the component with providers it depends on
function renderHome() {
  return render(
    <MemoryRouter>
      <LangProvider>
        <Home />
      </LangProvider>
    </MemoryRouter>
  );
}

// Mock all fetch calls so they return empty data
beforeEach(() => {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ sessions: [], words: [], attempts: [] }),
    })
  ) as unknown as typeof fetch;
});

describe('Home', () => {
  it('renders the welcome title', () => {
    renderHome();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    renderHome();
    expect(screen.getByText('Pick up where you left off, or start something new.')).toBeInTheDocument();
  });

  it('renders all navigation cards', () => {
    renderHome();
    expect(screen.getByText('Learning Session')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('My Word List')).toBeInTheDocument();
    expect(screen.getByText('Quiz')).toBeInTheDocument();
    expect(screen.getByText('Short Essay')).toBeInTheDocument();
    expect(screen.getByText('Scores & History')).toBeInTheDocument();
  });

  it('links to the correct routes', () => {
    renderHome();
    const links = screen.getAllByRole('link');
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/learning-session');
    expect(hrefs).toContain('/review');
    expect(hrefs).toContain('/word-list');
    expect(hrefs).toContain('/quiz');
    expect(hrefs).toContain('/essay');
    expect(hrefs).toContain('/stats');
  });

  it('shows empty states when no data exists', () => {
    renderHome();
    expect(screen.getByText('No sessions yet — read your first text.')).toBeInTheDocument();
    expect(screen.getByText('Double-click words during a session to build your list.')).toBeInTheDocument();
  });

  it('shows session data when API returns sessions', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/api/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            sessions: [{ id: 1, sessionTheme: 'Weather', createdAt: '2025-03-15T00:00:00Z' }],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ words: [], attempts: [] }),
      });
    }) as unknown as typeof fetch;

    renderHome();

    // waitFor retries until the assertion passes (because data loads async)
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(screen.getAllByText('Weather').length).toBeGreaterThan(0);
    });
  });

  it('shows word count when words exist', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/api/words')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            words: [
              { word: 'hund', sessionTheme: null, createdAt: '2025-03-15T00:00:00Z' },
              { word: 'katt', sessionTheme: null, createdAt: '2025-03-15T00:00:00Z' },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sessions: [], attempts: [] }),
      });
    }) as unknown as typeof fetch;

    renderHome();

    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(screen.getByText('hund')).toBeInTheDocument();
      expect(screen.getByText('katt')).toBeInTheDocument();
    });
  });
});
