# token-launch-radar-20261126

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/feymarl2/token-launch-radar-20261126/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/feymarl2/token-launch-radar-20261126/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar ranking 174 tokenless DefiLlama protocols by transparent implied FDV, with farm plans and a filterable dashboard.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

The program reads the sealed snapshot, writes `board.json`, dashboard data and `dossier.json`, and copies the static dashboard and screenshots into the output directory. Implied FDV is TVL multiplied by a category multiple, clamped seven-day momentum, tokenless-age, chain-breadth and confidence factors. Token-trading protocols are counted separately and kept off the launch board.

---

<sub>Entered on [make.fun](https://make.fun/?ref=39ve3eqn&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
