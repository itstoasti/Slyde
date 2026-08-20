import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 2400, deviceScaleFactor: 3 });

  await page.goto('http://localhost:3000/render.html', { waitUntil: 'networkidle0' });

  // Test with Lemon Lush (7 ingredients, 6 steps)
  const lemonLush = {
    id: 'lemon-lush-test',
    title: 'LEMON LUSH',
    shortHook: 'Layers of zesty lemon pudding, cream cheese, and whipped topping over a buttery crust.',
    taglineBadge: '• SNAPRECIPES · SKIP THE LIFE STORY',
    heroImage: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1200&q=85',
    prepTime: '15m',
    cookTime: '25m',
    servings: '12',
    calories: '320 cal',
    brandName: 'SnapRecipes',
    brandSubtitle: 'Save any recipe in one tap.',
    brandPillBadge: 'AD-FREE · NO BLOG RANTS · JUST RECIPES',
    ctaButtonText: 'Get the app — free',
    ctaUrl: 'snaprecipes.xyz',
    socialHandle: '@snaprecipes',
    ingredients: [
      { name: 'All-purpose flour', amount: '2 cups' },
      { name: 'Butter, softened', amount: '1 cup' },
      { name: 'Cream cheese', amount: '2 (8 oz) pkg' },
      { name: 'White sugar', amount: '1 cup' },
      { name: 'Milk', amount: '3 1/2 cups' },
      { name: 'Instant lemon pudding mix', amount: '2 (3.4 oz) pkg' },
      { name: 'Frozen whipped topping, thawed', amount: '1 (12 oz) container' }
    ],
    method: [
      'Preheat oven to 350 degrees F (175 degrees C).',
      'Combine flour and butter in a bowl; press into the bottom of a 9x13-inch baking dish.',
      'Bake in preheated oven until golden brown, about 15 to 20 minutes; cool completely.',
      'Beat cream cheese and sugar until smooth; fold in 1 cup whipped topping and spread over crust.',
      'Whisk pudding mix and milk together for 2 minutes; spread over cream cheese layer.',
      'Top with remaining whipped topping and refrigerate for at least 2 hours before serving.'
    ],
    perks: [
      { id: 1, title: 'Save from Anywhere', desc: 'Links, photos, TikTok & IG — one tap.' },
      { id: 2, title: 'No Ads, No Rants', desc: 'Just the clean recipe, instantly.' },
      { id: 3, title: 'Quick Extraction', desc: 'Paste a link, get tidy steps.' },
      { id: 4, title: 'Get Started Today!', desc: 'Free to try.' }
    ]
  };

  await page.evaluate((r) => {
    window.__setRecipe(r);
  }, lemonLush);

  await new Promise(r => setTimeout(r, 800));

  const slide2 = await page.$('#slide-2');
  const buf2 = await slide2.screenshot({ type: 'png' });
  console.log('Slide 2 Lemon Lush PNG size:', buf2.length);

  // Check how many step items are rendered inside #slide-2
  const stepCount = await page.evaluate(() => {
    return document.querySelectorAll('#slide-2 .method-step-item').length;
  });
  console.log('Slide 2 rendered step count:', stepCount);

  // Check text color of step-text
  const stepColor = await page.evaluate(() => {
    const el = document.querySelector('#slide-2 .step-text');
    return el ? window.getComputedStyle(el).color : 'not found';
  });
  console.log('Slide 2 step text color:', stepColor);

  await browser.close();
})();
