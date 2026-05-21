const { CommanderRules } = require('../rules/CommanderRules');
const { analyzeDeckStrategy } = require('../decks/DeckStrategy');
const { CardTagger } = require('../cards/CardTagger');
const { buildAvailableManaPool, canPayCard, payCard, missingColorsForCard } = require('../rules/ManaPayment');
const { LandSequencer } = require('../cards/lands/LandSequencer');
const { ZoneManager } = require('./ZoneManager');
const { TokenManager } = require('./TokenManager');
const { ManaSourceManager } = require('./ManaSourceManager');

class PlayerState {
  constructor({ id, name, deck, cardDatabase, random, strategyProfile, tagger }) {
    this.id = id;
    this.name = name;
    this.deck = deck;
    this.cardDatabase = cardDatabase;
    this.random = random;
    this.life = CommanderRules.startingLife;
    this.library = [];
    this.hand = [];
    this.battlefield = [];
    this.graveyard = [];
    this.exile = [];
    this.commandZone = [];
    this.availableMana = 0;
    this.manaPool = null;
    this.treasures = 0;
    this.floatingMana = 0;
    this.rampMana = 0;
    this.landsPlayedThisTurn = 0;
    this.turnCount = 0;
    this.cardsDrawn = 0;
    this.damageDealt = 0;
    this.boardScore = 0;
    this.threatScore = 0;
    this.interactionShield = 0;
    this.commanderDamageShield = 0;
    this.eliminated = false;
    this.commanderCastCount = 0;
    this.commanderCastCounts = new Map();
    this.commanderPermanentNames = new Set();
    this.commanderCombatPower = new Map();
    this.commanderDamage = new Map();
    this.strategy = null;
    this.strategyProfile = strategyProfile || null;
    this.tagger = tagger || new CardTagger();
    this.landSequencer = new LandSequencer();
    this.zoneManager = new ZoneManager(this);
    this.tokenManager = new TokenManager(this);
    this.manaSourceManager = new ManaSourceManager(this);
    this.exhaustedRampSources = new Set();
    this.lastLandPlay = null;
    this.exhaustedRampSources.clear();
    this.metrics = {
      openingHandLands: 0,
      mulligans: 0,
      rampPlayed: 0,
      removalUsed: 0,
      drawSpellsCast: 0,
      creaturesCast: 0,
      boardWipesCast: 0,
      counterspellsHeld: 0,
      counterspellsUsed: 0,
      interactionUsed: 0,
      tutorsUsed: 0,
      tutorTargets: {},
      tutorReasons: {},
      tutorEfficiencyTotal: 0,
      highValueTutorTargets: 0,
      protectionUsed: 0,
      successfulProtection: 0,
      wastedProtection: 0,
      protectionHeldTooLong: 0,
      comboAttemptsStopped: 0,
      lethalAttacksStopped: 0,
      highImpactSpellsStopped: 0,
      highImpactInteractionUsed: 0,
      counterPriorityTotal: 0,
      counterPriorityCount: 0,
      highPriorityCounters: 0,
      wastedCounters: 0,
      removalQualityTotal: 0,
      removalQualityCount: 0,
      boardWipeQualityTotal: 0,
      boardWipeQualityCount: 0,
      commanderSequencingGood: 0,
      commanderSequencingDelayed: 0,
      cardSequencingScoreTotal: 0,
      cardSequencingScoreCount: 0,
      behaviorOverridesUsed: 0,
      behaviorEvents: {},
      cardsHeldForBetterTiming: 0,
      heldInteractionTurns: 0,
      earlyCombatDamage: 0,
      graveyardSetupActions: 0,
      reanimationActions: 0,
      sacrificeActions: 0,
      comboAttempts: 0,
      comboWins: 0,
      failedComboAttempts: 0,
      stoppedComboAttempts: 0,
      comboAttemptTurns: [],
      comboPiecesSeen: 0,
      staxPiecesCast: 0,
      riskyKeeps: 0,
      noLandMulligans: 0,
      noSourceMulligans: 0,
      colorScrewMulligans: 0,
      fixingBasedKeeps: 0,
      fastManaKeeps: 0,
      strategyKeeps: 0,
      winType: null,
      spellsCast: 0,
      commanderCastTurn: null,
      manaScrewTurns: 0,
      manaFloodTurns: 0,
      colorScrewTurns: 0,
      colorStrandedCards: 0,
      manaStrandedCards: 0,
      castableCardsSeen: 0,
      uncastableColorCardsSeen: 0,
      uncastableManaCardsSeen: 0,
      commanderColorFailureTurns: 0,
      missingColors: {},
      colorFixingActions: 0,
      fetchesUsed: 0,
      failedFetches: 0,
      shockDamageTaken: 0,
      colorsFixedByFetches: 0,
      landsPlayedByTurn3: 0,
      untappedEarlySources: 0,
      manaPaymentsAttempted: 0,
      manaPaymentsSucceeded: 0,
      manaPaymentsFailed: 0,
      cardsStrandedByTappedSources: 0,
      manaSourcesTapped: 0,
      treasuresCreated: 0,
      treasuresUsed: 0,
      treasureFixingEvents: 0,
      treasureTempoEvents: 0,
      oneShotSourcesUsed: 0,
      dorkCasts: 0,
      dorkManaActivations: 0,
      dorkUnavailableDueToSummoningSickness: 0,
      doubleSpendPreventionEvents: 0,
      paymentFailureReasons: {},
      activatedAbilitiesUsed: 0,
      manaAbilitiesActivated: 0,
      untapAbilitiesActivated: 0,
      channelAbilitiesUsed: 0,
      fetchActivations: 0,
      failedFetchActivations: 0,
      lifePaidToFetches: 0,
      lifePaidToAncientTomb: 0,
      manaVaultDamage: 0,
      manaCryptDamage: 0,
      imprintCostsPaid: 0,
      discardCostsPaid: 0,
      badActivationsAvoided: 0,
      badLedActivationsAvoided: 0,
      ledActivations: 0,
      treasureTriggers: 0,
      treasuresBySource: {},
      fetchTargetsChosen: {},
      esperSentinelTriggers: 0,
      esperSentinelDraws: 0,
      lossReason: null
    };
  }

