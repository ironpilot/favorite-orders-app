// Builds the source images for `@capacitor/assets` (client/assets/*.png) from
// src/assets/logo.svg and src/assets/checkerboard.svg.
// Run with `npm run assets` to regenerate every native icon and splash screen.
import { readFile, mkdir } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const root = new URL('..', import.meta.url);
const logoSvg = await readFile(new URL('src/assets/logo.svg', root), 'utf8');
const boardSvg = await readFile(new URL('src/assets/checkerboard.svg', root), 'utf8');
// Dark variant of the diner floor for dark-mode splash screens.
const boardDarkSvg = boardSvg.replace('#ffffff', '#1c1d21').replaceAll('#e9eaec', '#2a2c31');

const render = (svg, width) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } }).render().asPng();

async function compose(size, background, logoRatio) {
  const base = background
    ? sharp(render(background, size)).resize(size, size, { fit: 'cover' })
    : sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  const logoSize = Math.round(size * logoRatio);
  return base
    .composite([{ input: render(logoSvg, logoSize), gravity: 'center' }])
    .png()
    .toBuffer();
}

const out = new URL('assets/', root);
await mkdir(out, { recursive: true });
const write = (name, buf) => sharp(buf).png().toFile(new URL(name, out).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

await write('icon-only.png', await compose(1024, boardSvg, 0.86));
// Android adaptive icon: logo kept inside the 66% safe zone.
await write('icon-foreground.png', await compose(1024, null, 0.62));
await write('icon-background.png', render(boardSvg, 1024));
await write('splash.png', await compose(2732, boardSvg, 0.3));
await write('splash-dark.png', await compose(2732, boardDarkSvg, 0.3));
console.log('Generated client/assets/*.png');
