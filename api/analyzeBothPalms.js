const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SONNET = 'claude-sonnet-4-6';

const LANGUAGE_NAMES = {
  hi: 'Hindi', es: 'Spanish', fr: 'French', de: 'German',
  zh: 'Chinese', ja: 'Japanese', ar: 'Arabic', pt: 'Portuguese',
};

function buildBirthContext(birthDetails) {
  if (!birthDetails || !birthDetails.dob) return '';
  const parts = [`Date of Birth: ${birthDetails.dob}`];
  if (birthDetails.birthPlace) parts.push(`Place of Birth: ${birthDetails.birthPlace}`);
  if (birthDetails.birthTime) parts.push(`Time of Birth: ${birthDetails.birthTime}`);
  return `\n\nASTROLOGY CONTEXT — Include an "astrology" field in your JSON response:\n${parts.join('\n')}\n"astrology": { "sunSign": "zodiac sign", "moonSign": "moon sign", "risingSign": "rising sign or null", "planetaryInfluences": "2-sentence description", "astrologyReading": "3-4 sentence personalised reading", "yearPrediction": "2-3 sentence prediction for this year", "compatibility": "best zodiac matches", "luckyDay": "luckiest day of week", "remedy": "one Vedic remedy" }`;
}

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

    const response = await client.messages.create({
      model: SONNET,
      max_tokens: 6000,
      system: `${langPrefix}You are an expert palmist. Analyze BOTH palms together and give a unified combined reading comparing both hands.
${buildBirthContext(birthDetails)}
Respond with ONLY a valid JSON object (no markdown):
{"imageValidation":{"rightPalm":{"isValidPalm":true,"issue":null,"message":null},"leftPalm":{"isValidPalm":true,"issue":null,"message":null}},"handType":"both","dominantHand":"right","overallReading":"3-4 sentence combined summary","personality":"personality traits combining both hands","dualPalmInsight":"2-3 sentence insight comparing both palms","lines":{"lifeLine":{"found":true,"strength":"strong","reading":"compare both hands"},"heartLine":{"found":true,"strength":"moderate","reading":"compare both hands"},"headLine":{"found":true,"strength":"strong","reading":"compare both hands"},"fateLine":{"found":true,"strength":"faint","reading":"compare both hands"}},"mounts":{"venus":"reading","jupiter":"reading","saturn":"reading","apollo":"reading","mercury":"reading"},"specialSigns":"any special signs","luckyNumbers":[3,7,12],"luckyColors":["Gold","Purple"],"predictions":{"love":{"title":"Love & Relationships","prediction":"prediction","timeframe":"timeframe"},"career":{"title":"Career & Finances","prediction":"prediction","timeframe":"timeframe"},"health":{"title":"Health & Vitality","prediction":"prediction","timeframe":"timeframe"},"spiritual":{"title":"Spiritual Growth","prediction":"prediction","timeframe":"timeframe"}},"warning":null}`,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'First palm photo:' },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: rightBase64 } },
          { type: 'text', text: 'Second palm photo:' },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: leftBase64 } },
          { type: 'text', text: 'Please analyze both palms together and provide a comprehensive dual palm reading.' },
        ],
      }],
    });

    let text = response.content[0].text;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
    return res.json(JSON.parse(text.slice(start, end + 1)));
  } catch (e) {
    console.error('analyzeBothPalms error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
