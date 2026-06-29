const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SONNET = 'claude-sonnet-4-6';

const LANGUAGE_NAMES = {
  hi: 'Hindi', es: 'Spanish', fr: 'French', de: 'German',
  zh: 'Chinese', ja: 'Japanese', ar: 'Arabic', pt: 'Portuguese',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { rightBase64, leftBase64, language = 'en', birthDetails } = req.body;
    if (!rightBase64 || !leftBase64) return res.status(400).json({ error: 'rightBase64 and leftBase64 are required' });

    const langPrefix = language !== 'en'
      ? `CRITICAL LANGUAGE REQUIREMENT: You MUST write ALL text values in ${LANGUAGE_NAMES[language] || 'English'}. Only JSON keys remain in English.\n\n`
      : '';

    const palmImages = [
      { type: 'text', text: 'First palm photo:' },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: rightBase64 } },
      { type: 'text', text: 'Second palm photo:' },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: leftBase64 } },
    ];

    // Call 1 — Palm reading only (no astrology)
    const palmPromise = client.messages.create({
      model: SONNET,
      max_tokens: 4000,
      system: `${langPrefix}You are an expert palmist. Analyze BOTH palms together and give a unified combined reading.
Respond with ONLY valid JSON (no markdown, no extra text):
{"imageValidation":{"rightPalm":{"isValidPalm":true,"issue":null,"message":null},"leftPalm":{"isValidPalm":true,"issue":null,"message":null}},"handType":"both","dominantHand":"right","overallReading":"3-4 sentence combined summary","personality":"personality traits from both palms","dualPalmInsight":"2-3 sentence insight comparing both palms","lines":{"lifeLine":{"found":true,"strength":"strong","reading":"compare both hands"},"heartLine":{"found":true,"strength":"moderate","reading":"compare both hands"},"headLine":{"found":true,"strength":"strong","reading":"compare both hands"},"fateLine":{"found":true,"strength":"faint","reading":"compare both hands"}},"mounts":{"venus":"reading","jupiter":"reading","saturn":"reading","apollo":"reading","mercury":"reading"},"specialSigns":"any special signs or null","luckyNumbers":[3,7,12],"luckyColors":["Gold","Purple"],"predictions":{"love":{"title":"Love & Relationships","prediction":"2 sentence prediction","timeframe":"1-2 years"},"career":{"title":"Career & Finances","prediction":"2 sentence prediction","timeframe":"1-2 years"},"health":{"title":"Health & Vitality","prediction":"2 sentence prediction","timeframe":"1-2 years"},"spiritual":{"title":"Spiritual Growth","prediction":"2 sentence prediction","timeframe":"ongoing"}},"warning":null}`,
      messages: [{ role: 'user', content: [...palmImages, { type: 'text', text: 'Analyze both palms and return ONLY the JSON.' }] }],
    });

    // Call 2 — Astrology (only if birth details provided)
    const hasBirth = birthDetails && birthDetails.dob;
    const astroPromise = hasBirth ? client.messages.create({
      model: SONNET,
      max_tokens: 1500,
      system: `${langPrefix}You are a Vedic and Western astrology expert. Given birth details, provide an astrological reading.
Respond with ONLY valid JSON (no markdown, no extra text):
{"sunSign":"zodiac sign","moonSign":"moon sign","risingSign":"rising sign or null","planetaryInfluences":"2 sentence description","astrologyReading":"3 sentence personalised reading","yearPrediction":"2 sentence prediction for this year","compatibility":"best zodiac matches for love","luckyDay":"luckiest day of week","remedy":"one Vedic remedy (mantra, gemstone, or ritual)"}`,
      messages: [{ role: 'user', content: `Date of Birth: ${birthDetails.dob}${birthDetails.birthPlace ? `\nPlace of Birth: ${birthDetails.birthPlace}` : ''}${birthDetails.birthTime ? `\nTime of Birth: ${birthDetails.birthTime}` : ''}\n\nProvide the astrological reading as JSON.` }],
    }) : Promise.resolve(null);

    // Run both in parallel
    const [palmResponse, astroResponse] = await Promise.all([palmPromise, astroPromise]);

    // Parse palm reading
    let palmText = palmResponse.content[0].text;
    const palmFence = palmText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (palmFence) palmText = palmFence[1].trim();
    const ps = palmText.indexOf('{'); const pe = palmText.lastIndexOf('}');
    const palmResult = JSON.parse(palmText.slice(ps, pe + 1));

    // Parse astrology if present
    if (astroResponse) {
      let astroText = astroResponse.content[0].text;
      const astroFence = astroText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (astroFence) astroText = astroFence[1].trim();
      const as = astroText.indexOf('{'); const ae = astroText.lastIndexOf('}');
      try {
        palmResult.astrology = JSON.parse(astroText.slice(as, ae + 1));
      } catch (e) {
        console.error('Astrology parse error:', e.message);
      }
    }

    return res.json(palmResult);
  } catch (e) {
    console.error('analyzeBothPalms error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
