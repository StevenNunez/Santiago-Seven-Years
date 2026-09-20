import sharp from 'sharp';
await Promise.all([
  sharp('public/sonic-hero.png').resize(1100).webp({ quality: 85 }).toFile('public/sonic-hero.webp'),
  sharp('public/sonic-hero.png').resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 85 }).toFile('public/share.jpg'),
  ...[192, 512].map(size => sharp('public/icon.svg').resize(size).png().toFile(`public/icon-${size}.png`)),
  sharp('public/icon.svg').resize(180).png().toFile('public/apple-touch-icon.png'),
  sharp('public/icon.svg').resize(400).extend({ top:56,bottom:56,left:56,right:56,background:'#0849db' }).png().toFile('public/icon-maskable.png'),
]);
