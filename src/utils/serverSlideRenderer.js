import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.toString().replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function wordWrap(text, maxCharsPerLine = 22) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxCharsPerLine) {
      current = (current + ' ' + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Convert remote image to base64 data URI
async function fetchImageAsBase64(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (e) {
    return null;
  }
}

/**
 * Generate Slide 1 (Hero & Hook)
 */
export async function renderSlide1Svg(recipe, theme = { accent: '#f59e0b', bgDark: '#121216' }, aspectRatio = '9:16') {
  const isSquare = aspectRatio === '1:1';
  const svgHeight = isSquare ? 1080 : 1920;
  const base64Image = await fetchImageAsBase64(recipe.heroImage);
  const titleLines = wordWrap(recipe.title.toUpperCase(), isSquare ? 20 : 16);
  const hookLines = wordWrap(recipe.shortHook || 'Rich, satisfying, and effortless. Restaurant-quality flavors made right at home.', isSquare ? 42 : 32);

  const titleSvgLines = titleLines.slice(0, 2).map((line, i) => 
    `<tspan x="60" dy="${i === 0 ? 0 : isSquare ? 60 : 80}">${escapeXml(line)}</tspan>`
  ).join('');

  const hookSvgLines = hookLines.slice(0, 2).map((line, i) => 
    `<tspan x="60" dy="${i === 0 ? 0 : isSquare ? 36 : 42}">${escapeXml(line)}</tspan>`
  ).join('');

  const brandTag = escapeXml((recipe.brandName || 'SNAPRECIPES').toUpperCase());
  const rightBadge = escapeXml(`${recipe.cookTime || recipe.prepTime} · ${recipe.servings} SERVINGS`.toUpperCase());

  const contentTranslateY = isSquare ? 580 : 1160;
  const topBadgeY = isSquare ? 60 : 110;

  const svg = `
<svg width="1080" height="${svgHeight}" viewBox="0 0 1080 ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0602" stop-opacity="0.65"/>
      <stop offset="25%" stop-color="#0a0602" stop-opacity="0.10"/>
      <stop offset="58%" stop-color="#0a0602" stop-opacity="0.75"/>
      <stop offset="85%" stop-color="#0a0602" stop-opacity="0.98"/>
      <stop offset="100%" stop-color="#0a0602" stop-opacity="1.0"/>
    </linearGradient>
    <linearGradient id="statBoxGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e140a" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#0f0a05" stop-opacity="0.96"/>
    </linearGradient>
  </defs>

  <!-- Background Image -->
  ${base64Image ? `<image href="${base64Image}" width="1080" height="${svgHeight}" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="1080" height="${svgHeight}" fill="#1e140a"/>`}

  <!-- Gradient Scrim -->
  <rect width="1080" height="${svgHeight}" fill="url(#heroGrad)"/>

  <!-- Top Left Brand Badge -->
  <g transform="translate(60, ${topBadgeY})">
    <rect width="320" height="54" rx="27" fill="#0e0a06" fill-opacity="0.90" stroke="#f59e0b" stroke-opacity="0.4" stroke-width="2"/>
    <circle cx="28" cy="27" r="6" fill="#f59e0b"/>
    <text x="46" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#fef3c7" letter-spacing="1.5">${brandTag}</text>
  </g>

  <!-- Top Right Badge -->
  <g transform="translate(680, ${topBadgeY})">
    <rect width="340" height="54" rx="27" fill="#0e0a06" fill-opacity="0.90" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>
    <text x="170" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="1.2">${rightBadge}</text>
  </g>

  <!-- Content Block in Safe Area -->
  <g transform="translate(0, ${contentTranslateY})">
    <!-- Recipe Title -->
    <text x="60" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 58 : 72}" font-weight="900" fill="#ffffff" letter-spacing="-1">
      ${titleSvgLines}
    </text>

    <!-- Hook Description -->
    <text x="60" y="${titleLines.slice(0, 2).length * (isSquare ? 60 : 80) + 15}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 25 : 30}" font-weight="600" fill="#fcd34d">
      ${hookSvgLines}
    </text>

    <!-- 4 Macro Stat Cards -->
    <g transform="translate(60, ${titleLines.slice(0, 2).length * (isSquare ? 60 : 80) + hookLines.slice(0, 2).length * (isSquare ? 36 : 42) + 40})">
      <!-- Prep -->
      <g transform="translate(0, 0)">
        <rect width="216" height="${isSquare ? 96 : 110}" rx="18" fill="url(#statBoxGrad)" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="2"/>
        <text x="108" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#d1b9a5" text-anchor="middle" letter-spacing="1">PREP</text>
        <text x="108" y="${isSquare ? 72 : 84}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 28 : 34}" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(recipe.prepTime)}</text>
      </g>
      <!-- Cook -->
      <g transform="translate(248, 0)">
        <rect width="216" height="${isSquare ? 96 : 110}" rx="18" fill="url(#statBoxGrad)" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="2"/>
        <text x="108" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#d1b9a5" text-anchor="middle" letter-spacing="1">COOK</text>
        <text x="108" y="${isSquare ? 72 : 84}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 28 : 34}" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(recipe.cookTime)}</text>
      </g>
      <!-- Serves -->
      <g transform="translate(496, 0)">
        <rect width="216" height="${isSquare ? 96 : 110}" rx="18" fill="url(#statBoxGrad)" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="2"/>
        <text x="108" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#d1b9a5" text-anchor="middle" letter-spacing="1">SERVES</text>
        <text x="108" y="${isSquare ? 72 : 84}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 28 : 34}" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(recipe.servings)}</text>
      </g>
      <!-- Calories / Protein -->
      <g transform="translate(744, 0)">
        <rect width="216" height="${isSquare ? 96 : 110}" rx="18" fill="url(#statBoxGrad)" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="2"/>
        <text x="108" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#d1b9a5" text-anchor="middle" letter-spacing="1">${recipe.proteinCallout ? 'PROTEIN' : 'CALORIES'}</text>
        <text x="108" y="${isSquare ? 72 : 84}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 28 : 34}" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(recipe.proteinCallout ? recipe.proteinCallout.replace(/protein/i, '').trim() : (recipe.calories ? recipe.calories.replace(/cal/i, '').trim() : '350'))}</text>
      </g>
    </g>
  </g>
</svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
  return resvg.render().asPng();
}

/**
 * Generate Slide 2 (Recipe Card)
 */
export async function renderSlide2Svg(recipe, theme = { accent: '#f59e0b', bgDark: '#121216' }, aspectRatio = '9:16') {
  const isSquare = aspectRatio === '1:1';
  const svgHeight = isSquare ? 1080 : 1920;
  const base64Image = await fetchImageAsBase64(recipe.heroImage);
  const ings = recipe.ingredients.slice(0, isSquare ? 6 : 8);
  const steps = recipe.method.slice(0, isSquare ? 4 : 5);

  const ingPillsSvg = ings.map((ing, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col * (isSquare ? 470 : 460);
    const y = row * (isSquare ? 50 : 66);
    const label = `${ing.name}${ing.amount ? ' — ' + ing.amount : ''}`;
    const cleanLabel = label.length > (isSquare ? 24 : 28) ? label.slice(0, isSquare ? 22 : 26) + '...' : label;
    return `
      <g transform="translate(${x}, ${y})">
        <rect width="${isSquare ? 450 : 440}" height="${isSquare ? 44 : 52}" rx="${isSquare ? 10 : 12}" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/>
        <circle cx="18" cy="${isSquare ? 22 : 26}" r="${isSquare ? 3.5 : 4}" fill="#f59e0b"/>
        <text x="32" y="${isSquare ? 28 : 33}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 18 : 20}" font-weight="700" fill="#1f2937">${escapeXml(cleanLabel)}</text>
      </g>
    `;
  }).join('');

  const stepsSvg = steps.map((step, i) => {
    const y = i * (isSquare ? 90 : 118);
    const cleanStep = step.length > (isSquare ? 60 : 70) ? step.slice(0, isSquare ? 58 : 68) + '...' : step;
    const stepLines = wordWrap(cleanStep, isSquare ? 48 : 46);
    return `
      <g transform="translate(0, ${y})">
        <rect width="920" height="${isSquare ? 80 : 102}" rx="${isSquare ? 12 : 16}" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/>
        <rect x="14" y="${isSquare ? 14 : 18}" width="${isSquare ? 32 : 40}" height="${isSquare ? 32 : 40}" rx="${isSquare ? 8 : 10}" fill="#f59e0b"/>
        <text x="${isSquare ? 30 : 36}" y="${isSquare ? 37 : 45}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 18 : 22}" font-weight="900" fill="#ffffff" text-anchor="middle">${i + 1}</text>
        <text x="${isSquare ? 60 : 74}" y="${isSquare ? 34 : 42}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 18 : 21}" font-weight="600" fill="#1f2937">
          ${stepLines.slice(0, 2).map((l, li) => `<tspan x="${isSquare ? 60 : 74}" dy="${li === 0 ? 0 : isSquare ? 24 : 28}">${escapeXml(l)}</tspan>`).join('')}
        </text>
      </g>
    `;
  }).join('');

  const topHeaderY = isSquare ? 50 : 110;
  const mainCardY = isSquare ? 150 : 240;
  const mainCardHeight = isSquare ? 850 : 1520;
  const macroBarY = isSquare ? 1040 : 1820;

  const svg = `
<svg width="1080" height="${svgHeight}" viewBox="0 0 1080 ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="thumbClip">
      <circle cx="${isSquare ? 45 : 60}" cy="${isSquare ? 45 : 60}" r="${isSquare ? 42 : 54}"/>
    </clipPath>
  </defs>

  <!-- Dark Background -->
  <rect width="1080" height="${svgHeight}" fill="#121216"/>

  <!-- Top Header -->
  <g transform="translate(60, ${topHeaderY})">
    <text x="0" y="${isSquare ? 18 : 24}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 18 : 22}" font-weight="900" fill="#f59e0b" letter-spacing="2">RECIPE CARD</text>
    <text x="0" y="${isSquare ? 52 : 68}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 34 : 44}" font-weight="900" fill="#ffffff">${escapeXml(recipe.title.length > 25 ? recipe.title.slice(0, 23) + '...' : recipe.title)}</text>
    
    <!-- Thumbnail Image -->
    ${base64Image ? `
    <g transform="translate(${isSquare ? 870 : 840}, ${isSquare ? -15 : -10})">
      <circle cx="${isSquare ? 45 : 60}" cy="${isSquare ? 45 : 60}" r="${isSquare ? 44 : 58}" fill="none" stroke="#f59e0b" stroke-width="3"/>
      <image href="${base64Image}" width="${isSquare ? 90 : 120}" height="${isSquare ? 90 : 120}" clip-path="url(#thumbClip)" preserveAspectRatio="xMidYMid slice"/>
    </g>` : ''}
  </g>

  <!-- Main Ivory Card -->
  <g transform="translate(50, ${mainCardY})">
    <rect width="980" height="${mainCardHeight}" rx="${isSquare ? 24 : 36}" fill="#fff8f2"/>

    <!-- Ingredients Section -->
    <g transform="translate(30, ${isSquare ? 24 : 40})">
      <text x="0" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 22 : 28}" font-weight="900" fill="#9a3412">
        <tspan fill="#f59e0b">| </tspan>Ingredients (${recipe.ingredients.length})
      </text>
      <g transform="translate(0, ${isSquare ? 38 : 56})">
        ${ingPillsSvg}
      </g>
    </g>

    <!-- Method Section -->
    <g transform="translate(30, ${isSquare ? (24 + Math.ceil(ings.length / 2) * 50 + 50) : (40 + Math.ceil(ings.length / 2) * 66 + 80)})">
      <text x="0" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 22 : 28}" font-weight="900" fill="#9a3412">
        <tspan fill="#f59e0b">| </tspan>Method (${recipe.method.length} steps)
      </text>
      <g transform="translate(0, ${isSquare ? 38 : 56})">
        ${stepsSvg}
      </g>
    </g>
  </g>

  <!-- Bottom Macro Bar -->
  <g transform="translate(540, ${macroBarY})">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 18 : 22}" font-weight="800" fill="#d1b9a5" text-anchor="middle" letter-spacing="1">
      ⏱️ ${escapeXml(recipe.prepTime)} PREP   ·   🔥 ${escapeXml(recipe.cookTime)} COOK   ·   🍽️ ${escapeXml(recipe.servings)} SERVES
    </text>
  </g>
</svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
  return resvg.render().asPng();
}

/**
 * Generate Slide 3 (Brand CTA)
 */
export async function renderSlide3Svg(recipe, theme = { accent: '#f59e0b', bgDark: '#121216' }, aspectRatio = '9:16') {
  const isSquare = aspectRatio === '1:1';
  const svgHeight = isSquare ? 1080 : 1920;
  const brandName = escapeXml(recipe.brandName || 'SnapRecipes');
  const perks = [
    { id: 1, title: 'Save from Anywhere', desc: 'Links, photos, TikTok & IG — one tap.' },
    { id: 2, title: 'No Ads, No Rants', desc: 'Just the clean recipe, instantly.' },
    { id: 3, title: 'Quick Extraction', desc: 'Paste a link, get tidy steps.' },
    { id: 4, title: 'Get Started Today!', desc: 'Free to try.' }
  ];

  const perksSvg = perks.map((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col * (isSquare ? 460 : 460);
    const y = row * (isSquare ? 120 : 160);
    return `
      <g transform="translate(${x}, ${y})">
        <rect width="440" height="${isSquare ? 106 : 136}" rx="${isSquare ? 16 : 22}" fill="#2d140a" fill-opacity="0.85" stroke="#f59e0b" stroke-opacity="0.25" stroke-width="2"/>
        <rect x="16" y="${isSquare ? 16 : 24}" width="${isSquare ? 34 : 44}" height="${isSquare ? 34 : 44}" rx="${isSquare ? 9 : 12}" fill="#f59e0b"/>
        <text x="${isSquare ? 33 : 42}" y="${isSquare ? 40 : 54}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 20 : 24}" font-weight="900" fill="#121216" text-anchor="middle">${p.id}</text>
        <text x="${isSquare ? 64 : 80}" y="${isSquare ? 36 : 44}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 19 : 22}" font-weight="800" fill="#ffffff">${escapeXml(p.title)}</text>
        <text x="${isSquare ? 64 : 80}" y="${isSquare ? 68 : 80}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 15 : 18}" font-weight="500" fill="#d1b9a5">
          ${wordWrap(p.desc, isSquare ? 28 : 24).map((l, li) => `<tspan x="${isSquare ? 64 : 80}" dy="${li === 0 ? 0 : isSquare ? 18 : 24}">${escapeXml(l)}</tspan>`).join('')}
        </text>
      </g>
    `;
  }).join('');

  const topPillY = isSquare ? 80 : 240;
  const brandHeaderY = isSquare ? 240 : 480;
  const perksGridY = isSquare ? 450 : 780;
  const buttonY = isSquare ? 830 : 1420;
  const websiteY = isSquare ? 980 : 1580;

  const svg = `
<svg width="1080" height="${svgHeight}" viewBox="0 0 1080 ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="ctaBg" cx="50%" cy="25%" r="75%">
      <stop offset="0%" stop-color="#421a08"/>
      <stop offset="50%" stop-color="#1c0a03"/>
      <stop offset="100%" stop-color="#0c0401"/>
    </radialGradient>
    <radialGradient id="glowOrb" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0"/>
    </radialGradient>
  </defs>

  <!-- Radial Background -->
  <rect width="1080" height="${svgHeight}" fill="url(#ctaBg)"/>
  <circle cx="540" cy="${isSquare ? 300 : 480}" r="${isSquare ? 300 : 420}" fill="url(#glowOrb)"/>

  <!-- Top Pill -->
  <g transform="translate(540, ${topPillY})">
    <rect x="-220" y="-24" width="440" height="48" rx="24" fill="#f59e0b" fill-opacity="0.18" stroke="#f59e0b" stroke-opacity="0.45" stroke-width="2"/>
    <text x="0" y="8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 17 : 20}" font-weight="800" fill="#fcd34d" text-anchor="middle" letter-spacing="1.5">AD-FREE · NO BLOG RANTS · JUST RECIPES</text>
  </g>

  <!-- Brand Header -->
  <g transform="translate(540, ${brandHeaderY})">
    <!-- App Logo Icon -->
    <rect x="${isSquare ? -40 : -60}" y="${isSquare ? -80 : -120}" width="${isSquare ? 80 : 120}" height="${isSquare ? 80 : 120}" rx="${isSquare ? 20 : 32}" fill="#000000" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2.5"/>
    <text x="0" y="${isSquare ? -30 : -45}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 38 : 52}" font-weight="900" fill="#f59e0b" text-anchor="middle">S</text>

    <!-- Brand Title -->
    <text x="0" y="${isSquare ? 35 : 50}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 52 : 76}" font-weight="900" fill="#f59e0b" text-anchor="middle" letter-spacing="-1">${brandName}</text>
    <text x="0" y="${isSquare ? 75 : 110}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 24 : 32}" font-weight="600" fill="#f3f4f6" text-anchor="middle">${escapeXml(recipe.brandSubtitle || 'Save any recipe in one tap.')}</text>
  </g>

  <!-- 4 Perks Grid -->
  <g transform="translate(90, ${perksGridY})">
    ${perksSvg}
  </g>

  <!-- Glowing Action Button -->
  <g transform="translate(540, ${buttonY})">
    <rect x="${isSquare ? -360 : -420}" y="${isSquare ? -36 : -45}" width="${isSquare ? 720 : 840}" height="${isSquare ? 72 : 90}" rx="${isSquare ? 36 : 45}" fill="#f59e0b"/>
    <text x="0" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 26 : 34}" font-weight="900" fill="#121216" text-anchor="middle" letter-spacing="-0.5">${escapeXml(recipe.ctaButtonText || 'Get the app — free')}</text>
  </g>

  <!-- Website Link -->
  <g transform="translate(540, ${websiteY})">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${isSquare ? 22 : 26}" font-weight="700" fill="#ffffff" fill-opacity="0.8" text-anchor="middle">${escapeXml(recipe.ctaUrl || 'snaprecipes.xyz')}</text>
  </g>
</svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
  return resvg.render().asPng();
}
