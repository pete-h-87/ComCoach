import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LangProvider } from '../lib/lang';
import Sentences from './Sentences';

function renderSentences() {
  return render(
    <MemoryRouter>
      <LangProvider>
        <Sentences />
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

describe('Sentences', () => {
  it('renders the title', () => {
    renderSentences();
    expect(screen.getByText('Sentences')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    renderSentences();
    expect(screen.getByText('Practice using a word in a sentence. Write in Norwegian.')).toBeInTheDocument();
  });

  it('renders the word input', () => {
    renderSentences();
    expect(screen.getByPlaceholderText('Type a word to practice…')).toBeInTheDocument();
  });

  it('does not show sentence textarea until a word is entered', () => {
    renderSentences();
    expect(screen.queryByPlaceholderText('Write a sentence using this word…')).not.toBeInTheDocument();
  });

  it('renders the link to word list', () => {
    renderSentences();
    expect(screen.getByText('or pick from your word list →')).toBeInTheDocument();
  });

  it('shows sentence textarea when a word is present', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/sentences', state: { word: 'hund' } }]}>
        <LangProvider>
          <Sentences />
        </LangProvider>
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText('Write a sentence using this word…')).toBeInTheDocument();
  });

  it('shows Check button when word is present', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/sentences', state: { word: 'hund' } }]}>
        <LangProvider>
          <Sentences />
        </LangProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('Check')).toBeInTheDocument();
  });
});
