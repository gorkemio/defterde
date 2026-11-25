// Slow experiment, deliberately separate from node --test.
const fs = require('node:fs');
const os = require('node:os');
const B = require('../board.js');
const A = require('../ai.js');
(async () => {
  const report = { date: new Date().toISOString(), cpu: os.cpus()[0].model,
    os: `${os.platform()} ${os.release()} ${os.arch()}`, runtime: process.version,
    budgets: { medium: 200, hard: 800 }, games: [], samples: [] };
  for (const seed of [41, 2026]) for (const pair of [['easy', 'medium'], ['easy', 'hard'], ['medium', 'hard']]) {
    for (const firstPlayer of [0, 1]) {
      let state = B.createInitialState(firstPlayer), moves = 0;
      const random = [A.seeded(seed), A.seeded(seed + 1)];
      const elapsed = [0, 0], nodes = [0, 0], depths = [[], []];
      while (state.status === 'playing' && moves < 1500) {
        const player = state.player;
        const result = await A.search(state, { difficulty: pair[player], random: random[player] });
        if (!B.legalMoves(state).includes(result.move)) throw new Error('Illegal AI move');
        elapsed[player] += result.elapsed; nodes[player] += result.nodes; depths[player].push(result.depth);
        if (report.samples.filter(s => s.difficulty === pair[player]).length < 4) report.samples.push({ difficulty: pair[player], seed, firstPlayer, move: moves, ...result });
        state = B.applyMove(state, result.move, { events: false }).state; moves++;
      }
      if (state.status !== 'finished') throw new Error('Unfinished experiment game');
      const game = { seed, pair, firstPlayer, moves, result: state.result, elapsed, nodes, depths };
      report.games.push(game);
      fs.writeFileSync('docs/ai-benchmark.json', JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({ seed, pair, firstPlayer, moves, scores: state.result.scores }));
    }
  }
})();
