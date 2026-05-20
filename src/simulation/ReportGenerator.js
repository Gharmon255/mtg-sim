const { BracketAnalyzer } = require('../analysis/BracketAnalyzer');

class ReportGenerator {
  constructor(options = {}) {
    this.cardDatabase = options.cardDatabase || null;
    this.decks = options.decks || [];
  }

  generate(result) {
    const games = result.games;
    const deckStats = new Map();

    for (const name of result.deckNames) {
      deckStats.set(name, {
        games: 0,
        wins: 0,
        winTurns: [],
        openingLands: 0,
        cardsDrawn: 0,
        rampPlayed: 0,
        removalUsed: 0,
        commanderCastTurns: [],
        manaScrewGames: 0,
        manaFloodGames: 0,
        damageDealt: 0,
        boardScore: 0,
        mulligans: 0,
        riskyKeeps: 0,
        noLandMulligans: 0,
        noSourceMulligans: 0,
        colorScrewMulligans: 0,
        fixingBasedKeeps: 0,
        fastManaKeeps: 0,
        strategyKeeps: 0,
        colorScrewTurns: 0,
        colorStrandedCards: 0,
        manaStrandedCards: 0,
        uncastableColorCardsSeen: 0,
        uncastableManaCardsSeen: 0,
        commanderColorFailureTurns: 0,
        landsPlayedByTurn3: 0,
        untappedEarlySources: 0,
        fetchesUsed: 0,
        failedFetches: 0,
        shockDamageTaken: 0,
        colorFixingActions: 0,
        colorsFixedByFetches: 0,
        missingColors: new Map(),
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
        dorkManaActivations: 0,
        dorkUnavailableDueToSummoningSickness: 0,
        doubleSpendPreventionEvents: 0,
        paymentFailureReasons: new Map(),
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
        ledActivations: 0,
        badLedActivationsAvoided: 0,
        treasureTriggers: 0,
        treasuresBySource: new Map(),
        comboAttempts: 0,
        comboWins: 0,
        failedComboAttempts: 0,
        stoppedComboAttempts: 0,
        comboAttemptTurns: [],
        interactionUsed: 0,
        counterspellsUsed: 0,
        protectionUsed: 0,
        comboAttemptsStopped: 0,
        lethalAttacksStopped: 0,
        highImpactSpellsStopped: 0,
        heldInteractionTurns: 0,
        boardWipesCast: 0,
        commanderDamageKills: 0,
        winTypes: new Map(),
        tutorTargets: new Map(),
        tutorsUsed: 0,
        tutorEfficiencyTotal: 0,
        highValueTutorTargets: 0,
        counterPriorityTotal: 0,
        counterPriorityCount: 0,
        highPriorityCounters: 0,
        wastedCounters: 0,
        successfulProtection: 0,
        wastedProtection: 0,
        removalQualityTotal: 0,
        removalQualityCount: 0,
        boardWipeQualityTotal: 0,
        boardWipeQualityCount: 0,
        commanderSequencingGood: 0,
        commanderSequencingDelayed: 0,
        cardSequencingScoreTotal: 0,
        cardSequencingScoreCount: 0,
        behaviorOverridesUsed: 0,
        cardsHeldForBetterTiming: 0,
        behaviorEvents: new Map(),
        lossReasons: new Map()
      });
    }

    for (const game of games) {
      for (const player of game.players) {
        const stats = deckStats.get(player.name);
        stats.games += 1;
        if (player.won) {
          stats.wins += 1;
          stats.winTurns.push(game.turns);
          const winType = player.metrics.winType || inferWinType(player.metrics, game);
          stats.winTypes.set(winType, (stats.winTypes.get(winType) || 0) + 1);
        } else {
          const reason = player.metrics.lossReason || 'unknown';
          stats.lossReasons.set(reason, (stats.lossReasons.get(reason) || 0) + 1);
          if (reason.includes('commander damage')) stats.commanderDamageKills += 1;
        }
        stats.openingLands += player.metrics.openingHandLands;
        stats.cardsDrawn += player.cardsDrawn;
        stats.rampPlayed += player.metrics.rampPlayed;
        stats.removalUsed += player.metrics.removalUsed;
        stats.mulligans += player.metrics.mulligans || 0;
        stats.riskyKeeps += player.metrics.riskyKeeps || 0;
        stats.noLandMulligans += player.metrics.noLandMulligans || 0;
        stats.noSourceMulligans += player.metrics.noSourceMulligans || 0;
        stats.colorScrewMulligans += player.metrics.colorScrewMulligans || 0;
        stats.fixingBasedKeeps += player.metrics.fixingBasedKeeps || 0;
        stats.fastManaKeeps += player.metrics.fastManaKeeps || 0;
        stats.strategyKeeps += player.metrics.strategyKeeps || 0;
        stats.colorScrewTurns += player.metrics.colorScrewTurns || 0;
        stats.colorStrandedCards += player.metrics.colorStrandedCards || 0;
        stats.manaStrandedCards += player.metrics.manaStrandedCards || 0;
        stats.uncastableColorCardsSeen += player.metrics.uncastableColorCardsSeen || 0;
        stats.uncastableManaCardsSeen += player.metrics.uncastableManaCardsSeen || 0;
        stats.commanderColorFailureTurns += player.metrics.commanderColorFailureTurns || 0;
        stats.landsPlayedByTurn3 += player.metrics.landsPlayedByTurn3 || 0;
        stats.untappedEarlySources += player.metrics.untappedEarlySources || 0;
        stats.fetchesUsed += player.metrics.fetchesUsed || 0;
        stats.failedFetches += player.metrics.failedFetches || 0;
        stats.shockDamageTaken += player.metrics.shockDamageTaken || 0;
        stats.colorFixingActions += player.metrics.colorFixingActions || 0;
        stats.colorsFixedByFetches += player.metrics.colorsFixedByFetches || 0;
        stats.manaPaymentsAttempted += player.metrics.manaPaymentsAttempted || 0;
        stats.manaPaymentsSucceeded += player.metrics.manaPaymentsSucceeded || 0;
        stats.manaPaymentsFailed += player.metrics.manaPaymentsFailed || 0;
        stats.cardsStrandedByTappedSources += player.metrics.cardsStrandedByTappedSources || 0;
        stats.manaSourcesTapped += player.metrics.manaSourcesTapped || 0;
        stats.treasuresCreated += player.metrics.treasuresCreated || 0;
        stats.treasuresUsed += player.metrics.treasuresUsed || 0;
        stats.treasureFixingEvents += player.metrics.treasureFixingEvents || 0;
        stats.treasureTempoEvents += player.metrics.treasureTempoEvents || 0;
        stats.oneShotSourcesUsed += player.metrics.oneShotSourcesUsed || 0;
        stats.dorkManaActivations += player.metrics.dorkManaActivations || 0;
        stats.dorkUnavailableDueToSummoningSickness += player.metrics.dorkUnavailableDueToSummoningSickness || 0;
        stats.doubleSpendPreventionEvents += player.metrics.doubleSpendPreventionEvents || 0;
        for (const [reason, count] of Object.entries(player.metrics.paymentFailureReasons || {})) {
          stats.paymentFailureReasons.set(reason, (stats.paymentFailureReasons.get(reason) || 0) + count);
        }
        stats.activatedAbilitiesUsed += player.metrics.activatedAbilitiesUsed || 0;
        stats.manaAbilitiesActivated += player.metrics.manaAbilitiesActivated || 0;
        stats.untapAbilitiesActivated += player.metrics.untapAbilitiesActivated || 0;
        stats.channelAbilitiesUsed += player.metrics.channelAbilitiesUsed || 0;
        stats.fetchActivations += player.metrics.fetchActivations || 0;
        stats.failedFetchActivations += player.metrics.failedFetchActivations || 0;
        stats.lifePaidToFetches += player.metrics.lifePaidToFetches || 0;
        stats.lifePaidToAncientTomb += player.metrics.lifePaidToAncientTomb || 0;
        stats.manaVaultDamage += player.metrics.manaVaultDamage || 0;
        stats.manaCryptDamage += player.metrics.manaCryptDamage || 0;
        stats.imprintCostsPaid += player.metrics.imprintCostsPaid || 0;
        stats.discardCostsPaid += player.metrics.discardCostsPaid || 0;
        stats.badActivationsAvoided += player.metrics.badActivationsAvoided || 0;
        stats.ledActivations += player.metrics.ledActivations || 0;
        stats.badLedActivationsAvoided += player.metrics.badLedActivationsAvoided || 0;
        stats.treasureTriggers += player.metrics.treasureTriggers || 0;
        for (const [source, count] of Object.entries(player.metrics.treasuresBySource || {})) {
          stats.treasuresBySource.set(source, (stats.treasuresBySource.get(source) || 0) + count);
        }
        for (const [color, count] of Object.entries(player.metrics.missingColors || {})) {
          stats.missingColors.set(color, (stats.missingColors.get(color) || 0) + count);
        }
        stats.comboAttempts += player.metrics.comboAttempts || 0;
        stats.comboWins += player.metrics.comboWins || 0;
        stats.failedComboAttempts += player.metrics.failedComboAttempts || 0;
        stats.stoppedComboAttempts += player.metrics.stoppedComboAttempts || 0;
        stats.comboAttemptTurns.push(...(player.metrics.comboAttemptTurns || []));
        stats.interactionUsed += player.metrics.interactionUsed || 0;
        stats.counterspellsUsed += player.metrics.counterspellsUsed || 0;
        stats.protectionUsed += player.metrics.protectionUsed || 0;
        stats.comboAttemptsStopped += player.metrics.comboAttemptsStopped || 0;
        stats.lethalAttacksStopped += player.metrics.lethalAttacksStopped || 0;
        stats.highImpactSpellsStopped += player.metrics.highImpactSpellsStopped || 0;
        stats.heldInteractionTurns += player.metrics.heldInteractionTurns || 0;
        stats.boardWipesCast += player.metrics.boardWipesCast || 0;
        stats.tutorsUsed += player.metrics.tutorsUsed || 0;
        stats.tutorEfficiencyTotal += player.metrics.tutorEfficiencyTotal || 0;
        stats.highValueTutorTargets += player.metrics.highValueTutorTargets || 0;
        stats.counterPriorityTotal += player.metrics.counterPriorityTotal || 0;
        stats.counterPriorityCount += player.metrics.counterPriorityCount || 0;
        stats.highPriorityCounters += player.metrics.highPriorityCounters || 0;
        stats.wastedCounters += player.metrics.wastedCounters || 0;
        stats.successfulProtection += player.metrics.successfulProtection || 0;
        stats.wastedProtection += player.metrics.wastedProtection || 0;
        stats.removalQualityTotal += player.metrics.removalQualityTotal || 0;
        stats.removalQualityCount += player.metrics.removalQualityCount || 0;
        stats.boardWipeQualityTotal += player.metrics.boardWipeQualityTotal || 0;
        stats.boardWipeQualityCount += player.metrics.boardWipeQualityCount || 0;
        stats.commanderSequencingGood += player.metrics.commanderSequencingGood || 0;
        stats.commanderSequencingDelayed += player.metrics.commanderSequencingDelayed || 0;
        stats.cardSequencingScoreTotal += player.metrics.cardSequencingScoreTotal || 0;
        stats.cardSequencingScoreCount += player.metrics.cardSequencingScoreCount || 0;
        stats.behaviorOverridesUsed += player.metrics.behaviorOverridesUsed || 0;
        stats.cardsHeldForBetterTiming += player.metrics.cardsHeldForBetterTiming || 0;
        for (const [event, count] of Object.entries(player.metrics.behaviorEvents || {})) {
          stats.behaviorEvents.set(event, (stats.behaviorEvents.get(event) || 0) + count);
        }
        for (const [target, count] of Object.entries(player.metrics.tutorTargets || {})) {
          stats.tutorTargets.set(target, (stats.tutorTargets.get(target) || 0) + count);
        }
        if (player.metrics.commanderCastTurn !== null) stats.commanderCastTurns.push(player.metrics.commanderCastTurn);
        if (player.metrics.manaScrewTurns > 0) stats.manaScrewGames += 1;
        if (player.metrics.manaFloodTurns > 0) stats.manaFloodGames += 1;
        stats.damageDealt += player.damageDealt;
        stats.boardScore += player.boardScore;
      }
    }

    const report = {
      gamesSimulated: games.length,
      averageGameLength: average(games.map((game) => game.turns)),
      decks: Array.from(deckStats.entries()).map(([name, stats]) => this.formatDeckStats(name, stats))
    };
    this.attachPowerAnalysis(report);
    return report;
  }

