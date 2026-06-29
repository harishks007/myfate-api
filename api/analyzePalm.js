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
    const { imageBase64, language = 'en', birthDetails } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    const langPrefix = language !== 'en'
      ? `CRITICAL LANGUAGE REQUIREMENT: You MUST write ALL text values in ${LANGUAGE_NAMES[language] || 'English'}. Only JSON keys remain in English.\n\n`
      : '';

    const response = await client.messages.create({
      model: SONNET,
      max_tokens: 4000,
      system: `${langPrefix}You are an expert palmist. Analyze the palm image and provide a detailed reading.
${buildBirthContext(birthDetails)}
Respond with ONLY a valid JSON object (no markdown):
{"imageValidation":{"isValidPalm":true,"issue":null,"message":null},"handType":"left","dominantHand":"right","overallReading":"2-3 sentence summary","personality":"personality traits","lines":{"lifeLine":{"found":true,"strength":"strong","reading":"reading"},"heartLine":{"found":true,"strength":"moderate","reading":"reading"},"headLine":{"found":true,"strength":"strong","reading":"reading"},"fateLine":{"found":true,"strength":"faint","reading":"reading"}},"mounts":{"venus":"reading","jupiter":"reading","saturn":"reading","apollo":"reading","mercury":"reading"},"specialSigns":"any special signs","luckyNumbers":[3,7,12],"predictions":{"love":"prediction","career":"prediction","health":"prediction","future":"prediction"}}`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: 'Please analyze this palm image and provide a complete palmistry reading.' },
        ],
      }],
    });

    let text = response.content[0].text;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
    return res.json(JSON.parse(text.slice(start, end + 1)));
  } catch (e) {
    console.error('analyzePalm error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
