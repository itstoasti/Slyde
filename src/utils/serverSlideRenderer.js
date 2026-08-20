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
export async function renderSlide1Svg(recipe, theme = { accent: '#f59e0b', bgDark: '#121216' }) {
  const base64Image = await fetchImageAsBase64(recipe.heroImage);
  const titleLines = wordWrap(recipe.title.toUpperCase(), 16);
  const hookLines = wordWrap(recipe.shortHook || 'Rich, satisfying, and effortless. Restaurant-quality flavors made right at home.', 32);

  const titleSvgLines = titleLines.map((line, i) => 
    `<tspan x="60" dy="${i === 0 ? 0 : 80}">${escapeXml(line)}</tspan>`
  ).join('');

  const hookSvgLines = hookLines.slice(0, 3).map((line, i) => 
    `<tspan x="60" dy="${i === 0 ? 0 : 42}">${escapeXml(line)}</tspan>`
  ).join('');

  const brandTag = escapeXml((recipe.brandName || 'SNAPRECIPES').toUpperCase());
  const rightBadge = escapeXml(`${recipe.cookTime || recipe.prepTime} · ${recipe.servings} SERVINGS`.toUpperCase());

  const svg = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
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
  ${base64Image ? `<image href="${base64Image}" width="1080" height="1920" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="1080" height="1920" fill="#1e140a"/>`}

  <!-- Gradient Scrim -->
  <rect width="1080" height="1920" fill="url(#heroGrad)"/>

  <!-- Top Left Brand Badge -->
  <g transform="translate(60, 110)">
    <rect width="320" height="54" rx="27" fill="#0e0a06" fill-opacity="0.90" stroke="#f59e0b" stroke-opacity="0.4" stroke-width="2"/>
    <circle cx="28" cy="27" r="6" fill="#f59e0b"/>
    <text x="46" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#fef3c7" letter-spacing="1.5">${brandTag}</text>
  </g>

  <!-- Top Right Badge -->
  <g transform="translate(680, 110)">
    <rect width="340" height="54" rx="27" fill="#0e0a06" fill-opacity="0.90" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>
    <text x="170" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="1.2">${rightBadge}</text>
  </g>

  <!-- Content Block in Safe Area -->
  <g transform="translate(0, 1160)">
    <!-- Recipe Title -->
    <text x="60" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="72" font-weight="900" fill="#ffffff" letter-spacing="-1">
      ${titleSvgLines}
    </text>

    <!-- Hook Description -->
    <text x="60" y="${titleLines.length * 80 + 20}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="30" font-weight="600" fill="#fcd34d" line-height="40">
      ${hookSvgLines}
    </text>

    <!-- 4 Macro Stat Cards -->
    <g transform="translate(60, ${titleLines.length * 80 + hookLines.slice(0, 3).length * 42 + 60})">
      <!-- Prep -->
      <g transform="translate(0, 0)">
        <rect width="216" height="110" rx="18" fill="url(#statBoxGrad)" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="2"/>
        <text x="108" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill="#d1b9a5" text-anchor="middle" letter-spacing="1">PREP</text>
        <text x="108" y="84" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(recipe.prepTime)}</text>
      </g>
      <!-- Cook -->
      <g transform="translate(248, 0)">
        <rect width="216" height="110" rx="18" fill="url(#statBoxGrad)" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="2"/>
        <text x="108" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill="#d1b9a5" text-anchor="middle" letter-spacing="1">COOK</text>
        <text x="108" y="84" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(recipe.cookTime)}</text>
      </g>
      <!-- Serves -->
      <g transform="translate(496, 0)">
        <rect width="216" height="110" rx="18" fill="url(#statBoxGrad)" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="2"/>
        <text x="108" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill="#d1b9a5" text-anchor="middle" letter-spacing="1">SERVES</text>
        <text x="108" y="84" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(recipe.servings)}</text>
      </g>
      <!-- Calories / Protein -->
      <g transform="translate(744, 0)">
        <rect width="216" height="110" rx="18" fill="url(#statBoxGrad)" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="2"/>
        <text x="108" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill="#d1b9a5" text-anchor="middle" letter-spacing="1">${recipe.proteinCallout ? 'PROTEIN' : 'CALORIES'}</text>
        <text x="108" y="84" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">${escapeXml(recipe.proteinCallout ? recipe.proteinCallout.replace(/protein/i, '').trim() : (recipe.calories ? recipe.calories.replace(/cal/i, '').trim() : '350'))}</text>
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
export async function renderSlide2Svg(recipe) {
  const base64Image = await fetchImageAsBase64(recipe.heroImage);
  const ings = recipe.ingredients.slice(0, 8);
  const steps = recipe.method.slice(0, 5);

  const ingPillsSvg = ings.map((ing, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = col * 460;
    const y = row * 66;
    const label = `${ing.name}${ing.amount ? ' — ' + ing.amount : ''}`;
    const cleanLabel = label.length > 28 ? label.slice(0, 26) + '...' : label;
    return `
      <g transform="translate(${x}, ${y})">
        <rect width="440" height="52" rx="12" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/>
        <circle cx="20" cy="26" r="4" fill="#f59e0b"/>
        <text x="34" y="33" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#1f2937">${escapeXml(cleanLabel)}</text>
      </g>
    `;
  }).join('');

  const stepsSvg = steps.map((step, i) => {
    const y = i * 118;
    const cleanStep = step.length > 70 ? step.slice(0, 68) + '...' : step;
    const stepLines = wordWrap(cleanStep, 46);
    return `
      <g transform="translate(0, ${y})">
        <rect width="920" height="102" rx="16" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/>
        <rect x="16" y="18" width="40" height="40" rx="10" fill="#f59e0b"/>
        <text x="36" y="45" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="900" fill="#ffffff" text-anchor="middle">${i + 1}</text>
        <text x="74" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="21" font-weight="600" fill="#1f2937">
          ${stepLines.slice(0, 2).map((l, li) => `<tspan x="74" dy="${li === 0 ? 0 : 28}">${escapeXml(l)}</tspan>`).join('')}
        </text>
      </g>
    `;
  }).join('');

  const svg = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="thumbClip">
      <circle cx="60" cy="60" r="54"/>
    </clipPath>
  </defs>

  <!-- Dark Background -->
  <rect width="1080" height="1920" fill="#121216"/>

  <!-- Top Header -->
  <g transform="translate(60, 110)">
    <text x="0" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="900" fill="#f59e0b" letter-spacing="2">RECIPE CARD</text>
    <text x="0" y="68" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="#ffffff">${escapeXml(recipe.title.length > 25 ? recipe.title.slice(0, 23) + '...' : recipe.title)}</text>
    
    <!-- Thumbnail Image -->
    ${base64Image ? `
    <g transform="translate(840, -10)">
      <circle cx="60" cy="60" r="58" fill="none" stroke="#f59e0b" stroke-width="4"/>
      <image href="${base64Image}" width="120" height="120" clip-path="url(#thumbClip)" preserveAspectRatio="xMidYMid slice"/>
    </g>` : ''}
  </g>

  <!-- Main Ivory Card -->
  <g transform="translate(50, 240)">
    <rect width="980" height="1520" rx="36" fill="#fff8f2"/>

    <!-- Ingredients Section -->
    <g transform="translate(30, 40)">
      <text x="0" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#9a3412">
        <tspan fill="#f59e0b">| </tspan>Ingredients (${recipe.ingredients.length})
      </text>
      <g transform="translate(0, 56)">
        ${ingPillsSvg}
      </g>
    </g>

    <!-- Method Section -->
    <g transform="translate(30, ${40 + Math.ceil(ings.length / 2) * 66 + 80})">
      <text x="0" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#9a3412">
        <tspan fill="#f59e0b">| </tspan>Method (${recipe.method.length} steps)
      </text>
      <g transform="translate(0, 56)">
        ${stepsSvg}
      </g>
    </g>
  </g>

  <!-- Bottom Macro Bar -->
  <g transform="translate(540, 1820)">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#d1b9a5" text-anchor="middle" letter-spacing="1">
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
export async function renderSlide3Svg(recipe) {
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
    const x = col * 460;
    const y = row * 160;
    return `
      <g transform="translate(${x}, ${y})">
        <rect width="440" height="136" rx="22" fill="#2d140a" fill-opacity="0.85" stroke="#f59e0b" stroke-opacity="0.25" stroke-width="2"/>
        <rect x="20" y="24" width="44" height="44" rx="12" fill="#f59e0b"/>
        <text x="42" y="54" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="900" fill="#121216" text-anchor="middle">${p.id}</text>
        <text x="80" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#ffffff">${escapeXml(p.title)}</text>
        <text x="80" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="500" fill="#d1b9a5">
          ${wordWrap(p.desc, 24).map((l, li) => `<tspan x="80" dy="${li === 0 ? 0 : 24}">${escapeXml(l)}</tspan>`).join('')}
        </text>
      </g>
    `;
  }).join('');

  const svg = `
<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
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
  <rect width="1080" height="1920" fill="url(#ctaBg)"/>
  <circle cx="540" cy="480" r="420" fill="url(#glowOrb)"/>

  <!-- Top Pill -->
  <g transform="translate(540, 240)">
    <rect x="-240" y="-30" width="480" height="60" rx="30" fill="#f59e0b" fill-opacity="0.18" stroke="#f59e0b" stroke-opacity="0.45" stroke-width="2"/>
    <text x="0" y="8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#fcd34d" text-anchor="middle" letter-spacing="1.5">AD-FREE · NO BLOG RANTS · JUST RECIPES</text>
  </g>

  <!-- Brand Header -->
  <g transform="translate(540, 480)">
    <!-- App Logo Icon -->
    <rect x="-60" y="-120" width="120" height="120" rx="32" fill="#000000" stroke="#ffffff" stroke-opacity="0.2" stroke-width="3"/>
    <text x="0" y="-45" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="900" fill="#f59e0b" text-anchor="middle">S</text>

    <!-- Brand Title -->
    <text x="0" y="50" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="76" font-weight="900" fill="#f59e0b" text-anchor="middle" letter-spacing="-1">${brandName}</text>
    <text x="0" y="110" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="600" fill="#f3f4f6" text-anchor="middle">${escapeXml(recipe.brandSubtitle || 'Save any recipe in one tap.')}</text>
  </g>

  <!-- 4 Perks Grid -->
  <g transform="translate(90, 780)">
    ${perksSvg}
  </g>

  <!-- Mini Brand Pill -->
  <g transform="translate(540, 1260)">
    <rect x="-18" y="-18" width="36" height="36" rx="8" fill="#f59e0b"/>
    <text x="32" y="8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="800" fill="#ffffff">${brandName}</text>
  </g>

  <!-- Glowing Action Button -->
  <g transform="translate(540, 1420)">
    <rect x="-420" y="-45" width="840" height="90" rx="45" fill="#f59e0b"/>
    <text x="0" y="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="900" fill="#121216" text-anchor="middle" letter-spacing="-0.5">${escapeXml(recipe.ctaButtonText || 'Get the app — free')}</text>
  </g>

  <!-- Website Link -->
  <g transform="translate(540, 1580)">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="700" fill="#ffffff" fill-opacity="0.8" text-anchor="middle">${escapeXml(recipe.ctaUrl || 'snaprecipes.xyz')}</text>
  </g>
</svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
  return resvg.render().asPng();
}
