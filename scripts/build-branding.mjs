import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

// Packaging only: source artwork is generated with the image model.
// Requires ImageMagick (`magick`) on PATH.
for (const directory of ['public/social', 'public/icons']) mkdirSync(directory, {recursive: true});
function convert(...args) {
  const result = spawnSync('magick', args, {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('ImageMagick conversion failed.');
}
const icon = 'assets/branding/ferret-icon-master.png';
convert('assets/branding/og-master.png', '-resize', '1200x630^', '-gravity', 'center', '-extent', '1200x630', '-strip', '-sampling-factor', '4:4:4', '-quality', '88', 'public/social/og-image.jpg');
for (const size of [192, 512]) convert(icon, '-resize', `${size}x${size}`, '-strip', `public/icons/icon-${size}.png`);
for (const size of [16, 32, 48]) convert(icon, '-resize', `${size}x${size}`, '-strip', `public/icons/favicon-${size}.png`);
convert(icon, '-resize', '180x180', '-strip', 'public/apple-touch-icon.png');
convert(icon, '-resize', '440x440', '-background', '#13392b', '-gravity', 'center', '-extent', '512x512', '-strip', 'public/icons/maskable-512.png');
convert('public/icons/favicon-16.png', 'public/icons/favicon-32.png', 'public/icons/favicon-48.png', 'public/favicon.ico');