  setup() {
    this.strategy = analyzeDeckStrategy(this.deck, this.cardDatabase);
    this.commandZone = this.deck.commanders.flatMap((entry) => this.expandEntry(entry));
    for (const commander of this.commandZone) {
      commander.isCommander = true;
      commander.ownerId = this.id;
    }
    this.library = this.random.shuffle(this.deck.mainboard.flatMap((entry) => this.expandEntry(entry)));
  }

  expandEntry(entry) {
    const card = this.cardDatabase.get(entry.name) || {
      name: entry.name,
      manaCost: '',
      manaValue: 3,
      colors: [],
      colorIdentity: [],
      typeLine: 'Unknown',
      oracleText: '',
      tags: []
    };
    const tags = Array.from(new Set((card.tags || []).concat(this.tagger.tagsFor(card))));
    return Array.from({ length: entry.quantity }, () => ({ ...card, tags }));
  }

  draw(count = 1) {
    for (let i = 0; i < count; i += 1) {
      const card = this.library.shift();
      if (card) {
        this.hand.push(card);
        this.cardsDrawn += 1;
      }
    }
  }

  startTurn() {
    this.turnCount += 1;
    this.landsPlayedThisTurn = 0;
    this.lastLandPlay = null;
    this.zoneManager.untapStep(this.turnCount);
    this.refreshManaPool();
    this.interactionShield = Math.max(0, this.interactionShield - 1);
    this.commanderDamageShield = Math.max(0, this.commanderDamageShield - 1);
  }

  refreshManaPool() {
    this.manaPool = buildAvailableManaPool(this);
    this.availableMana = this.manaPool.total();
    return this.manaPool;
  }

  availableLandMana() {
    return this.battlefield.filter((card) => (card.tags || []).includes('land')).length;
  }

