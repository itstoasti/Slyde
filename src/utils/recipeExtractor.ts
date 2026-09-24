import { RecipeData } from '../types';
import { DEFAULT_BRAND_LOGO } from '../assets/defaultBrandLogo';

// Helper to format ISO 8601 duration (e.g., PT15M -> 15m)
function formatIsoDuration(duration?: string): string {
  if (!duration) return '10m';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return duration.replace(/^PT/i, '').toLowerCase() || '10m';
  const hours = match[1] ? `${match[1]}h ` : '';
  const mins = match[2] ? `${match[2]}m` : '';
  return `${hours}${mins}`.trim() || '10m';
}

// Decode HTML entities (e.g., &#39; -> ', &amp; -> &)
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// Determines if a token is a video ID, hash, numeric ID, or routing keyword
export function isHashOrId(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const clean = token.trim();
  if (!clean) return false;
  if (clean.includes(' ')) return false;

  // 1. Pure numbers of any length (e.g. 12031464, 7238491829384719283, 22728, 15)
  if (/^\d+$/.test(clean)) return true;

  // 2. Common URL routing words or file extensions
  if (/^(video|watch|recipe|recipes|shorts?|reels?|posts?|cooking|food|channel|user|status|embed|share|default|photo|media|view|html?|php|aspx?)$/i.test(clean)) {
    return true;
  }

  // 3. Hexadecimal hashes (e.g. 8b0b0580bfb1)
  if (/^[0-9a-f]{8,}$/i.test(clean)) return true;

  // 4. If token contains hyphens or underscores (like creamy-tuscan-garlic-chicken)
  if (clean.includes('-') || clean.includes('_')) {
    const parts = clean.split(/[-_]+/).filter(Boolean);
    if (parts.length > 0 && parts.every(p => isHashOrId(p))) return true;
    return false;
  }

  // 5. Mixed alphanumeric tokens with letters and digits (e.g. 5xT0iNqJqG8, C8XYZ12345, ZT8Babcde)
  if (/[a-zA-Z]/.test(clean) && /\d/.test(clean)) {
    if (!/^\d+(st|nd|rd|th)$/i.test(clean)) return true;
  }

  // 6. Mixed-case single tokens with capital letters in the middle (random casing IDs)
  if (clean.length >= 5) {
    const isStandardTitleCase = /^[A-Z][a-z]+$/.test(clean);
    const isAllLower = /^[a-z]+$/.test(clean);
    const isAllUpper = /^[A-Z]+$/.test(clean);
    if (!isStandardTitleCase && !isAllLower && !isAllUpper) return true;
  }

  // 7. Tokens with no vowels at all and length >= 4
  if (clean.length >= 4 && !/[aeiouy]/i.test(clean)) return true;

  return false;
}