  formatDeckStats(name, stats) {
    const mostCommonLossReason = Array.from(stats.lossReasons.entries()).sort((a, b) => b[1] - a[1])[0];
    const winRate = stats.games ? stats.wins / stats.games : 0;
    const consistency = 100 - (stats.manaScrewGames / stats.games) * 45 - (stats.manaFloodGames / stats.games) * 25;
    return {
      name,
      games: stats.games,
      wins: stats.wins,
      winRate: percent(winRate),
      averageWinTurn: average(stats.winTurns),
      manaScrewRate: percent(stats.manaScrewGames / stats.games),
      manaFloodRate: percent(stats.manaFloodGames / stats.games),
      averageOpeningHandLandCount: averageValue(stats.openingLands, stats.games),
      averageCardsDrawn: averageValue(stats.cardsDrawn, stats.games),
      averageRampPlayed: averageValue(stats.rampPlayed, stats.games),
      averageRemovalUsed: averageValue(stats.removalUsed, stats.games),
      removalUsed: stats.removalUsed,
      averageCommanderCastTurn: average(stats.commanderCastTurns),
      mostCommonLossReason: mostCommonLossReason ? mostCommonLossReason[0] : 'none',
      deckConsistencyScore: Math.max(0, Math.round(consistency)),
      aggressionScore: Math.round(Math.min(100, averageValue(stats.damageDealt, stats.games) * 2)),
      resilienceScore: Math.round(Math.min(100, 50 + averageValue(stats.boardScore, stats.games) * 3)),
      interactionScore: Math.round(Math.min(100, averageValue(stats.removalUsed, stats.games) * 25)),
      averageMulligans: averageValue(stats.mulligans, stats.games),
      riskyKeeps: stats.riskyKeeps,
      noLandMulligans: stats.noLandMulligans,
      noSourceMulligans: stats.noSourceMulligans,
      colorScrewMulligans: stats.colorScrewMulligans,
      fixingBasedKeeps: stats.fixingBasedKeeps,
      fastManaKeeps: stats.fastManaKeeps,
      strategyKeeps: stats.strategyKeeps,
      averageLandsPlayedByTurn3: averageValue(stats.landsPlayedByTurn3, stats.games),
      averageColorScrewTurns: averageValue(stats.colorScrewTurns, stats.games),
      averageCardsStrandedByColor: averageValue(stats.uncastableColorCardsSeen || stats.colorStrandedCards, stats.games),
      averageCardsStrandedByMana: averageValue(stats.uncastableManaCardsSeen || stats.manaStrandedCards, stats.games),
      averageCommanderCastDelayFromColor: averageValue(stats.commanderColorFailureTurns, stats.games),
      fetchesUsed: stats.fetchesUsed,
      failedFetches: stats.failedFetches,
      shockDamageTaken: stats.shockDamageTaken,
      untappedEarlySourceRate: percent(stats.landsPlayedByTurn3 ? stats.untappedEarlySources / stats.landsPlayedByTurn3 : 0),
      colorFixingActions: stats.colorFixingActions,
      colorsFixedByFetches: stats.colorsFixedByFetches,
      mostCommonMissingColor: mostCommonMapValue(stats.missingColors),
      manaQualityDuringGames: manaQuality(stats),
      manaPaymentsAttempted: stats.manaPaymentsAttempted,
      manaPaymentsSucceeded: stats.manaPaymentsSucceeded,
      manaPaymentsFailed: stats.manaPaymentsFailed,
      cardsStrandedByTappedSources: stats.cardsStrandedByTappedSources,
      manaSourcesTapped: stats.manaSourcesTapped,
      treasuresCreated: stats.treasuresCreated,
      treasuresUsed: stats.treasuresUsed,
      treasuresRemaining: Math.max(0, stats.treasuresCreated - stats.treasuresUsed),
      treasureFixingEvents: stats.treasureFixingEvents,
      treasureTempoEvents: stats.treasureTempoEvents,
      oneShotSourcesUsed: stats.oneShotSourcesUsed,
      dorkManaActivations: stats.dorkManaActivations,
      dorkUnavailableDueToSummoningSickness: stats.dorkUnavailableDueToSummoningSickness,
      doubleSpendPreventionEvents: stats.doubleSpendPreventionEvents,
      mostCommonPaymentFailure: mostCommonMapValue(stats.paymentFailureReasons),
      activatedAbilitiesUsed: stats.activatedAbilitiesUsed,
      manaAbilitiesActivated: stats.manaAbilitiesActivated,
      untapAbilitiesActivated: stats.untapAbilitiesActivated,
      channelAbilitiesUsed: stats.channelAbilitiesUsed,
      fetchActivations: stats.fetchActivations,
      failedFetchActivations: stats.failedFetchActivations,
      lifePaidToFetches: stats.lifePaidToFetches,
      lifePaidToAncientTomb: stats.lifePaidToAncientTomb,
      manaVaultDamage: stats.manaVaultDamage,
      manaCryptDamage: stats.manaCryptDamage,
      imprintCostsPaid: stats.imprintCostsPaid,
      discardCostsPaid: stats.discardCostsPaid,
      badActivationsAvoided: stats.badActivationsAvoided,
      ledActivations: stats.ledActivations,
      badLedActivationsAvoided: stats.badLedActivationsAvoided,
      treasureTriggers: stats.treasureTriggers,
      treasuresCreatedBySource: Object.fromEntries(stats.treasuresBySource.entries()),
      comboAttempts: stats.comboAttempts,
      comboWinRate: percent(stats.comboAttempts ? stats.comboWins / stats.comboAttempts : 0),
      averageComboAttemptTurn: average(stats.comboAttemptTurns),
      failedComboAttempts: stats.failedComboAttempts,
      stoppedComboAttempts: stats.stoppedComboAttempts,
      interactionUsed: stats.interactionUsed,
      averageInteractionUsed: averageValue(stats.interactionUsed, stats.games),
      counterspellsUsed: stats.counterspellsUsed,
      protectionUsed: stats.protectionUsed,
      comboAttemptsStopped: stats.comboAttemptsStopped,
      lethalAttacksStopped: stats.lethalAttacksStopped,
      highImpactSpellsStopped: stats.highImpactSpellsStopped,
      heldInteractionTurns: stats.heldInteractionTurns,
      heldInteractionRate: percent(stats.heldInteractionTurns / Math.max(1, stats.games * 14)),
      boardWipesUsed: stats.boardWipesCast,
      tutorsUsed: stats.tutorsUsed,
      tutorEfficiencyScore: averageValue(stats.tutorEfficiencyTotal, stats.tutorsUsed),
      highValueTutorTargets: stats.highValueTutorTargets,
      averageCounterPriorityScore: averageValue(stats.counterPriorityTotal, stats.counterPriorityCount),
      highPriorityCounters: stats.highPriorityCounters,
      wastedCounters: stats.wastedCounters,
      successfulProtection: stats.successfulProtection,
      wastedProtection: stats.wastedProtection,
      removalTargetQuality: averageValue(stats.removalQualityTotal, stats.removalQualityCount),
      boardWipeQuality: averageValue(stats.boardWipeQualityTotal, stats.boardWipeQualityCount),
      commanderSequencingGood: stats.commanderSequencingGood,
      commanderSequencingDelayed: stats.commanderSequencingDelayed,
      cardSpecificSequencingScore: averageValue(stats.cardSequencingScoreTotal, stats.cardSequencingScoreCount),
      behaviorOverridesUsed: stats.behaviorOverridesUsed,
      cardsHeldForBetterTiming: stats.cardsHeldForBetterTiming,
      mostImpactfulBehaviorPlays: topMapValues(stats.behaviorEvents, 4),
      commanderDamageKills: stats.commanderDamageKills,
      winTypeBreakdown: Object.fromEntries(stats.winTypes.entries()),
      mostCommonTutorTarget: mostCommonMapValue(stats.tutorTargets)
    };
  }

