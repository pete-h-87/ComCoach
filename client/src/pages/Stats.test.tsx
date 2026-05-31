import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '../lib/lang';
import Stats from './Stats';

function renderStats() {
  return render(
    <MemoryRouter>
      <LangProvider>
        <Stats />
      </LangProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  globalThis.fetch = vi.fn((url: string) => {
    if (url.includes('/api/quiz/attempts')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ attempts: [] }),
      });
    }
    if (url.includes('/api/essay/attempts')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ attempts: [] }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
});

describe('Stats', () => {
  it('renders the title', () => {
    renderStats();
    expect(screen.getByText('Scores & History')).toBeInTheDocument();
  });

  it('renders section headers', () => {
    renderStats();
    expect(screen.getByText('Quizzes')).toBeInTheDocument();
    expect(screen.getByText('Essays')).toBeInTheDocument();
  });

  it('shows empty quiz state when no attempts', async () => {
    renderStats();
    await waitFor(() => {
      expect(screen.getByText('No quiz attempts yet — finish a quiz to see your scores here.')).toBeInTheDocument();
    });
  });

  it('shows empty essay state when no attempts', async () => {
    renderStats();
    await waitFor(() => {
      expect(screen.getByText('No essay attempts yet — submit one for grading to see it here.')).toBeInTheDocument();
    });
  });

  it('shows quiz stats when data exists', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/api/quiz/attempts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempts: [
              { id: 1, quizType: 'recent', difficulty: 'beginner', theme: null, total: 10, correct: 7, createdAt: '2025-04-01T00:00:00Z' },
              { id: 2, quizType: 'random', difficulty: 'expert', theme: null, total: 10, correct: 9, createdAt: '2025-04-02T00:00:00Z' },
            ],
          }),
        });
      }
      if (url.includes('/api/essay/attempts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ attempts: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    renderStats();
    await waitFor(() => {
      expect(screen.getByText('Quizzes Taken')).toBeInTheDocument();
      expect(screen.getByText('Average Score')).toBeInTheDocument();
      expect(screen.getByText('Best Score')).toBeInTheDocument();
    });
  });

  it('shows essay stats when data exists', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (url.includes('/api/quiz/attempts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ attempts: [] }),
        });
      }
      if (url.includes('/api/essay/attempts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            attempts: [
              { id: 1, targetLevel: 'B1', achievedLevel: 'B1', topic: 'My hobby', feedback: 'Good!', createdAt: '2025-04-01T00:00:00Z' },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;

    renderStats();
    await waitFor(() => {
      expect(screen.getByText('Essays Submitted')).toBeInTheDocument();
      expect(screen.getByText('Highest Level')).toBeInTheDocument();
      expect(screen.getByText('My hobby')).toBeInTheDocument();
    });
  });
});
