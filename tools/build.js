// Bundles index.html + js/*.js into single files:
//   dist/Lanternfall.html            - artifact page (no doctype/html/head/body, per the publish contract)
//   Lanternfall-standalone.html      - double-click-to-play copy with a full document skeleton
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let js = '';
for (const s of scripts) {
  if (s.endsWith('bot.js') && process.argv.includes('--no-bot')) continue;
  js += `\n// ---- ${s} ----\n` + fs.readFileSync(path.join(root, s), 'utf8').replace(/<\/script/gi, '<\\/script');
}
const head = `<title>Lanternfall</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&display=swap">
<style>
  /* Layout: one full-bleed canvas; every colour inside the game is drawn by the game itself. Single dark look by design. */
  :root { --bg: #000000; --fg: #f3e9d6; --accent: #ffb347; --font-display: 'Cinzel', 'Palatino Linotype', Georgia, serif; --font-body: 'Trebuchet MS', 'Segoe UI', sans-serif; color-scheme: dark; }
  html, body { height: 100%; }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--font-body); overflow: hidden; }
  #game { display: block; width: 100%; height: 100%; background: var(--bg); outline: none; touch-action: none; }
  .fontload { position: absolute; left: -999px; top: -999px; font-family: var(--font-display); font-weight: 700; }
</style>`;
const body = `<span class="fontload" aria-hidden="true">Lanternfall</span>
<canvas id="game" tabindex="0" aria-label="Lanternfall, an action roguelite played with keyboard and mouse"></canvas>
<script>
${js}
</script>`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'Lanternfall.html'), head + '\n' + body + '\n');
fs.writeFileSync(path.join(root, 'Lanternfall-standalone.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
console.log('built', scripts.length, 'scripts,', Math.round((head.length + body.length) / 1024), 'KB');