  toText(report) {
    const lines = [];
    lines.push(`Games simulated: ${report.gamesSimulated}`);
    lines.push(`Average game length: ${report.averageGameLength} turns`);
    lines.push('');
    for (const deck of report.decks) {
      lines.push(`${deck.name}`);
      lines.push(`  Win rate: ${deck.winRate} (${deck.wins}/${deck.games})`);
      lines.push(`  Average win turn: ${deck.averageWinTurn}`);
      lines.push(`  Mana shortfall / excess land hands: ${deck.manaScrewRate} / ${deck.manaFloodRate}`);
      lines.push(`  Avg opening lands: ${deck.averageOpeningHandLandCount}`);
      lines.push(`  Avg cards drawn: ${deck.averageCardsDrawn}`);
      lines.push(`  Avg ramp/removal: ${deck.averageRampPlayed} / ${deck.averageRemovalUsed}`);
      lines.push(`  Avg commander cast turn: ${deck.averageCommanderCastTurn}`);
      lines.push(`  Avg mulligans: ${deck.averageMulligans} (${deck.strategyKeeps} strategy-based keeps, ${deck.riskyKeeps} risky keeps)`);
      lines.push('  Mana Simulation Report:');
      lines.push(`    Avg lands played by turn 3: ${deck.averageLandsPlayedByTurn3}`);
      lines.push(`    Avg color screw turns: ${deck.averageColorScrewTurns}`);
      lines.push(`    Avg cards stranded by color / mana: ${deck.averageCardsStrandedByColor} / ${deck.averageCardsStrandedByMana}`);
      lines.push(`    Avg commander color delay: ${deck.averageCommanderCastDelayFromColor}`);
      lines.push(`    Fetches used / failed: ${deck.fetchesUsed} / ${deck.failedFetches}`);
      lines.push(`    Shock damage taken: ${deck.shockDamageTaken}`);
      lines.push(`    Untapped early source rate: ${deck.untappedEarlySourceRate}`);
      lines.push(`    Color fixing actions: ${deck.colorFixingActions}`);
      lines.push(`    Most common missing color: ${deck.mostCommonMissingColor}`);
      lines.push(`    Mana quality during games: ${deck.manaQualityDuringGames}`);
      lines.push('  Source-Level Mana Report:');
      lines.push(`    Mana payments attempted/succeeded/failed: ${deck.manaPaymentsAttempted} / ${deck.manaPaymentsSucceeded} / ${deck.manaPaymentsFailed}`);
      lines.push(`    Cards stranded by tapped sources: ${deck.cardsStrandedByTappedSources}`);
      lines.push(`    Mana sources tapped: ${deck.manaSourcesTapped}`);
      lines.push(`    Treasures created/used/remaining: ${deck.treasuresCreated} / ${deck.treasuresUsed} / ${deck.treasuresRemaining}`);
      lines.push(`    Treasure fixing / tempo events: ${deck.treasureFixingEvents} / ${deck.treasureTempoEvents}`);
      lines.push(`    One-shot sources used: ${deck.oneShotSourcesUsed}`);
      lines.push(`    Dork activations: ${deck.dorkManaActivations}`);
      lines.push(`    Dorks unavailable from summoning sickness: ${deck.dorkUnavailableDueToSummoningSickness}`);
      lines.push(`    Double-spend prevention events: ${deck.doubleSpendPreventionEvents}`);
      lines.push(`    Most common payment failure: ${deck.mostCommonPaymentFailure}`);
      lines.push('  Activated Ability Report:');
      lines.push(`    Activated abilities used: ${deck.activatedAbilitiesUsed}`);
      lines.push(`    Mana abilities activated: ${deck.manaAbilitiesActivated}`);
      lines.push(`    Untap abilities activated: ${deck.untapAbilitiesActivated}`);
      lines.push(`    Channel abilities used: ${deck.channelAbilitiesUsed}`);
      lines.push(`    Fetch lands activated / failed: ${deck.fetchActivations} / ${deck.failedFetchActivations}`);
      lines.push(`    Life paid to fetches / shocks / Ancient Tomb: ${deck.lifePaidToFetches} / ${deck.shockDamageTaken} / ${deck.lifePaidToAncientTomb}`);
      lines.push(`    Mana Vault / Mana Crypt damage: ${deck.manaVaultDamage} / ${deck.manaCryptDamage}`);
      lines.push(`    One-shot sources used: ${deck.oneShotSourcesUsed}`);
      lines.push(`    Imprint / discard costs paid: ${deck.imprintCostsPaid} / ${deck.discardCostsPaid}`);
      lines.push(`    LED activations / bad LED activations avoided: ${deck.ledActivations} / ${deck.badLedActivationsAvoided}`);
      lines.push(`    Bad activations avoided: ${deck.badActivationsAvoided}`);
      lines.push(`    Treasure triggers: ${deck.treasureTriggers}`);
      if (Object.keys(deck.treasuresCreatedBySource || {}).length) {
        lines.push(`    Treasures by source: ${formatBreakdown(deck.treasuresCreatedBySource)}`);
      }
      lines.push('  Interaction Report:');
      lines.push(`    Interaction used: ${deck.interactionUsed} total`);
      lines.push(`    Counterspells used: ${deck.counterspellsUsed}`);
      lines.push(`    Removal used: ${deck.removalUsed || deck.averageRemovalUsed}`);
      lines.push(`    Protection used: ${deck.protectionUsed}`);
      lines.push(`    Board wipes used: ${deck.boardWipesUsed}`);
      lines.push(`    Combo attempts stopped: ${deck.comboAttemptsStopped}`);
      lines.push(`    Lethal attacks stopped: ${deck.lethalAttacksStopped}`);
      lines.push(`    High-impact spells stopped: ${deck.highImpactSpellsStopped}`);
      lines.push('  Sequencing Report:');
      lines.push(`    Tutors cast: ${deck.tutorsUsed}`);
      lines.push(`    Best tutor target: ${deck.mostCommonTutorTarget}`);
      lines.push(`    Tutor efficiency: ${deck.tutorEfficiencyScore}/100 (${deck.highValueTutorTargets} high-value targets)`);
      lines.push(`    Average counter priority: ${deck.averageCounterPriorityScore}`);
      lines.push(`    High-priority / wasted counters: ${deck.highPriorityCounters} / ${deck.wastedCounters}`);
      lines.push(`    Successful / wasted protection: ${deck.successfulProtection} / ${deck.wastedProtection}`);
      lines.push(`    Removal target quality: ${deck.removalTargetQuality}/100`);
      lines.push(`    Board wipe quality: ${deck.boardWipeQuality}/100`);
      lines.push(`    Commander sequencing: ${commanderSequencing(deck)}`);
      lines.push(`    Card-specific sequencing score: ${deck.cardSpecificSequencingScore}/100`);
      lines.push('  Card Behavior Report:');
      lines.push(`    Behavior overrides used: ${deck.behaviorOverridesUsed}`);
      lines.push(`    Cards held for better timing: ${deck.cardsHeldForBetterTiming}`);
      if (deck.behaviorCoverage) {
        lines.push(`    Specific cards with behavior: ${deck.behaviorCoverage.specific}/${deck.behaviorCoverage.totalCards}`);
        lines.push(`    Coverage: ${deck.behaviorCoverage.coveragePercent}`);
      }
      if (deck.mostImpactfulBehaviorPlays.length) {
        lines.push('    Most impactful behavior plays:');
        for (const play of deck.mostImpactfulBehaviorPlays) lines.push(`      - ${play}`);
      }
      if (deck.comboAttempts > 0) {
        lines.push(`  Combo attempts: ${deck.comboAttempts}, combo win rate: ${deck.comboWinRate}, avg attempt turn: ${deck.averageComboAttemptTurn}`);
        lines.push(`  Failed/stopped combo attempts: ${deck.failedComboAttempts} / ${deck.stoppedComboAttempts}`);
      }
      if (Object.keys(deck.winTypeBreakdown).length) {
        lines.push(`  Win types: ${formatBreakdown(deck.winTypeBreakdown)}`);
      }
      if (deck.power) {
        lines.push(`  Power: Bracket ${deck.power.estimatedBracket} (${deck.power.bracketLabel}), ${deck.power.archetype.primaryArchetype}, combo density ${deck.power.comboDensityScore}`);
      }
      if (deck.strategyProfile) {
        lines.push('  Strategy Behavior Report:');
        lines.push(`    Archetype: ${deck.strategyProfile.primaryArchetype}`);
        lines.push(`    Expected behavior: ${deck.strategyProfile.expectedBehavior}`);
        lines.push(`    Observed behavior: held interaction ${deck.heldInteractionRate}, used ${deck.counterspellsUsed} counterspells, ${deck.averageRemovalUsed} removal/game.`);
        lines.push(`    Behavior match: ${behaviorMatch(deck)}`);
      }
      if (deck.mostCommonTutorTarget !== 'none') lines.push(`  Most common tutor target: ${deck.mostCommonTutorTarget}`);
      lines.push(`  Common loss reason: ${deck.mostCommonLossReason}`);
      lines.push(`  Scores: consistency ${deck.deckConsistencyScore}, aggression ${deck.aggressionScore}, resilience ${deck.resilienceScore}, interaction ${deck.interactionScore}`);
      lines.push('');
    }
    if (report.podWarnings && report.podWarnings.length) {
      lines.push('Pod Balance:');
      for (const warning of report.podWarnings) lines.push(`  - ${warning}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  attachPowerAnalysis(report) {
    if (!this.cardDatabase || !this.decks.length) return;
    const analyzer = new BracketAnalyzer(this.cardDatabase);
    const byName = new Map(this.decks.map((deck) => [deck.name, analyzer.analyze(deck)]));
    for (const deck of report.decks) {
      const power = byName.get(deck.name);
      if (!power) continue;
      deck.power = {
        estimatedBracket: power.estimatedBracket,
        bracketLabel: power.bracketLabel,
        confidence: power.confidence,
        comboDensityScore: power.comboReport.comboDensityScore,
        archetype: power.archetype,
        warnings: power.warnings
      };
      deck.behaviorCoverage = behaviorCoverage(this.cardDatabase, this.decks.find((candidate) => candidate.name === deck.name));
      deck.strategyProfile = strategySummary(power);
    }
    report.podWarnings = podWarnings(report.decks);
  }
}

function podWarnings(decks) {
  const withPower = decks.filter((deck) => deck.power);
  if (withPower.length < 2) return [];
  const brackets = withPower.map((deck) => deck.power.estimatedBracket);
  const max = Math.max(...brackets);
  const min = Math.min(...brackets);
  if (max - min < 2) return [];
  const strongest = withPower.filter((deck) => deck.power.estimatedBracket === max).map((deck) => deck.name).join(', ');
  const winner = withPower.slice().sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))[0];
  const confirmed = winner && withPower.some((deck) => deck.power.estimatedBracket === max && deck.name === winner.name);
  return [
    `${strongest} appears to be Bracket ${max} while another deck is Bracket ${min}. Expected mismatch: High.`,
    confirmed ? `Simulation confirmed the bracket favorite: ${winner.name} won most often.` : `Simulation did not cleanly match bracket expectations; variance or matchup texture may be affecting results.`,
    `Recommendation: pair Bracket ${max} decks against stronger pods or reduce fast tutors/combo density for casual tables.`
  ];
}

function strategySummary(power) {
  const archetype = power.archetype.primaryArchetype;
  return {
    primaryArchetype: archetype,
    estimatedBracket: power.estimatedBracket,
    expectedBehavior: expectedBehavior(archetype),
    winPlan: (power.comboReport.exactCombos || []).length
      ? ['tutor/assemble combo pieces', 'protect win attempt']
      : archetype === 'aggro'
        ? ['develop board', 'win through combat']
        : ['develop mana', 'win through board advantage']
  };
}

function expectedBehavior(archetype) {
  return {
    combo: 'Tutor combo pieces, protect win attempt, hold free interaction.',
    control: 'Hold interaction, answer high-risk plays, win late.',
    aggro: 'Develop pressure, clear blockers, attack vulnerable players.',
    ramp: 'Ramp early, cast haymakers, use interaction only when needed.',
    voltron: 'Cast and protect commander, pressure commander damage.',
    stax: 'Deploy lock pieces and stop answers to them.',
    aristocrats: 'Assemble sacrifice outlet, fodder, and payoff.',
    tokens: 'Build board, protect payoffs, attack wide.',
    reanimator: 'Fill graveyard, reanimate threats, protect recursion.'
  }[archetype] || 'Develop value, answer the best threat, win through resilient pressure.';
}

function behaviorMatch(deck) {
  const archetype = deck.strategyProfile && deck.strategyProfile.primaryArchetype;
  if (archetype === 'combo') return deck.comboAttempts > 0 ? 'Good' : 'Needs tuning';
  if (archetype === 'control') return deck.interactionUsed > 0 || deck.heldInteractionTurns > 0 ? 'Good' : 'Needs tuning';
  if (archetype === 'aggro') return deck.aggressionScore >= 15 ? 'Good' : 'Needs tuning';
  if (archetype === 'ramp') return deck.averageRampPlayed >= 1 ? 'Good' : 'Needs tuning';
  return 'Developing';
}

function manaQuality(stats) {
  const colorTurns = averageValue(stats.colorScrewTurns, stats.games);
  const stranded = averageValue(stats.uncastableColorCardsSeen || stats.colorStrandedCards, stats.games);
  const earlyUntapped = stats.landsPlayedByTurn3 ? stats.untappedEarlySources / stats.landsPlayedByTurn3 : 0;
  if (colorTurns <= 0.5 && stranded <= 1 && earlyUntapped >= 0.7) return 'Good';
  if (colorTurns <= 1.5 && stranded <= 3) return 'Medium';
  return 'Poor';
}

function commanderSequencing(deck) {
  if (!deck.commanderSequencingGood && !deck.commanderSequencingDelayed) return 'Not observed';
  if (deck.commanderSequencingGood >= deck.commanderSequencingDelayed) return 'Good';
  return 'Conservative';
}

function inferWinType(metrics, game) {
  if ((metrics.comboWins || 0) > 0) return 'combo';
  if (game.endedBy === 'max_turns') return 'attrition';
  if ((metrics.combatDamageDealt || 0) > 0) return 'combat';
  return 'attrition';
}

function mostCommonMapValue(map) {
  const item = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0];
  return item ? item[0] : 'none';
}

function topMapValues(map, limit) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => `${name}${count > 1 ? ` (${count})` : ''}`);
}

function behaviorCoverage(cardDatabase, deck) {
  if (!deck) return null;
  const { createDefaultBehaviorRegistry } = require('../cards/CardBehavior');
  const { CardTagger } = require('../cards/CardTagger');
  const engine = createDefaultBehaviorRegistry();
  const tagger = new CardTagger();
  const cards = [];
  for (const entry of deck.cards || []) {
    const card = cardDatabase.get(entry.name) || { name: entry.name, tags: [] };
    const tags = Array.from(new Set((card.tags || []).concat(tagger.tagsFor(card))));
    for (let index = 0; index < entry.quantity; index += 1) cards.push({ ...card, tags });
  }
  const coverage = engine.coverageForCards(cards);
  return {
    ...coverage,
    coveragePercent: percent(coverage.totalCards ? coverage.specific / coverage.totalCards : 0)
  };
}

function formatBreakdown(value) {
  return Object.entries(value).map(([name, count]) => `${name} ${count}`).join(', ');
}

function average(values) {
  if (!values.length) return 'n/a';
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function averageValue(total, count) {
  if (!count) return 0;
  return Number((total / count).toFixed(2));
}

function percent(value) {
  if (!Number.isFinite(value)) return '0.0%';
  return `${(value * 100).toFixed(1)}%`;
}

module.exports = { ReportGenerator };
