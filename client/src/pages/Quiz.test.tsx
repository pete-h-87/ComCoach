import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '../lib/lang';
import Quiz from './Quiz';

function renderQuiz() {
  return render(
    <MemoryRouter>
      <LangProvider>
        <Quiz />
      </LangProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  globalThis.fetch = vi.fn((url: string) => {
    if (url.includes('/api/themes')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ themes: [] }),
      });
    }
    if (url.includes('/api/quiz/attempts')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ attempts: [] }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  }) as unknown as typeof fetch;
});

describe('Quiz', () => {
  it('renders the title', () => {
    renderQuiz();
    expect(screen.getByText('Quiz')).toBeInTheDocument();
  });

  it('renders quiz type options', () => {
    renderQuiz();
    expect(screen.getByText('Recent Words')).toBeInTheDocument();
    expect(screen.getByText('Random Words')).toBeInTheDocument();
    expect(screen.getByText('By Subject')).toBeInTheDocument();
  });

  it('renders difficulty options', () => {
    renderQuiz();
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.getByText('Expert')).toBeInTheDocument();
  });

  it('renders the Start Quiz button', () => {
    renderQuiz();
    expect(screen.getByText('Start Quiz')).toBeInTheDocument();
  });

  it('shows quiz type descriptions', () => {
    renderQuiz();
    expect(screen.getByText('10 words from your latest sessions')).toBeInTheDocument();
    expect(screen.getByText('10 words from anywhere in your list')).toBeInTheDocument();
    expect(screen.getByText('10 words from a session theme')).toBeInTheDocument();
  });

  it('shows difficulty descriptions', () => {
    renderQuiz();
    expect(screen.getByText('Define in English')).toBeInTheDocument();
    expect(screen.getByText('Define in Norwegian')).toBeInTheDocument();
  });

  it('shows recent scores when attempts exist', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/api/quiz/attempts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempts: [
              { id: 1, quizType: 'recent', difficulty: 'beginner', theme: null, total: 10, correct: 8, createdAt: '2025-04-01T00:00:00Z' },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ themes: [] }),
      });
    }) as unknown as typeof fetch;

    renderQuiz();
    await waitFor(() => {
      expect(screen.getByText('Recent Scores')).toBeInTheDocument();
      expect(screen.getByText('8/10')).toBeInTheDocument();
    });
  });
});
