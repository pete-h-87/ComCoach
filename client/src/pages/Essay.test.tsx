import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '../lib/lang';
import Essay from './Essay';

function renderEssay() {
  return render(
    <MemoryRouter>
      <LangProvider>
        <Essay />
      </LangProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  globalThis.fetch = vi.fn((url: string) => {
    if (url.includes('/api/essay/attempts')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ attempts: [] }),
      });
    }
    if (url.includes('/api/themes')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ themes: [] }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  }) as unknown as typeof fetch;
});

describe('Essay', () => {
  it('renders the title', () => {
    renderEssay();
    expect(screen.getByText('Short Essay')).toBeInTheDocument();
  });

  it('renders the target level section', () => {
    renderEssay();
    expect(screen.getByText('Target Level')).toBeInTheDocument();
  });

  it('renders all CEFR level buttons', () => {
    renderEssay();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
    expect(screen.getByText('B2')).toBeInTheDocument();
  });

  it('renders the subject section', () => {
    renderEssay();
    expect(screen.getByText('Subject')).toBeInTheDocument();
  });

  it('renders the Generate Question button', () => {
    renderEssay();
    expect(screen.getByText('Generate Question')).toBeInTheDocument();
  });

  it('shows the Random Question option in the select', () => {
    renderEssay();
    expect(screen.getByText('Random Question')).toBeInTheDocument();
  });

  it('shows recent essays when attempts exist', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/api/essay/attempts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempts: [
              { id: 1, targetLevel: 'B1', achievedLevel: 'A2', topic: 'Describe your city', createdAt: '2025-04-01T00:00:00Z' },
            ],
          }),
        });
      }
      if (url.includes('/api/themes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ themes: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    renderEssay();
    await waitFor(() => {
      expect(screen.getByText('Recent Essays')).toBeInTheDocument();
      expect(screen.getByText('Describe your city')).toBeInTheDocument();
    });
  });
});
