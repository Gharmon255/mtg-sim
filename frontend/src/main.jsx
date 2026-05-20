import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const DEFAULT_FORM = {
  deck: '',
  opponents: [],
  games: 50,
  maxTurns: 14,
  seed: 'web-demo'
};

function App() {
  const [decks, setDecks] = useState([]);
  const [precons, setPrecons] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState('simulate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [wizardsQuery, setWizardsQuery] = useState('final fantasy commander decklists');
  const [wizardsUrl, setWizardsUrl] = useState('');
  const [wizardsResults, setWizardsResults] = useState([]);
  const [wizardsOpen, setWizardsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [latestOpen, setLatestOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteName, setPasteName] = useState('Imported Commander Deck');
  const [pasteText, setPasteText] = useState('');
  const [pasteImportSummary, setPasteImportSummary] = useState(null);
  const [cardHydrationSummary, setCardHydrationSummary] = useState(null);

  useEffect(() => {
    refreshDecks();
    refreshPrecons();
  }, []);

  function refreshDecks() {
    return api('/api/decks')
      .then((data) => {
        const nextDecks = data.decks;
        setDecks(nextDecks);
        if (nextDecks.length) {
          setForm((current) => ({
            ...current,
            deck: nextDecks.find((deck) => deck.id === current.deck)?.id || nextDecks[0].id,
            opponents: current.opponents.filter((id) => nextDecks.some((deck) => deck.id === id)).length
              ? current.opponents.filter((id) => nextDecks.some((deck) => deck.id === id))
              : nextDecks.slice(1, 2).map((deck) => deck.id)
          }));
        }
      })
      .catch((requestError) => setError(requestError.message));
  }

  function refreshPrecons() {
    return api('/api/precons')
      .then((data) => setPrecons(data.precons))
      .catch((requestError) => setError(requestError.message));
  }

  const selectedDeck = useMemo(() => decks.find((deck) => deck.id === form.deck), [decks, form.deck]);
  const selectedDeckEntries = useMemo(() => parseDeckPreview(selectedDeck?.content || ''), [selectedDeck]);

  function deckLabel(deckId) {
    return decks.find((deck) => deck.id === deckId)?.name || 'Drop deck here';
  }

  function assignDeck(slot, deckId) {
    if (!deckId) return;
    setForm((current) => {
      if (slot === 'primary') return { ...current, deck: deckId };
      const opponents = current.opponents.slice();
      opponents[slot] = deckId;
      return { ...current, opponents };
    });
  }

  function onDragStart(event, deckId) {
    event.dataTransfer.setData('text/plain', deckId);
    event.dataTransfer.effectAllowed = 'copy';
  }

  function allowDrop(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function onDrop(event, slot) {
    event.preventDefault();
    assignDeck(slot, event.dataTransfer.getData('text/plain'));
  }

  function updateOpponent(index, value) {
    setForm((current) => {
      const opponents = current.opponents.slice();
      opponents[index] = value;
      return { ...current, opponents };
    });
  }

  function addOpponent() {
    setForm((current) => {
      if (current.opponents.length >= 3) return current;
      const nextDeck = decks.find((deck) => deck.id !== current.deck)?.id || decks[0]?.id || '';
      return { ...current, opponents: current.opponents.concat(nextDeck) };
    });
  }

  function removeOpponent(index) {
    setForm((current) => ({
      ...current,
      opponents: current.opponents.filter((_, opponentIndex) => opponentIndex !== index)
    }));
  }

  async function runValidate() {
    await runAction(async () => {
      const data = await api('/api/validate', { deck: { id: form.deck } });
      setValidation(data);
      setActiveTab('validate');
    });
  }

  async function runAnalyze() {
    await runAction(async () => {
      const data = await api('/api/analyze', { deck: { id: form.deck } });
      setAnalysis(data);
      setActiveTab('analyze');
    });
  }

  async function runSimulate() {
    await runAction(async () => {
      const data = await api('/api/simulate', {
        deck: { id: form.deck },
        opponents: form.opponents.map((id) => ({ id })),
        games: Number(form.games),
        maxTurns: Number(form.maxTurns),
        seed: form.seed
      });
      setSimulation(data);
      setActiveTab('simulate');
    });
  }

  async function importPrecons() {
    await runAction(async () => {
      await api('/api/precons/import', {});
      await refreshDecks();
      await refreshPrecons();
    });
  }

  async function searchWizards() {
    await runAction(async () => {
      const data = await api(`/api/wizards/search?query=${encodeURIComponent(wizardsQuery)}`);
      setWizardsResults(data.results);
    });
  }

  async function importWizardsUrl(url) {
    await runAction(async () => {
      await api('/api/wizards/import', {
        url,
        cardLimit: 10,
        skipCardCache: false
      });
      await refreshDecks();
      await refreshPrecons();
      setWizardsOpen(false);
    });
  }

  async function importPastedDeck() {
    await runAction(async () => {
      const data = await api('/api/decks/import', {
        name: pasteName,
        text: pasteText
      });
      if (!data.saved) {
        throw new Error((data.errors || []).join(' ') || 'Deck could not be imported.');
      }
      await refreshDecks();
      setForm((current) => ({ ...current, deck: data.deckId }));
      setPasteImportSummary(data.hydration);
      setPasteOpen(false);
    });
  }

  async function deleteDeck(deckId) {
    const deck = decks.find((candidate) => candidate.id === deckId);
    if (!deck) return;
    const confirmed = window.confirm(`Delete ${deck.name}? This removes the deck file from your local library.`);
    if (!confirmed) return;
    await runAction(async () => {
      await api('/api/decks/delete', { deckId });
      await refreshDecks();
      setForm((current) => {
        const remaining = decks.filter((candidate) => candidate.id !== deckId);
        const nextPrimary = current.deck === deckId ? remaining[0]?.id || '' : current.deck;
        const nextOpponents = current.opponents.filter((opponent) => opponent !== deckId);
        return {
          ...current,
          deck: nextPrimary,
          opponents: nextOpponents.length ? nextOpponents : remaining.filter((candidate) => candidate.id !== nextPrimary).slice(0, 1).map((candidate) => candidate.id)
        };
      });
    });
  }

  async function hydrateSelectedDeck() {
    if (!form.deck) return;
    await runAction(async () => {
      const data = await api('/api/cards/hydrate', {
        deck: { id: form.deck },
        timeoutMs: 10000
      });
      setCardHydrationSummary(data.hydration);
      await refreshDecks();
    });
  }

  async function runAction(action) {
    setLoading(true);
    setError('');
    try {
      await action();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">MVP Commander Lab</p>
            <h1>Commander Simulator</h1>
          </div>
          <div className="status-pill">{decks.length} decks</div>
        </header>

        <section className="setup-band">
          <div
            className="drop-slot primary-slot"
            onDragOver={allowDrop}
            onDrop={(event) => onDrop(event, 'primary')}
          >
            <span>Deck to test</span>
            <strong>{deckLabel(form.deck)}</strong>
            <select value={form.deck} onChange={(event) => assignDeck('primary', event.target.value)}>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>{deck.name}</option>
              ))}
            </select>
          </div>

          <div className="field number-field">
            <label htmlFor="games">Games</label>
            <input id="games" type="number" min="1" max="1000" value={form.games} onChange={(event) => setForm({ ...form, games: event.target.value })} />
          </div>

          <div className="field number-field">
            <label htmlFor="maxTurns">Max turns</label>
            <input id="maxTurns" type="number" min="4" max="50" value={form.maxTurns} onChange={(event) => setForm({ ...form, maxTurns: event.target.value })} />
          </div>

          <div className="field seed-field">
            <label htmlFor="seed">Seed</label>
            <input id="seed" value={form.seed} onChange={(event) => setForm({ ...form, seed: event.target.value })} />
          </div>
        </section>

        <section className="opponent-band">
          <div className="section-title">
            <h2>Opponents</h2>
            <button className="icon-button" type="button" onClick={addOpponent} disabled={form.opponents.length >= 3} title="Add opponent">+</button>
          </div>
          <div className="opponent-grid">
            {form.opponents.map((opponent, index) => (
              <div
                className="drop-slot opponent-slot"
                key={`${opponent}-${index}`}
                onDragOver={allowDrop}
                onDrop={(event) => onDrop(event, index)}
              >
                <span>Opponent {index + 1}</span>
                <strong>{deckLabel(opponent)}</strong>
                <div className="opponent-row">
                  <select value={opponent} onChange={(event) => updateOpponent(index, event.target.value)}>
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>{deck.name}</option>
                    ))}
                  </select>
                  <button className="icon-button" type="button" onClick={() => removeOpponent(index)} disabled={form.opponents.length <= 1} title="Remove opponent">x</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="deck-library-band">
          <div className="section-title">
            <div>
              <h2>Deck Library</h2>
              <p>Drag a deck tile into the test deck or opponent spots.</p>
            </div>
            <button type="button" onClick={hydrateSelectedDeck} disabled={loading || !form.deck}>Check Card Data</button>
            <button type="button" onClick={() => setLibraryOpen((open) => !open)}>{libraryOpen ? 'Collapse' : 'Expand'}</button>
          </div>
          {cardHydrationSummary && (
            <p className="import-summary">
              Scryfall checked {cardHydrationSummary.lookedUp} cards: {cardHydrationSummary.found} found, {cardHydrationSummary.fuzzyFound} fuzzy, {cardHydrationSummary.deferred || 0} deferred, {cardHydrationSummary.placeholders} unresolved.
            </p>
          )}
          {libraryOpen && (
            <div className="deck-tile-grid">
              {decks.map((deck) => (
              <article
                  className={deck.id === form.deck || form.opponents.includes(deck.id) ? 'deck-tile selected' : 'deck-tile'}
                  key={deck.id}
                  draggable
                  onDragStart={(event) => onDragStart(event, deck.id)}
                  onClick={() => assignDeck('primary', deck.id)}
                  title="Click to set as test deck, or drag to a slot"
              >
                <DeckImage deck={deck} />
                <div className="deck-tile-meta">
                  <strong>{deck.name}</strong>
                  <small>{deck.commanderName || deck.group}</small>
                </div>
                <button
                  type="button"
                  className="tile-delete"
                  title={`Delete ${deck.name}`}
                  aria-label={`Delete ${deck.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteDeck(deck.id);
                  }}
                >
                  x
                </button>
              </article>
            ))}
          </div>
          )}
        </section>

        <section className="precon-band">
          <div className="section-title">
            <div>
              <h2>Latest Precons</h2>
              <p>Secrets of Strixhaven, Teenage Mutant Ninja Turtles, and Lorwyn Eclipsed</p>
            </div>
            <button type="button" onClick={importPrecons} disabled={loading}>
              {loading ? 'Importing...' : 'Import Latest'}
            </button>
            <button type="button" onClick={() => setLatestOpen((open) => !open)}>{latestOpen ? 'Collapse' : 'Expand'}</button>
          </div>
          {latestOpen && (
            <div className="precon-grid">
              {precons.map((precon) => (
                <button
                  className={precon.imported ? 'precon-chip imported' : 'precon-chip'}
                  type="button"
                  key={precon.slug}
                  disabled={!precon.imported}
                  draggable={precon.imported}
                  onDragStart={(event) => precon.imported && onDragStart(event, precon.deckId)}
                  onClick={() => precon.imported && setForm((current) => ({ ...current, deck: precon.deckId }))}
                  title={precon.imported ? 'Click to set as test deck, or drag to a slot' : 'Import this precon first'}
                >
                  <span>{precon.title}</span>
                  <small>{precon.setName}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="paste-band">
          <div className="section-title">
            <div>
              <h2>Import Pasted List</h2>
              <p>Paste a Manabox or Moxfield-style decklist.</p>
            </div>
            <button type="button" onClick={() => setPasteOpen((open) => !open)}>{pasteOpen ? 'Collapse' : 'Expand'}</button>
          </div>
          {pasteOpen && (
            <div className="paste-body">
              <input value={pasteName} onChange={(event) => setPasteName(event.target.value)} placeholder="Deck name" />
              <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="// COMMANDER&#10;1 Commander Name&#10;&#10;// DECK&#10;1 Sol Ring" />
              <button type="button" onClick={importPastedDeck} disabled={loading || !pasteText.trim()}>Import Pasted Deck</button>
            </div>
          )}
          {!pasteOpen && pasteImportSummary && (
            <p className="import-summary">
              Scryfall checked {pasteImportSummary.lookedUp} cards: {pasteImportSummary.found} found, {pasteImportSummary.fuzzyFound} fuzzy, {pasteImportSummary.deferred || 0} deferred, {pasteImportSummary.placeholders} unresolved.
            </p>
          )}
        </section>

        <section className="wizards-band">
          <div className="section-title">
            <div>
              <h2>Import From Wizards</h2>
              <p>{wizardsResults.length ? `${wizardsResults.length} result${wizardsResults.length === 1 ? '' : 's'} ready` : 'Search official Magic articles or paste a URL.'}</p>
            </div>
            <button type="button" onClick={() => setWizardsOpen((open) => !open)}>
              {wizardsOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {wizardsOpen && (
            <div className="wizards-body">
              <div className="wizards-search-row">
                <input value={wizardsQuery} onChange={(event) => setWizardsQuery(event.target.value)} placeholder="Search Wizards decklists" />
                <button type="button" onClick={searchWizards} disabled={loading || !wizardsQuery.trim()}>Search</button>
              </div>
              <div className="wizards-search-row">
                <input value={wizardsUrl} onChange={(event) => setWizardsUrl(event.target.value)} placeholder="Paste a magic.wizards.com decklist article URL" />
                <button type="button" onClick={() => importWizardsUrl(wizardsUrl)} disabled={loading || !wizardsUrl.trim()}>Import URL</button>
              </div>
              {wizardsResults.length > 0 && (
                <div className="wizards-results">
                  {wizardsResults.map((result) => (
                    <article className="wizards-result" key={result.url}>
                      <div>
                        <h3>{result.title}</h3>
                        <p>{result.deckCount} decklist{result.deckCount === 1 ? '' : 's'} found</p>
                        <small>{result.deckTitles.join(', ')}</small>
                      </div>
                      <button type="button" onClick={() => importWizardsUrl(result.url)} disabled={loading}>Import</button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="action-row">
          <button type="button" onClick={runValidate} disabled={loading}>Validate</button>
          <button type="button" onClick={runAnalyze} disabled={loading}>Analyze</button>
          <button type="button" className="primary-action" onClick={runSimulate} disabled={loading || form.opponents.length < 1}>
            {loading ? 'Running...' : 'Run Simulation'}
          </button>
        </section>

        {error && <div className="error-banner">{error}</div>}

        <section className="results-layout">
          <aside className="deck-preview">
            <h2>{selectedDeck?.name || 'Deck'}</h2>
            {selectedDeckEntries.length ? (
              <div className="card-list-editor">
                {selectedDeckEntries.map((entry) => (
                  <div className={entry.zone === 'commander' ? 'card-row commander-row' : 'card-row'} key={`${entry.zone}-${entry.name}`}>
                    <span>{entry.quantity} {entry.name}</span>
                    <small>{entry.zone === 'commander' ? 'Commander' : 'Deck'}</small>
                  </div>
                ))}
              </div>
            ) : (
              <pre>{selectedDeck?.content || 'Loading decks...'}</pre>
            )}
          </aside>

          <section className="results-panel">
            <nav className="tabs" aria-label="Results">
              <button type="button" className={activeTab === 'simulate' ? 'active' : ''} onClick={() => setActiveTab('simulate')}>Simulation</button>
              <button type="button" className={activeTab === 'validate' ? 'active' : ''} onClick={() => setActiveTab('validate')}>Validation</button>
              <button type="button" className={activeTab === 'analyze' ? 'active' : ''} onClick={() => setActiveTab('analyze')}>Analysis</button>
            </nav>

            {activeTab === 'simulate' && <SimulationResults simulation={simulation} />}
            {activeTab === 'validate' && <ValidationResults validation={validation} />}
            {activeTab === 'analyze' && <AnalysisResults analysis={analysis} />}
          </section>
        </section>
      </section>
    </main>
  );
}

function SimulationResults({ simulation }) {
  if (!simulation) return <EmptyState title="No simulation yet" body="Choose decks and run a simulation to see win rates, pacing, and deck scores." />;
  return (
    <div className="result-stack">
      <div className="summary-grid">
        <Metric label="Games" value={simulation.report.gamesSimulated} />
        <Metric label="Avg Length" value={`${simulation.report.averageGameLength} turns`} />
      </div>
      <div className="deck-stat-grid">
        {simulation.report.decks.map((deck) => (
          <article className="stat-card" key={deck.name}>
            <h3>{deck.name}</h3>
            <div className="win-rate">{deck.winRate}</div>
            <p>{deck.wins}/{deck.games} games won</p>
            {deck.power && (
              <p className="power-line">
                Bracket {deck.power.estimatedBracket} - {deck.power.bracketLabel} · {deck.power.archetype.primaryArchetype} · Combo {deck.power.comboDensityScore}
              </p>
            )}
            <dl>
              <dt>Avg win turn</dt><dd>{deck.averageWinTurn}</dd>
              <dt title="Games where the deck had fewer than 3 land mana by its fourth turn.">Mana shortfall</dt><dd>{deck.manaScrewRate}</dd>
              <dt title="Games where the deck had 4 or more lands stuck in hand from turn six onward.">Excess land hands</dt><dd>{deck.manaFloodRate}</dd>
              <dt>Avg cards drawn</dt><dd>{deck.averageCardsDrawn}</dd>
              <dt>Avg ramp/removal</dt><dd>{deck.averageRampPlayed} / {deck.averageRemovalUsed}</dd>
              <dt>Commander cast</dt><dd>{deck.averageCommanderCastTurn}</dd>
            </dl>
            <div className="score-row">
              <Metric label="Consistency" value={deck.deckConsistencyScore} />
              <Metric label="Aggression" value={deck.aggressionScore} />
              <Metric label="Resilience" value={deck.resilienceScore} />
              <Metric label="Interaction" value={deck.interactionScore} />
            </div>
          </article>
        ))}
      </div>
      <pre className="text-report">{simulation.text}</pre>
      {simulation.report.podWarnings?.length > 0 && (
        <section className="breakdown">
          <h3>Pod Warnings</h3>
          {simulation.report.podWarnings.map((warning) => <p className="muted" key={warning}>{warning}</p>)}
        </section>
      )}
    </div>
  );
}

function ValidationResults({ validation }) {
  if (!validation) return <EmptyState title="No validation yet" body="Run validation to check deck size, singleton rules, commander identity, and missing data." />;
  const { result, deck } = validation;
  return (
    <div className="result-stack">
      <div className={result.valid ? 'success-banner' : 'error-banner'}>
        {deck.name} is {result.valid ? 'valid for the MVP checks' : 'not valid yet'}.
      </div>
      <MessageList title="Errors" messages={result.errors} />
      <MessageList title="Warnings" messages={result.warnings} />
    </div>
  );
}

function AnalysisResults({ analysis }) {
  if (!analysis) return <EmptyState title="No analysis yet" body="Run analysis to inspect the deck's mana curve, tags, and rough strategic scores." />;
  const data = analysis.analysis;
  return (
    <div className="result-stack">
      <div className="summary-grid">
        <Metric label="Cards" value={data.totalCards} />
        <Metric label="Average MV" value={data.averageManaValue} />
        <Metric label="Strategy" value={data.strategy.archetype} />
        <Metric label="Consistency" value={data.consistencyScore} />
        <Metric label="Aggression" value={data.aggressionScore} />
        <Metric label="Interaction" value={data.interactionScore} />
      </div>
      {data.strategy.comboHints.length > 0 && (
        <section className="breakdown">
          <h3>Combo Hints</h3>
          {data.strategy.comboHints.map((hint) => (
            <p className="muted" key={hint.note}>{hint.cards.join(' + ')}: {hint.note}</p>
          ))}
        </section>
      )}
      <div className="split-results">
        <Breakdown title="Buckets" data={data.buckets} />
        <Breakdown title="Mana Curve" data={data.manaCurve} />
      </div>
    </div>
  );
}

function MessageList({ title, messages }) {
  return (
    <section>
      <h3>{title}</h3>
      {messages.length ? (
        <ul className="message-list">
          {messages.map((message) => <li key={message}>{message}</li>)}
        </ul>
      ) : (
        <p className="muted">None.</p>
      )}
    </section>
  );
}

function Breakdown({ title, data }) {
  return (
    <section className="breakdown">
      <h3>{title}</h3>
      {Object.entries(data).map(([label, value]) => (
        <div className="bar-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function DeckImage({ deck }) {
  if (deck.commanderImage) {
    return <img className="deck-tile-image" src={deck.commanderImage} alt="" loading="lazy" />;
  }
  const initial = (deck.commanderName || deck.name || '?').trim().charAt(0).toUpperCase();
  return <span className="deck-tile-image image-placeholder">{initial}</span>;
}

async function api(path, body) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function parseDeckPreview(text) {
  const entries = [];
  let zone = 'mainboard';
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('//')) {
      const heading = line.replace(/^\/\//, '').trim().toLowerCase();
      if (heading.includes('commander')) zone = 'commander';
      if (heading.includes('deck') || heading.includes('main')) zone = 'mainboard';
      continue;
    }
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    entries.push({
      quantity: Number(match[1]),
      name: match[2],
      zone
    });
  }
  return entries;
}

createRoot(document.getElementById('root')).render(<App />);