  playLand() {
    if (this.landsPlayedThisTurn > 0) return null;
    const selection = this.landSequencer.chooseLand(this);
    if (!selection) return null;
    const card = this.hand.splice(selection.index, 1)[0];
    const played = this.resolveLandPlay(card, selection);
    this.landsPlayedThisTurn += 1;
    if (this.turnCount <= 3) this.metrics.landsPlayedByTurn3 = (this.metrics.landsPlayedByTurn3 || 0) + 1;
    if (this.turnCount <= 3 && !played.tappedUntilNextTurn) {
      this.metrics.untappedEarlySources = (this.metrics.untappedEarlySources || 0) + 1;
    }
    this.lastLandPlay = {
      land: played.name,
      fetch: selection.fetchTarget ? card.name : null,
      reasons: selection.reasons || [],
      tapped: Boolean(played.tappedUntilNextTurn),
      shockUntapped: Boolean(selection.shockUntapped)
    };
    this.refreshManaPool();
    return played;
  }

  resolveLandPlay(card, selection) {
    if (selection.fetchTarget) {
      const fetchPermanent = this.addPermanent({ ...card }, { summoningSick: false });
      fetchPermanent.tapped = true;
      this.life -= 1;
      this.metrics.activatedAbilitiesUsed = (this.metrics.activatedAbilitiesUsed || 0) + 1;
      this.metrics.fetchActivations = (this.metrics.fetchActivations || 0) + 1;
      this.metrics.lifePaidToFetches = (this.metrics.lifePaidToFetches || 0) + 1;
      const targetIndex = this.library.indexOf(selection.fetchTarget);
      if (targetIndex >= 0) {
        const target = this.library.splice(targetIndex, 1)[0];
        const fetched = { ...target };
        if (selection.targetEntersTapped) fetched.tappedUntilNextTurn = true;
        this.zoneManager.movePermanentToGraveyard(fetchPermanent);
        const permanent = this.addPermanent(fetched, { summoningSick: false });
        this.metrics.fetchesUsed = (this.metrics.fetchesUsed || 0) + 1;
        this.metrics.colorFixingActions = (this.metrics.colorFixingActions || 0) + 1;
        this.metrics.colorsFixedByFetches = (this.metrics.colorsFixedByFetches || 0) + 1;
        this.metrics.fetchTargetsChosen = this.metrics.fetchTargetsChosen || {};
        this.metrics.fetchTargetsChosen[fetched.name] = (this.metrics.fetchTargetsChosen[fetched.name] || 0) + 1;
        if (selection.shockUntapped) {
          this.life -= 2;
          this.metrics.shockDamageTaken = (this.metrics.shockDamageTaken || 0) + 2;
        }
        return permanent;
      }
      this.zoneManager.movePermanentToGraveyard(fetchPermanent);
      this.metrics.failedFetches = (this.metrics.failedFetches || 0) + 1;
      this.metrics.failedFetchActivations = (this.metrics.failedFetchActivations || 0) + 1;
      return fetchPermanent;
    }

    const played = { ...card };
    if (selection.entersTapped) played.tappedUntilNextTurn = true;
    if (selection.shockUntapped) {
      this.life -= 2;
      this.metrics.shockDamageTaken = (this.metrics.shockDamageTaken || 0) + 2;
    }
    return this.addPermanent(played, { summoningSick: false });
  }

  addPermanent(card, options = {}) {
    const permanent = this.zoneManager.addToBattlefield(card, options);
    if (/creature/i.test(permanent.typeLine || '') && (permanent.tags || []).includes('ramp')) {
      this.metrics.dorkCasts = (this.metrics.dorkCasts || 0) + 1;
    }
    return permanent;
  }

  createTreasures(count, sourceName) {
    return this.tokenManager.createTreasure(count, sourceName);
  }

  removeFromHand(card) {
    const index = this.hand.indexOf(card);
    if (index >= 0) this.hand.splice(index, 1);
  }

  canPayCard(card, options = {}) {
    return canPayCard(this, card, options);
  }

  payCard(card, options = {}) {
    return payCard(this, card, options);
  }

  missingColorsForCard(card) {
    return missingColorsForCard(this, card);
  }
}

module.exports = { PlayerState };