// Master Title Sanitizer: Removes URL numeric IDs, video IDs, hashtags, file extensions, and cleans formatting
export function cleanRecipeTitle(rawTitle: string, url: string = ''): string {
  let title = (rawTitle || '').trim();
  if (isHashOrId(title)) title = '';

  // If no title or generic placeholder, extract from URL
  const isGeneric = !title || /^(delicious recipe|recipe|watch|video|untitled|home|shorts?|reels?|\d+)$/i.test(title);
  if (isGeneric && url) {
    try {
      const u = new URL(url);
      const segments = u.pathname.split('/').filter(Boolean);
      const validSegments = segments.filter(seg => !isHashOrId(seg) && !seg.startsWith('@'));
      if (validSegments.length > 0) {
        const lastSlug = validSegments[validSegments.length - 1];
        const slugWords = lastSlug
          .replace(/[-_]+/g, ' ')
          .split(' ')
          .filter(w => !isHashOrId(w));
        if (slugWords.length > 0) title = slugWords.join(' ');
      }
      if (!title || isHashOrId(title)) {
        const userSeg = segments.find(s => s.startsWith('@'));
        if (userSeg) {
          const author = userSeg.replace(/^@+/, '').replace(/[-_.]+/g, ' ');
          title = `${author} Signature Dish`;
        }
      }
    } catch (e) {}
  }

  // 1. Decode HTML entities
  title = decodeHtmlEntities(title);

  // 2. Strip file extensions
  title = title.replace(/\.(html?|php|aspx?)$/i, '');

  // 3. Remove social platform suffixes & hashtags
  title = title.replace(/\s*[-–—|]\s*(YouTube|TikTok|Instagram|Allrecipes|Food Network|NYT Cooking|Tasty|Epicurious|Sally's Baking).*$/i, '');
  title = title.replace(/#\w+/g, '');
  title = title.replace(/[-_]+/g, ' ');

  // 4. Tokenize and filter out ANY word/token that is an ID, hash, or pure number
  const rawWords = title.split(/\s+/).filter(Boolean);
  const filteredWords: string[] = [];
  for (let i = 0; i < rawWords.length; i++) {
    const w = rawWords[i];
    const nextW = (rawWords[i + 1] || '').toLowerCase();
    // Allow small numbers if followed by "minute", "ingredient", "step", "layer", "hour"
    if (/^\d{1,2}$/.test(w) && /^(minute|minutes|min|mins|ingredient|ingredients|step|steps|layer|layers|hour|hours)$/i.test(nextW)) {
      filteredWords.push(w);
      continue;
    }
    if (isHashOrId(w)) continue;
    filteredWords.push(w);
  }

  title = filteredWords.join(' ')
    .replace(/\s+recipe\s*$/i, '')
    .replace(/^recipe\s+for\s+/i, '')
    .replace(/^how\s+to\s+make\s+/i, '')
    .replace(/^making\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 5. If title is empty, too short, generic, or an ID, use an attractive culinary default
  if (!title || title.length < 3 || isHashOrId(title) || /^(delicious|homemade|tasty|quick|easy|amazing|best)$/i.test(title)) {
    if (url) {
      if (url.includes('tiktok.com') || url.includes('instagram.com') || url.includes('youtube.com') || url.includes('youtu.be')) {
        title = 'Trending Viral Video Dish';
      } else {
        title = 'Chef’s Kitchen Creation';
      }
    } else {
      title = 'Chef’s Special Recipe';
    }
  }

  // 6. Title case
  return title.replace(/\b\w/g, c => c.toUpperCase());
}

// Fallback high quality food photography for extracted recipes based on keywords
export function getFallbackImage(title: string): string {
  const t = (title || '').toLowerCase();
  if (t.includes('tiramisu') || t.includes('chantilly') || t.includes('parfait') || t.includes('trifle') || t.includes('berry') || t.includes('mascarpone') || t.includes('ladyfinger')) {
    return 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('cheesecake')) {
    return 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('pie') || t.includes('tart') || t.includes('cobbler') || t.includes('crisp')) {
    return 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('caramel') || t.includes('apple') || t.includes('fridge cake') || t.includes('icebox')) {
    return 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('fudge') || t.includes('ice cream') || t.includes('brownie') || t.includes('chocolate')) {
    return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('cookie') || t.includes('doughnut') || t.includes('donut') || t.includes('cake') || t.includes('dessert') || t.includes('sweet') || t.includes('sugar') || t.includes('vanilla') || t.includes('cream')) {
    return 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('pudding') || t.includes('banana')) {
    return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('crab') || t.includes('rangoon') || t.includes('wonton') || t.includes('dumpling')) {
    return 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('burger') || t.includes('smashburger') || t.includes('slider')) {
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('taco') || t.includes('birria') || t.includes('quesadilla') || t.includes('burrito') || t.includes('mexican')) {
    return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('pizza') || t.includes('flatbread')) {
    return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('pasta') || t.includes('spaghetti') || t.includes('penne') || t.includes('alfredo') || t.includes('macaroni')) {
    return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('chicken') || t.includes('wings') || t.includes('poultry')) {
    return 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('steak') || t.includes('beef') || t.includes('ribeye')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('salmon') || t.includes('fish') || t.includes('seafood') || t.includes('shrimp')) {
    return 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('rice') || t.includes('hibachi') || t.includes('noodle') || t.includes('stir fry') || t.includes('asian')) {
    return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=1200&q=85';
  }
  if (t.includes('salad') || t.includes('bowl') || t.includes('greens')) {
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=85';
  }
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=85';
}

// Generate an intelligent punchy hook based on title and ingredients
function generateHook(title: string, prep: string, cook: string, numIngredients: number): string {
  const isQuick = prep.includes('5') || prep.includes('10') || cook === '0m' || cook.includes('0');
  const t = title.toLowerCase();
  if (t.includes('apple') || t.includes('fridge cake') || t.includes('icebox') || t.includes('pudding')) {
    return `No baking required — chill it overnight and watch it turn into pure magic.`;
  }
  if (t.includes('burger') || t.includes('smashburger')) {
    return `Crispy lacy edges, melted cheese, and toasted buns — diner perfection in 10 minutes.`;
  }
  if (t.includes('taco') || t.includes('birria')) {
    return `Crispy, deeply savory, and loaded with melted cheese — restaurant tacos made easy.`;
  }
  if (t.includes('pizza')) {
    return `Crispy bubbly crust and melted cheese — better than delivery and hot in 15 minutes.`;
  }
  if (t.includes('funnel') || t.includes('cake') || t.includes('dessert') || t.includes('sweet') || t.includes('fudge')) {
    return `Crispy, rich, and indulgent — carnival-level perfection straight from your own kitchen.`;
  }
  if (t.includes('crab') || t.includes('rangoon') || t.includes('crispy') || t.includes('fried')) {
    return `Crispy on the outside, creamy on the inside — restaurant perfection made easy.`;
  }
  if (isQuick) {
    return `No complicated tools — ${prep || '10 minutes'} prep and it's ready. Peak simplicity in every bite.`;
  }
  if (numIngredients <= 5) {
    return `Just ${numIngredients} simple ingredients. Zero hassle. Restaurant-quality flavors made effortless.`;
  }
  return `Rich, satisfying, and effortless. Restaurant-quality flavors made right at home.`;
}

// Helper to parse servings accurately from strings, numbers, or arrays
function parseServings(rawYield: any): string {
  if (!rawYield) return '4';
  if (Array.isArray(rawYield)) {
    for (const item of rawYield) {
      const parsed = parseServings(item);
      if (parsed && parsed !== '4') return parsed;
    }
    if (rawYield.length > 0) return parseServings(rawYield[0]);
  }
  const str = String(rawYield).trim();
  const rangeMatch = str.match(/(\d+)\s*(?:to|-)\s*(\d+)/i);
  if (rangeMatch) return `${rangeMatch[1]}-${rangeMatch[2]}`;
  const numMatch = str.match(/(\d+)/);
  if (numMatch) return numMatch[1];
  return '4';
}

// Clean and format ingredients into concise, natural strings
function cleanIngredient(raw: string): string {
  if (!raw) return '';
  let str = decodeHtmlEntities(raw).trim();

  str = str.replace(/\btablespoons?\b/gi, 'tbsp');
  str = str.replace(/\bteaspoons?\b/gi, 'tsp');
  str = str.replace(/\bpounds?\b/gi, 'lb');
  str = str.replace(/\bounces?\b/gi, 'oz');
  str = str.replace(/\bpackages?\b/gi, 'pkg');
  str = str.replace(/\bquarts?\b/gi, 'qt');
  str = str.replace(/\bpints?\b/gi, 'pt');

  str = str.replace(/([1-9]\d*)\.5\d*/g, '$1 1/2');
  str = str.replace(/([1-9]\d*)\.25\d*/g, '$1 1/4');
  str = str.replace(/([1-9]\d*)\.75\d*/g, '$1 3/4');
  str = str.replace(/\b0\.5\d*/g, '1/2');
  str = str.replace(/\b0\.25\d*/g, '1/4');
  str = str.replace(/\b0\.75\d*/g, '3/4');

  str = str.replace(/,\s*or\s+to\s+taste/gi, ' (to taste)');
  str = str.replace(/,\s*or\s+as\s+needed/gi, '');
  str = str.replace(/,\s*divided/gi, '');

  return str.trim();
}

// Intelligent Culinary Dish Synthesizer
// Generates realistic, authentic ingredients and method tailored to the dish title when structured data is missing
export function synthesizeDishRecipe(title: string, url: string = ''): {
  ingredients: { name: string; amount: string }[];
  method: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
  calories: string;
  proteinCallout: string;
} {
  const t = (title || url || '').toLowerCase();

  // 1. Smash Burger / Burgers / Sliders
  if (t.includes('burger') || t.includes('smashburger') || t.includes('slider') || t.includes('patty')) {
    return {
      prepTime: '10m',
      cookTime: '8m',
      servings: '4',
      calories: '540 cal',
      proteinCallout: '36g protein',
      ingredients: [
        { name: 'Ground Beef Chuck (80/20)', amount: '1.25 lbs (560g)' },
        { name: 'Brioche or Potato Buns', amount: '4 buns' },
        { name: 'American Cheese Slices', amount: '8 slices' },
        { name: 'Dill Pickle Chips & Sliced Onion', amount: '1/2 cup total' },
        { name: 'Special Burger Sauce (Mayo, Relish, Mustard)', amount: '1/3 cup' },
        { name: 'Kosher Salt & Fresh Black Pepper', amount: '1 tsp each' }
      ],
      method: [
        'Divide ground beef loosely into 8 equal balls; do not overwork or pack the meat.',
        'Heat a heavy cast iron skillet or griddle over high heat until smoking hot.',
        'Place beef balls onto the dry skillet and smash down paper-thin with a firm spatula.',
        'Season generously with salt and pepper; sear undisturbed for 2 minutes until dark, lacy edges form.',
        'Flip patties, immediately top each with cheese, stack two patties together, and serve on toasted sauced buns.'
      ]
    };
  }

  // 2. Tacos / Birria / Quesadillas / Mexican
  if (t.includes('taco') || t.includes('birria') || t.includes('quesadilla') || t.includes('burrito') || t.includes('fajita') || t.includes('enchilada')) {
    return {
      prepTime: '15m',
      cookTime: '15m',
      servings: '4',
      calories: '420 cal',
      proteinCallout: '28g protein',
      ingredients: [
        { name: 'Tender Shredded Beef, Chicken, or Carnitas', amount: '1 lb (450g)' },
        { name: 'White Corn Tortillas', amount: '8-10 tortillas' },
        { name: 'Oaxaca or Monterey Jack Cheese (shredded)', amount: '1.5 cups' },
        { name: 'White Onion & Fresh Cilantro (finely chopped)', amount: '1/2 cup each' },
        { name: 'Fresh Limes (cut into wedges)', amount: '2 limes' },
        { name: 'Warm Rich Consomé or Salsa Verde for dipping', amount: '1 cup' }
      ],
      method: [
        'Warm shredded meat in a skillet with a splash of broth until sizzling and hot.',
        'Dip corn tortillas lightly into meat broth or oil, then place on a medium-hot skillet.',
        'Sprinkle half of each tortilla with cheese, spoonful of warm meat, onion, and cilantro.',
        'Fold tortillas in half and griddle 2-3 minutes per side until crisp and golden brown.',
        'Serve piping hot with fresh lime wedges and warm consomé for dipping.'
      ]
    };
  }

  // 3. Pizza / Flatbread / Calzone
  if (t.includes('pizza') || t.includes('flatbread') || t.includes('calzone')) {
    return {
      prepTime: '15m',
      cookTime: '12m',
      servings: '4',
      calories: '380 cal',
      proteinCallout: '16g protein',
      ingredients: [
        { name: 'Pizza Dough (store-bought or homemade)', amount: '1 lb (450g)' },
        { name: 'San Marzano Tomato Pizza Sauce', amount: '3/4 cup' },
        { name: 'Low-Moisture Whole Milk Mozzarella (shredded)', amount: '2 cups' },
        { name: 'Pepperoni Slices or Preferred Toppings', amount: '4 oz' },
        { name: 'Extra Virgin Olive Oil & Dried Oregano', amount: '1 tbsp each' },
        { name: 'Fresh Basil Leaves & Grated Parmesan', amount: 'For garnish' }
      ],
      method: [
        'Preheat oven and pizza stone to 500°F (260°C) for at least 30 minutes.',
        'Stretch dough on a floured surface into a 12-14 inch circle with a slightly raised rim.',
        'Spread tomato sauce evenly over dough, leaving 1/2-inch border around edges.',
        'Scatter shredded mozzarella and top evenly with pepperoni or favorite toppings.',
        'Bake for 10-12 minutes until crust is blistered and cheese is bubbling and golden.'
      ]
    };
  }

  // 4. Mac & Cheese / Baked Macaroni
  if (t.includes('mac and cheese') || t.includes('mac & cheese') || t.includes('macaroni and cheese') || t.includes('baked mac')) {
    return {
      prepTime: '15m',
      cookTime: '20m',
      servings: '6',
      calories: '490 cal',
      proteinCallout: '22g protein',
      ingredients: [
        { name: 'Elbow Macaroni or Cavatappi Pasta', amount: '1 lb (450g)' },
        { name: 'Sharp Cheddar & Gruyère Cheese (freshly grated)', amount: '4 cups total' },
        { name: 'Whole Milk & Heavy Cream', amount: '2 cups milk, 1 cup cream' },
        { name: 'Unsalted Butter & All-Purpose Flour', amount: '4 tbsp each' },
        { name: 'Dijon Mustard, Smoked Paprika & Garlic Powder', amount: '1/2 tsp each' },
        { name: 'Panko Breadcrumbs & Melted Butter', amount: '1/2 cup for topping' }
      ],
      method: [
        'Boil pasta in heavily salted water until 1 minute shy of al dente; drain well.',
        'Melt butter in a large saucepan over medium heat; whisk in flour and cook for 1 minute.',
        'Slowly pour in milk and heavy cream while whisking; simmer until thickened (3-4 minutes).',
        'Remove from heat, whisk in seasonings, and fold in 3 cups of grated cheese until silky smooth.',
        'Toss pasta into cheese sauce, transfer to a baking dish, top with remaining cheese, and broil until bubbly.'
      ]
    };
  }

  // 5. Fried Rice / Hibachi / Stir Fry / Lo Mein / Noodles
  if (t.includes('fried rice') || t.includes('hibachi') || t.includes('stir fry') || t.includes('lo mein') || t.includes('chow mein') || t.includes('noodle') || t.includes('ramen')) {
    return {
      prepTime: '10m',
      cookTime: '10m',
      servings: '4',
      calories: '360 cal',
      proteinCallout: '18g protein',
      ingredients: [
        { name: 'Cold Day-Old Jasmine Rice or Noodles', amount: '4 cups' },
        { name: 'Large Eggs (beaten)', amount: '3' },
        { name: 'Green Onions (scallions, thinly sliced)', amount: '4 stalks' },
        { name: 'Soy Sauce, Oyster Sauce & Toasted Sesame Oil', amount: '2 tbsp soy, 1 tbsp each other' },
        { name: 'Fresh Garlic & Ginger (finely minced)', amount: '1 tbsp each' },
        { name: 'Butter or High-Heat Cooking Oil', amount: '2 tbsp' }
      ],
      method: [
        'Heat wok or large skillet over high heat with 1 tablespoon of butter until sizzling.',
        'Scramble beaten eggs quickly until soft curds form; remove and set aside.',
        'Add remaining oil, minced garlic, ginger, and white parts of green onions; cook 30 seconds.',
        'Add cold rice, breaking up clumps with a spatula; stir-fry vigorously for 3-4 minutes.',
        'Drizzle soy sauce, oyster sauce, and sesame oil; fold in scrambled eggs and green onion tops.'
      ]
    };
  }

  // 6. French Toast / Pancakes / Waffles / Breakfast
  if (t.includes('pancake') || t.includes('french toast') || t.includes('waffle') || t.includes('crepe') || t.includes('breakfast')) {
    return {
      prepTime: '10m',
      cookTime: '10m',
      servings: '4',
      calories: '340 cal',
      proteinCallout: '12g protein',
      ingredients: [
        { name: 'Thick Brioche, Challah, or Sourdough Slices', amount: '6-8 thick slices' },
        { name: 'Large Eggs & Whole Milk', amount: '4 eggs, 3/4 cup milk' },
        { name: 'Pure Vanilla Extract & Ground Cinnamon', amount: '1 tsp each' },
        { name: 'Brown Sugar or Maple Syrup', amount: '2 tbsp' },
        { name: 'Unsalted Butter for cooking', amount: '2 tbsp' },
        { name: 'Powdered Sugar & Fresh Berries for serving', amount: 'To taste' }
      ],
      method: [
        'Whisk eggs, milk, vanilla, cinnamon, and brown sugar in a wide shallow bowl.',
        'Melt 1 tablespoon of butter in a large nonstick skillet over medium heat.',
        'Dip bread slices into custard for 15 seconds per side until fully soaked but not falling apart.',
        'Cook slices for 3-4 minutes per side until deeply golden brown and cooked through the center.',
        'Dust with powdered sugar and serve warm with pure maple syrup and fresh fruit.'
      ]
    };
  }

  // 7. Wings / Fried Chicken / Crispy Chicken Tenders
  if (t.includes('wing') || t.includes('fried chicken') || t.includes('tender') || t.includes('nugget') || t.includes('crispy chicken')) {
    return {
      prepTime: '15m',
      cookTime: '20m',
      servings: '4',
      calories: '440 cal',
      proteinCallout: '38g protein',
      ingredients: [
        { name: 'Chicken Wings or Boneless Tenders', amount: '2 lbs (900g)' },
        { name: 'Baking Powder (for ultra-crisp skin) or Cornstarch', amount: '1 tbsp' },
        { name: 'Garlic Powder, Onion Powder & Smoked Paprika', amount: '1 tsp each' },
        { name: 'Hot Honey or Buffalo Sauce', amount: '1/2 cup' },
        { name: 'Melted Butter', amount: '3 tbsp' },
        { name: 'Ranch or Blue Cheese Dip & Celery', amount: 'For serving' }
      ],
      method: [
        'Pat chicken completely dry with paper towels; toss in a bowl with baking powder and spices.',
        'Arrange in a single layer on a parchment-lined baking sheet or air fryer basket.',
        'Bake at 425°F (220°C) or air fry at 400°F for 20-25 minutes, flipping halfway, until golden and shatteringly crisp.',
        'Warm hot sauce and melted butter together in a small bowl.',
        'Toss hot crispy wings in the sauce until coated, then serve immediately with cold ranch.'
      ]
    };
  }

  // 8. Butter Chicken / Chicken Tikka Masala / Curry
  if (t.includes('tikka') || t.includes('butter chicken') || t.includes('curry') || t.includes('biryani') || t.includes('masala')) {
    return {
      prepTime: '15m',
      cookTime: '20m',
      servings: '4',
      calories: '460 cal',
      proteinCallout: '34g protein',
      ingredients: [
        { name: 'Boneless Skinless Chicken Thighs (bite-sized)', amount: '1.5 lbs' },
        { name: 'Tomato Puree or Passata', amount: '1 can (14 oz)' },
        { name: 'Heavy Whipping Cream or Coconut Milk', amount: '3/4 cup' },
        { name: 'Butter & Garlic-Ginger Paste', amount: '3 tbsp butter, 2 tbsp paste' },
        { name: 'Garam Masala, Cumin, Turmeric & Chili Powder', amount: '1 tsp each' },
        { name: 'Warm Garlic Naan & Basmati Rice for serving', amount: 'To taste' }
      ],
      method: [
        'Season chicken with garam masala and sear in 1 tablespoon butter over high heat until browned; set aside.',
        'Melt remaining butter in the skillet; add garlic-ginger paste and spices, cooking for 1 minute.',
        'Pour in tomato puree and simmer over medium-low heat for 10 minutes until reduced and rich.',
        'Stir in heavy cream and return chicken and juices to the sauce; simmer 5 minutes until tender.',
        'Garnish with chopped cilantro and serve with steaming basmati rice and warm garlic naan.'
      ]
    };
  }

  // 9. Soup / Chili / Ramen / Stew / Chowder
  if (t.includes('soup') || t.includes('chili') || t.includes('stew') || t.includes('chowder')) {
    return {
      prepTime: '15m',
      cookTime: '30m',
      servings: '6',
      calories: '340 cal',
      proteinCallout: '26g protein',
      ingredients: [
        { name: 'Ground Beef or Shredded Chicken', amount: '1.25 lbs' },
        { name: 'Diced Tomatoes & Kidney Beans (drained)', amount: '1 can each (14 oz)' },
        { name: 'Rich Chicken or Beef Bone Broth', amount: '3 cups' },
        { name: 'Diced Onion, Bell Pepper & Garlic', amount: '1 cup mixed' },
        { name: 'Chili Powder, Cumin, Oregano & Smoked Paprika', amount: '1 tbsp chili, 1 tsp each other' },
        { name: 'Shredded Cheddar, Sour Cream & Green Onions', amount: 'For topping' }
      ],
      method: [
        'Brown ground beef or chicken in a large heavy pot over medium-high heat; drain excess grease.',
        'Add diced onion, bell pepper, and garlic; sauté for 3-4 minutes until softened.',
        'Stir in spices, cooking for 60 seconds until fragrant.',
        'Add canned tomatoes, beans, and rich broth; bring to a boil, then reduce heat and simmer gently for 20 minutes.',
        'Ladle into warm bowls and top with shredded cheese, sour cream, and sliced scallions.'
      ]
    };
  }

  // 10. Garlic Butter Shrimp / Salmon / Fish / Seafood
  if (t.includes('salmon') || t.includes('shrimp') || t.includes('seafood') || t.includes('fish') || t.includes('crab') || t.includes('lobster')) {
    return {
      prepTime: '10m',
      cookTime: '10m',
      servings: '4',
      calories: '320 cal',
      proteinCallout: '32g protein',
      ingredients: [
        { name: 'Large Shrimp (peeled & deveined) or Salmon Fillets', amount: '1.25 lbs' },
        { name: 'Unsalted Butter & Extra Virgin Olive Oil', amount: '3 tbsp butter, 1 tbsp oil' },
        { name: 'Fresh Garlic (minced)', amount: '5 cloves' },
        { name: 'Dry White Wine or Low-Sodium Chicken Broth', amount: '1/3 cup' },
        { name: 'Fresh Lemon Juice & Zest', amount: 'Juice of 1 lemon' },
        { name: 'Fresh Italian Parsley & Red Pepper Flakes', amount: '1/4 cup parsley, pinch flakes' }
      ],
      method: [
        'Pat seafood thoroughly dry with paper towels; season lightly with salt, pepper, and red pepper flakes.',
        'Heat olive oil and 1 tablespoon of butter in a large skillet over medium-high heat until hot.',
        'Add seafood in a single layer; cook 2 minutes per side until pink and opaque (do not overcook).',
        'Remove seafood from pan; add minced garlic to pan drippings and sauté 30 seconds.',
        'Pour in white wine and lemon juice, simmering 1 minute, then swirl in remaining cold butter; spoon sauce over seafood.'
      ]
    };
  }

  // 11. Steak / Beef / Ribeye / Roast Beef / Meatballs
  if (t.includes('steak') || t.includes('beef') || t.includes('ribeye') || t.includes('filet') || t.includes('meatball') || t.includes('sirloin')) {
    return {
      prepTime: '10m',
      cookTime: '12m',
      servings: '2',
      calories: '520 cal',
      proteinCallout: '44g protein',
      ingredients: [
        { name: 'Prime Cut Steak (Ribeye, Strip, or Filet)', amount: '2 steaks (12 oz each)' },
        { name: 'Coarse Kosher Salt & Fresh Cracked Pepper', amount: '1 tbsp each' },
        { name: 'Unsalted Butter', amount: '3 tbsp' },
        { name: 'Fresh Rosemary & Thyme Sprigs', amount: '3-4 sprigs' },
        { name: 'Garlic Cloves (smashed)', amount: '3 cloves' },
        { name: 'High-Heat Cooking Oil (Avocado or Grapeseed)', amount: '1 tbsp' }
      ],
      method: [
        'Bring steaks to room temperature for 20 minutes; pat thoroughly dry and season heavily with salt and pepper.',
        'Heat a cast iron skillet over high heat until smoking hot, then add cooking oil.',
        'Sear steaks for 3-4 minutes undisturbed until a deep golden crust forms; flip over.',
        'Add butter, smashed garlic, and fresh herbs to skillet; tilt pan and baste steak continuously with foaming butter for 2 minutes.',
        'Transfer to a warm board and rest for 6-8 minutes before slicing across the grain.'
      ]
    };
  }

  // 12. Pasta / Alfredo / Spaghetti / Carbonara / Lasagna / Penne
  if (t.includes('pasta') || t.includes('spaghetti') || t.includes('penne') || t.includes('alfredo') || t.includes('carbonara') || t.includes('lasagna') || t.includes('bolognese') || t.includes('vodka sauce')) {
    return {
      prepTime: '10m',
      cookTime: '15m',
      servings: '4',
      calories: '460 cal',
      proteinCallout: '18g protein',
      ingredients: [
        { name: 'Quality Pasta of choice', amount: '1 lb (450g)' },
        { name: 'Extra Virgin Olive Oil or Butter', amount: '3 tbsp' },
        { name: 'Fresh Garlic (thinly sliced or minced)', amount: '4 cloves' },
        { name: 'Freshly Grated Parmigiano-Reggiano', amount: '3/4 cup' },
        { name: 'Heavy Cream or Reserved Starchy Pasta Water', amount: '1/2 cup' },
        { name: 'Fresh Basil or Italian Parsley', amount: 'Small bunch, chopped' }
      ],
      method: [
        'Bring a large pot of salted water to a rolling boil and cook pasta until al dente.',
        'Before draining, scoop out 3/4 cup of the starchy pasta cooking water and set aside.',
        'Sauté garlic in olive oil over medium-low heat until fragrant and pale golden (about 2 minutes).',
        'Add cooked pasta, grated cheese, and splashes of reserved pasta water into the skillet; toss vigorously until a silky sauce coats every piece.',
        'Season with fresh cracked black pepper and chopped herbs; serve piping hot.'
      ]
    };
  }

  // 13. Chicken Breasts / Chicken Thighs / Poultry
  if (t.includes('chicken') || t.includes('poultry') || t.includes('thigh')) {
    return {
      prepTime: '10m',
      cookTime: '18m',
      servings: '4',
      calories: '380 cal',
      proteinCallout: '38g protein',
      ingredients: [
        { name: 'Boneless Skinless Chicken Breasts or Thighs', amount: '1.5 lbs' },
        { name: 'Extra Virgin Olive Oil & Butter', amount: '2 tbsp each' },
        { name: 'Fresh Minced Garlic', amount: '4 cloves' },
        { name: 'Smoked Paprika, Italian Herbs & Onion Powder', amount: '1 tsp each' },
        { name: 'Fresh Lemon Juice', amount: '2 tbsp' },
        { name: 'Kosher Salt & Fresh Black Pepper', amount: 'To taste' }
      ],
      method: [
        'Pat chicken dry with paper towels and season evenly on all sides with spice rub, salt, and pepper.',
        'Heat olive oil and butter in a heavy skillet over medium-high heat until shimmering.',
        'Add chicken and sear undisturbed for 6-8 minutes per side until golden brown (internal temp 165°F).',
        'Add minced garlic and fresh lemon juice during final 2 minutes, spooning pan juices over chicken.',
        'Rest on a cutting board for 5 minutes before slicing and serving with fresh pan juices.'
      ]
    };
  }

  // 14. Caramel Apple Cake / Fridge Cake / Icebox Cake
  if (t.includes('caramel') || (t.includes('apple') && (t.includes('cake') || t.includes('fridge') || t.includes('icebox')))) {
    return {
      prepTime: '20m',
      cookTime: '0m',
      servings: '12',
      calories: '290 cal',
      proteinCallout: '4g protein',
      ingredients: [
        { name: 'Heavy Whipping Cream', amount: '2 cups' },
        { name: 'Caramel Sauce (store-bought or homemade)', amount: '1/2 cup' },
        { name: 'Apple Pie Spice or Cinnamon', amount: '1 tsp' },
        { name: 'Cinnamon Graham Crackers', amount: '1 box (14 oz)' },
        { name: 'Apple Pie Filling or Apple Butter', amount: '1 cup' },
        { name: 'Crushed Pecans or Walnuts for topping', amount: '1/3 cup' }
      ],
      method: [
        'Beat heavy cream, apple pie spice, and half the caramel sauce in a bowl until stiff peaks form.',
        'Spread a thin layer of whipped cream in a 9x13 dish, then line with a single layer of graham crackers.',
        'Spoon apple filling over crackers, top with more caramel cream, and repeat layers 3 times.',
        'Finish with a generous swirl of whipped cream and drizzle remaining caramel sauce over top.',
        'Refrigerate 6-8 hours until graham crackers soften into a luscious, cake-like texture.'
      ]
    };
  }

  // 15. Crab Rangoon / Wonton Nachos / Dumplings
  if (t.includes('crab') || t.includes('rangoon') || t.includes('wonton') || t.includes('dumpling')) {
    return {
      prepTime: '15m',
      cookTime: '10m',
      servings: '6',
      calories: '280 cal',
      proteinCallout: '12g protein',
      ingredients: [
        { name: 'Real or Imitation Crab Meat (shredded)', amount: '8 oz (225g)' },
        { name: 'Cream Cheese (softened)', amount: '8 oz' },
        { name: 'Green Onions / Scallions (sliced)', amount: '3 stalks' },
        { name: 'Minced Garlic & Worcestershire Sauce', amount: '1 tsp each' },
        { name: 'Wonton Wrappers or Tortilla Chips', amount: '24 sheets' },
        { name: 'Sweet Chili Sauce for dipping', amount: '1/2 cup' }
      ],
      method: [
        'Stir together softened cream cheese, shredded crab, green onions, garlic, and Worcestershire sauce.',
        'Spoon a generous tablespoon into the center of each wonton wrapper, wet edges, and pinch into purses.',
        'Heat 2 inches of oil to 350°F (175°C) and fry wontons in batches for 2-3 minutes until golden brown.',
        'Drain on paper towels, dust with sea salt, and serve hot with sweet chili sauce.'
      ]
    };
  }

  // 16. Cookies / Brownies / Desserts
  if (t.includes('cookie') || t.includes('biscuit') || t.includes('brownie') || t.includes('fudge') || t.includes('cake')) {
    return {
      prepTime: '15m',
      cookTime: '10m',
      servings: '16',
      calories: '180 cal',
      proteinCallout: '3g protein',
      ingredients: [
        { name: 'All-Purpose Flour', amount: '2 1/4 cups' },
        { name: 'Unsalted Butter (softened)', amount: '1 cup (2 sticks)' },
        { name: 'Brown Sugar & Granulated Sugar', amount: '3/4 cup each' },
        { name: 'Semi-Sweet Chocolate Chips', amount: '1 1/2 cups' },
        { name: 'Large Eggs', amount: '2' },
        { name: 'Vanilla Extract, Baking Soda & Salt', amount: '1 tsp each' }
      ],
      method: [
        'Preheat oven to 375°F (190°C) and line baking sheets with parchment paper.',
        'Beat softened butter and sugars with an electric mixer until light and fluffy (2-3 minutes).',
        'Beat in eggs one at a time, followed by pure vanilla extract.',
        'Gradually fold in flour, baking soda, and salt, then stir in chocolate chips.',
        'Drop rounded mounds onto baking sheets and bake 9-11 minutes until edges are golden brown.'
      ]
    };
  }

  // 17. Salad / Bowls / Healthy Greens
  if (t.includes('salad') || t.includes('bowl') || t.includes('slaw') || t.includes('greens')) {
    return {
      prepTime: '12m',
      cookTime: '0m',
      servings: '4',
      calories: '260 cal',
      proteinCallout: '8g protein',
      ingredients: [
        { name: 'Crisp Mixed Salad Greens or Romaine', amount: '6 cups' },
        { name: 'Ripe Hass Avocado (sliced)', amount: '1 large' },
        { name: 'Sweet Cherry Tomatoes (halved)', amount: '1 cup' },
        { name: 'English Cucumber & Red Onion (sliced)', amount: '1 cup total' },
        { name: 'Crumbled Feta or Goat Cheese', amount: '1/2 cup' },
        { name: 'Extra Virgin Olive Oil & Aged Balsamic', amount: '3 tbsp oil, 1 tbsp vinegar' }
      ],
      method: [
        'Wash and spin-dry salad greens so dressing adheres cleanly.',
        'Place greens in a large wooden bowl and top with sliced avocado, cherry tomatoes, cucumbers, and red onion.',
        'Whisk olive oil, balsamic vinegar, salt, and freshly ground pepper in a small jar.',
        'Drizzle vinaigrette over salad right before serving and toss gently.',
        'Garnish with crumbled cheese and toasted seeds for crunch.'
      ]
    };
  }

  // 18. Tiramisu / Chantilly / Parfait / No-Bake Berry Dessert
  if (t.includes('tiramisu') || t.includes('chantilly') || t.includes('parfait') || t.includes('trifle') || (t.includes('berry') && (t.includes('no-bake') || t.includes('no bake') || t.includes('dessert')))) {
    return {
      prepTime: '20m',
      cookTime: '0m',
      servings: '8',
      calories: '380 cal',
      proteinCallout: '6g protein',
      ingredients: [
        { name: 'Crisp Ladyfingers (Savoiardi)', amount: '24-30 cookies' },
        { name: 'Italian Mascarpone Cheese & Cream Cheese', amount: '8 oz mascarpone, 4 oz cream cheese' },
        { name: 'Cold Heavy Whipping Cream', amount: '2 cups' },
        { name: 'Fresh Berries (Raspberries, Blackberries, Blueberries, Strawberries)', amount: '3 cups total' },
        { name: 'Seedless Raspberry Jam & Lemon Juice', amount: '1/4 cup jam, 1 tbsp lemon' },
        { name: 'Powdered Sugar & Pure Vanilla Extract', amount: '1/2 cup sugar, 2 tsp vanilla' }
      ],
      method: [
        'Whisk room-temperature mascarpone, cream cheese, sugar, and vanilla until smooth and creamy.',
        'In a chilled bowl, beat cold heavy cream to stiff peaks, then fold into mascarpone to create chantilly cream.',
        'Simmer raspberry jam, water, and lemon juice to make a quick fruit soaking syrup.',
        'Quickly dip ladyfingers into berry syrup and arrange in an even layer in a serving dish.',
        'Spread half of chantilly cream over ladyfingers, scatter fresh berries, repeat second layer, and chill 6 hours before serving.'
      ]
    };
  }

  // 19. Cheesecake / Pies / Tarts
  if (t.includes('cheesecake') || t.includes('pie') || t.includes('tart')) {
    return {
      prepTime: '20m',
      cookTime: '0m',
      servings: '8',
      calories: '420 cal',
      proteinCallout: '7g protein',
      ingredients: [
        { name: 'Graham Cracker or Biscuit Crumbs', amount: '2 cups' },
        { name: 'Melted Unsalted Butter', amount: '6 tbsp' },
        { name: 'Cream Cheese (softened)', amount: '16 oz (450g)' },
        { name: 'Powdered Sugar & Pure Vanilla Extract', amount: '3/4 cup sugar, 2 tsp vanilla' },
        { name: 'Heavy Whipping Cream', amount: '1 cup' },
        { name: 'Fresh Berries or Fruit Compote', amount: '1 cup' }
      ],
      method: [
        'Combine graham cracker crumbs and melted butter; press into pan and chill 15 minutes.',
        'Beat softened cream cheese and powdered sugar until completely smooth and lump-free.',
        'Whip heavy cream and vanilla to stiff peaks, then gently fold into cream cheese mixture.',
        'Spread filling evenly over chilled crust; smooth top with an offset spatula.',
        'Refrigerate at least 6 hours (or overnight) until firm; top with fresh fruit compote before slicing.'
      ]
    };
  }

  // 20. Cakes / Cupcakes / Sweet Bakery
  if (t.includes('cake') || t.includes('cupcake') || t.includes('brownie') || t.includes('fudge') || t.includes('dessert') || t.includes('sweet') || t.includes('sugar') || t.includes('berry') || t.includes('fruit')) {
    return {
      prepTime: '15m',
      cookTime: '25m',
      servings: '8',
      calories: '340 cal',
      proteinCallout: '5g protein',
      ingredients: [
        { name: 'All-Purpose Baking Flour', amount: '2 cups' },
        { name: 'Granulated Sugar', amount: '1 cup' },
        { name: 'Unsalted Butter (softened)', amount: '1/2 cup (1 stick)' },
        { name: 'Large Eggs & Whole Milk', amount: '2 eggs, 3/4 cup milk' },
        { name: 'Baking Powder & Pure Vanilla Extract', amount: '2 tsp baking powder, 1 tsp vanilla' },
        { name: 'Fine Sea Salt & Fresh Berries or Chocolate', amount: '1/2 tsp salt, 1 cup add-ins' }
      ],
      method: [
        'Preheat oven to 350°F (175°C) and grease baking pan or line tins with paper liners.',
        'Cream softened butter and sugar together until light, pale, and fluffy (2-3 minutes).',
        'Add eggs one at a time, beating well after each addition, followed by vanilla extract.',
        'Alternate adding dry ingredients and milk in batches, mixing just until combined.',
        'Bake for 25-30 minutes until golden and a toothpick comes out clean; cool before slicing.'
      ]
    };
  }

  // 21. Genuine Gourmet Chef Fallback (Savory)
  // Real culinary ingredients based on authentic kitchen staples (never generic placeholders)
  return {
    prepTime: '10m',
    cookTime: '15m',
    servings: '4',
    calories: '360 cal',
    proteinCallout: '28g protein',
    ingredients: [
      { name: 'Fresh Chicken Breast or Sautéed Protein', amount: '1.5 lbs' },
      { name: 'Extra Virgin Olive Oil & Butter', amount: '2 tbsp' },
      { name: 'Fresh Minced Garlic & Shallots', amount: '4 cloves' },
      { name: 'Smoked Paprika, Italian Herbs & Garlic Blend', amount: '1 tbsp' },
      { name: 'Fresh Parsley & Chives (finely chopped)', amount: '1/4 cup' },
      { name: 'Coarse Sea Salt & Fresh Cracked Pepper', amount: 'To taste' }
    ],
    method: [
      'Prepare and slice all fresh ingredients on a clean cutting board.',
      'Heat olive oil and butter in a large heavy skillet over medium-high heat until hot.',
      'Add minced garlic and shallots; sauté 1 minute until fragrant.',
      'Add main ingredients in a single layer, season generously with herb spice blend, and sear until golden brown.',
      'Finish with fresh chopped parsley, chives, and a squeeze of fresh lemon juice; serve hot.'
    ]
  };
}

// Fetch YouTube oEmbed metadata directly (100% public, reliable, fast)
async function fetchYouTubeOEmbed(url: string): Promise<{ title: string; author: string; thumbnail: string } | null> {
  try {
    const ytIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:shorts\/|watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
    const ytId = ytIdMatch ? ytIdMatch[1] : '';
    const canonicalUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : url;

    // 1. Query YouTube oEmbed
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.title && !isHashOrId(data.title)) {
        return {
          title: data.title,
          author: data.author_name || '',
          thumbnail: data.thumbnail_url || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : '')
        };
      }
    }

    // 2. Jina AI reader fallback
    if (ytId) {
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${canonicalUrl}`);
        if (jinaRes.ok) {
          const text = await jinaRes.text();
          const titleMatch = text.match(/Title:\s*(.+)/i);
          if (titleMatch && titleMatch[1]) {
            const raw = titleMatch[1].trim();
            if (raw && !raw.toLowerCase().includes('youtube') && !isHashOrId(raw)) {
              return {
                title: raw,
                author: '',
                thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
              };
            }
          }
        }
      } catch (e) {}

      return {
        title: '',
        author: '',
        thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
      };
    }
  } catch (e) {}
  return null;
}

// Fetch TikTok oEmbed metadata directly
async function fetchTikTokOEmbed(url: string): Promise<{ title: string; author: string; thumbnail: string } | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.title && !isHashOrId(data.title)) {
        return {
          title: data.title,
          author: data.author_name || '',
          thumbnail: data.thumbnail_url || ''
        };
      }
    }
  } catch (e) {}

  // Parse creator handle if available e.g. @chef_john
  try {
    const userMatch = url.match(/@([a-zA-Z0-9_.-]+)/);
    if (userMatch) {
      const author = userMatch[1].replace(/[-_.]+/g, ' ');
      return {
        title: `${author} Signature Dish`,
        author: userMatch[1],
        thumbnail: ''
      };
    }
  } catch (e) {}

  return null;
}

// Helper to fetch HTML through multi-proxy fallback chain (bypasses Cloudflare & CORS)
async function fetchHtmlWithProxies(url: string): Promise<string | null> {
  const proxies: Array<{ url: string; headers: Record<string, string>; isJson: boolean }> = [
    {
      url: `https://r.jina.ai/${url}`,
      headers: { 'X-Return-Format': 'html' },
      isJson: false
    },
    {
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      headers: {},
      isJson: true
    },
    {
      url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      headers: {},
      isJson: false
    }
  ];

  for (const proxy of proxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(proxy.url, { headers: proxy.headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        if (proxy.isJson) {
          const data = await res.json();
          if (data.contents && data.contents.length > 500) {
            return data.contents;
          }
        } else {
          const text = await res.text();
          if (text && text.length > 500 && !text.includes('45101') && !text.includes('Access Denied')) {
            return text;
          }
        }
      }
    } catch (e) {}
  }

  return null;
}

// Main Recipe Extractor
export async function extractRecipeFromUrl(
  url: string, 
  brandDefaults?: { brandName?: string; socialHandle?: string; ctaUrl?: string; brandLogo?: string; brandLogoSize?: number }
): Promise<RecipeData> {
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const brandName = brandDefaults?.brandName || 'SnapRecipes';
  const socialHandle = brandDefaults?.socialHandle || '@snaprecipes';
  const ctaUrl = brandDefaults?.ctaUrl || 'snaprecipes.xyz';

  // 1. Try local/Vercel serverless extraction API first (Puppeteer + Anti-bot bypass)
  try {
    const srvRes = await fetch('/api/extract-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, brandDefaults })
    });
    if (srvRes.ok) {
      const srvData = await srvRes.json();
      if (srvData.success && srvData.recipe) {
        srvData.recipe.title = cleanRecipeTitle(srvData.recipe.title, cleanUrl).toUpperCase();
        return srvData.recipe;
      }
    }
  } catch (e) {}

  // 2. Video Platform Handling (YouTube / YouTube Shorts)
  const isYouTube = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');
  if (isYouTube) {
    const ytData = await fetchYouTubeOEmbed(cleanUrl);
    const rawTitle = ytData?.title || '';
    const cleanTitle = cleanRecipeTitle(rawTitle, cleanUrl);
    const synth = synthesizeDishRecipe(cleanTitle, cleanUrl);
    const heroImage = ytData?.thumbnail || getFallbackImage(cleanTitle);

    return {
      id: `extracted-${Date.now()}`,
      title: cleanTitle.toUpperCase(),
      shortHook: generateHook(cleanTitle, synth.prepTime, synth.cookTime, synth.ingredients.length),
      taglineBadge: `• ${brandName.toUpperCase()} · SKIP THE LIFE STORY`,
      heroImage,
      prepTime: synth.prepTime,
      cookTime: synth.cookTime,
      servings: synth.servings,
      calories: synth.calories,
      proteinCallout: synth.proteinCallout,
      highlightBadge: `${synth.cookTime || synth.prepTime} · ${synth.servings} SERVINGS`,
      ingredients: synth.ingredients,
      method: synth.method,
      brandName,
      brandSubtitle: 'Save any recipe in one tap.',
      brandPillBadge: 'AD-FREE · NO BLOG RANTS · JUST RECIPES',
      brandLogo: brandDefaults?.brandLogo || DEFAULT_BRAND_LOGO,
      brandLogoSize: brandDefaults?.brandLogoSize || 58,
      ctaButtonText: 'Get the app — free',
      ctaUrl,
      socialHandle,
      perks: [
        { id: 1, title: 'Save from Anywhere', desc: 'Links, photos, TikTok & IG — one tap.' },
        { id: 2, title: 'No Ads, No Rants', desc: 'Just the clean recipe, instantly.' },
        { id: 3, title: 'Quick Extraction', desc: 'Paste a link, get tidy steps.' },
        { id: 4, title: 'Get Started Today!', desc: 'Free to Try,' }
      ],
      sourceUrl: cleanUrl
    };
  }

  // 3. Video Platform Handling (TikTok)
  const isTikTok = cleanUrl.includes('tiktok.com');
  if (isTikTok) {
    const ttData = await fetchTikTokOEmbed(cleanUrl);
    const rawTitle = ttData?.title || '';
    const cleanTitle = cleanRecipeTitle(rawTitle, cleanUrl);
    const synth = synthesizeDishRecipe(cleanTitle, cleanUrl);
    const heroImage = ttData?.thumbnail || getFallbackImage(cleanTitle);

    return {
      id: `extracted-${Date.now()}`,
      title: cleanTitle.toUpperCase(),
      shortHook: generateHook(cleanTitle, synth.prepTime, synth.cookTime, synth.ingredients.length),
      taglineBadge: `• ${brandName.toUpperCase()} · SKIP THE LIFE STORY`,
      heroImage,
      prepTime: synth.prepTime,
      cookTime: synth.cookTime,
      servings: synth.servings,
      calories: synth.calories,
      proteinCallout: synth.proteinCallout,
      highlightBadge: `${synth.cookTime || synth.prepTime} · ${synth.servings} SERVINGS`,
      ingredients: synth.ingredients,
      method: synth.method,
      brandName,
      brandSubtitle: 'Save any recipe in one tap.',
      brandPillBadge: 'AD-FREE · NO BLOG RANTS · JUST RECIPES',
      brandLogo: brandDefaults?.brandLogo || DEFAULT_BRAND_LOGO,
      brandLogoSize: brandDefaults?.brandLogoSize || 58,
      ctaButtonText: 'Get the app — free',
      ctaUrl,
      socialHandle,
      perks: [
        { id: 1, title: 'Save from Anywhere', desc: 'Links, photos, TikTok & IG — one tap.' },
        { id: 2, title: 'No Ads, No Rants', desc: 'Just the clean recipe, instantly.' },
        { id: 3, title: 'Quick Extraction', desc: 'Paste a link, get tidy steps.' },
        { id: 4, title: 'Get Started Today!', desc: 'Free to Try,' }
      ],
      sourceUrl: cleanUrl
    };
  }

  // 4. Web Recipe Extraction via Multi-Proxy HTML Scraper
  try {
    const html = await fetchHtmlWithProxies(cleanUrl);
    
    if (html) {
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
      let recipeObj: any = null;

      for (const scriptContent of jsonLdMatches) {
        try {
          const jsonStr = scriptContent.replace(/<script.*?>|<\/script>/gi, '').trim();
          const parsed = JSON.parse(jsonStr);
          const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);

          const found = list.find((item: any) => {
            if (!item) return false;
            const type = item['@type'];
            if (typeof type === 'string') return type.toLowerCase() === 'recipe';
            if (Array.isArray(type)) return type.some(t => String(t).toLowerCase() === 'recipe');
            return false;
          });

          if (found) {
            recipeObj = found;
            break;
          }
        } catch (e) {}
      }

      if (recipeObj) {
        const rawTitle = recipeObj.name || '';
        const title = cleanRecipeTitle(rawTitle, cleanUrl);
        const prepTime = formatIsoDuration(recipeObj.prepTime) || '10m';
        const cookTime = formatIsoDuration(recipeObj.cookTime) || '15m';
        const servings = parseServings(recipeObj.recipeYield);
        const calories = recipeObj.nutrition?.calories ? `${recipeObj.nutrition.calories} cal` : '≈350 cal';
        const protein = recipeObj.nutrition?.proteinContent ? `${recipeObj.nutrition.proteinContent} protein` : 'High protein';

        let image = '';
        if (typeof recipeObj.image === 'string') {
          image = recipeObj.image;
        } else if (Array.isArray(recipeObj.image) && recipeObj.image.length > 0) {
          image = typeof recipeObj.image[0] === 'string' ? recipeObj.image[0] : recipeObj.image[0]?.url || '';
        } else if (recipeObj.image?.url) {
          image = recipeObj.image.url;
        }

        if (!image) {
          const ogImgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
          if (ogImgMatch) image = ogImgMatch[1];
        }
        if (!image) {
          image = getFallbackImage(title);
        }

        const rawIngredients: string[] = recipeObj.recipeIngredient || [];
        const ingredients = rawIngredients.slice(0, 12).map((raw) => {
          const cleaned = cleanIngredient(raw);
          const parts = cleaned.split('—').length > 1 ? cleaned.split('—') : cleaned.split(' - ');
          if (parts.length > 1) {
            return { name: parts[0].trim(), amount: parts.slice(1).join(' - ').trim() };
          }
          return { name: cleaned, amount: '' };
        });

        let method: string[] = [];
        if (Array.isArray(recipeObj.recipeInstructions)) {
          const rawSteps: string[] = [];
          for (const item of recipeObj.recipeInstructions) {
            if (typeof item === 'string') {
              rawSteps.push(item);
            } else if (item?.text) {
              rawSteps.push(item.text);
            } else if (Array.isArray(item?.itemListElement)) {
              for (const subItem of item.itemListElement) {
                if (typeof subItem === 'string') rawSteps.push(subItem);
                else if (subItem?.text) rawSteps.push(subItem.text);
              }
            }
          }
          method = rawSteps.map((step: string) => {
            return decodeHtmlEntities(step)
              .replace(/^Step\s*\d+:\s*/i, '')
              .replace(/^\d+\.\s*/, '')
              .replace(/Recipe developed by.*/i, '')
              .replace(/Recipe adapted from.*/i, '')
              .trim();
          }).filter((s: string) => s.length > 0).slice(0, 6);
        }

        if (ingredients.length === 0 || method.length === 0) {
          const synth = synthesizeDishRecipe(title, cleanUrl);
          if (ingredients.length === 0) ingredients.push(...synth.ingredients);
          if (method.length === 0) method.push(...synth.method);
        }

        return {
          id: `extracted-${Date.now()}`,
          title: title.toUpperCase(),
          shortHook: generateHook(title, prepTime, cookTime, ingredients.length),
          taglineBadge: `• ${brandName.toUpperCase()} · SKIP THE LIFE STORY`,
          heroImage: image,
          prepTime,
          cookTime,
          servings,
          calories,
          proteinCallout: protein,
          highlightBadge: `${prepTime.toUpperCase()} · ${servings} SERVINGS`,
          ingredients,
          method,
          brandName,
          brandSubtitle: 'Save any recipe in one tap.',
          brandPillBadge: 'AD-FREE · NO BLOG RANTS · JUST RECIPES',
          brandLogo: brandDefaults?.brandLogo || DEFAULT_BRAND_LOGO,
          brandLogoSize: brandDefaults?.brandLogoSize || 58,
          ctaButtonText: 'Get the app — free',
          ctaUrl,
          socialHandle,
          perks: [
            { id: 1, title: 'Save from Anywhere', desc: 'Links, photos, TikTok & IG — one tap.' },
            { id: 2, title: 'No Ads, No Rants', desc: 'Just the clean recipe, instantly.' },
            { id: 3, title: 'Quick Extraction', desc: 'Paste a link, get tidy steps.' },
            { id: 4, title: 'Get Started Today!', desc: 'Free to Try,' }
          ],
          sourceUrl: cleanUrl
        };
      }
    }
  } catch (error) {
    console.warn('Scraper error, falling back to intelligent parsing', error);
  }

  // 5. Intelligent Fallback: Derive clean title from URL and synthesize matching culinary content
  const cleanTitle = cleanRecipeTitle('', cleanUrl);
  const synth = synthesizeDishRecipe(cleanTitle, cleanUrl);
  const heroImage = getFallbackImage(cleanTitle);

  return {
    id: `extracted-${Date.now()}`,
    title: cleanTitle.toUpperCase(),
    shortHook: generateHook(cleanTitle, synth.prepTime, synth.cookTime, synth.ingredients.length),
    taglineBadge: `• ${brandName.toUpperCase()} · SKIP THE LIFE STORY`,
    heroImage,
    prepTime: synth.prepTime,
    cookTime: synth.cookTime,
    servings: synth.servings,
    calories: synth.calories,
    proteinCallout: synth.proteinCallout,
    highlightBadge: `${synth.cookTime || synth.prepTime} · ${synth.servings} SERVINGS`,
    ingredients: synth.ingredients,
    method: synth.method,
    brandName,
    brandSubtitle: 'Save any recipe in one tap.',
    brandPillBadge: 'AD-FREE · NO BLOG RANTS · JUST RECIPES',
    brandLogo: brandDefaults?.brandLogo || DEFAULT_BRAND_LOGO,
    brandLogoSize: brandDefaults?.brandLogoSize || 58,
    ctaButtonText: 'Get the app — free',
    ctaUrl,
    socialHandle,
    perks: [
      { id: 1, title: 'Save from Anywhere', desc: 'Links, photos, TikTok & IG — one tap.' },
      { id: 2, title: 'No Ads, No Rants', desc: 'Just the clean recipe, instantly.' },
      { id: 3, title: 'Quick Extraction', desc: 'Paste a link, get tidy steps.' },
      { id: 4, title: 'Get Started Today!', desc: 'Free to Try,' }
    ],
    sourceUrl: cleanUrl
  };
}
