const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SONNET = 'claude-sonnet-4-6';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, rightBase64, leftBase64 } = req.body;
    const isSingle = !!imageBase64;

    if (isSingle) {
      const response = await client.messages.create({
        model: SONNET,
        max_tokens: 150,
        system: `You are a strict hand image classifier. Is this image a valid palm photo?
A valid palm image MUST show the INNER/FRONT surface of a hand with visible palm creases/lines.
NOT valid: back of hand (knuckles, nails), blurry, no hand present.
Respond ONLY with this exact JSON (no other text, no markdown):
{"isValidPalm": true, "issue": null, "message": null}
- isValidPalm: false if back of hand, no hand, or no palm lines visible
- issue: "back_of_hand" | "no_hand" | "unclear_image" | null
- message: null if valid; e.g. "This looks like the back of your hand. Please flip it to show your palm."`,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: 'Is this a valid palm photo?' },
          ],
        }],
      });
      const text = response.content[0].text;
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const clean = fence ? fence[1].trim() : text;
      const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
      return res.json(JSON.parse(clean.slice(start, end + 1)));

    } else {
      const response = await client.messages.create({
        model: SONNET,
        max_tokens: 300,
        system: `You are validating two palm photos for a palm reading app.
Task 1: Validate each image is a real palm (inner side with visible palm lines).
Task 2: Determine if both images show the SAME hand or TWO DIFFERENT hands by comparing palm line patterns, moles, scars, rings, and overall hand shape.
Respond with ONLY a JSON object, no explanation, no markdown:
{"image1":{"isValidPalm":true,"issue":null,"message":null},"image2":{"isValidPalm":true,"issue":null,"message":null},"sameHand":false,"confidence":"high"}
- sameHand: true only if palm line patterns are near-identical (same hand photographed twice)
- confidence: "high" | "medium" | "low"`,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Image 1 (first palm):' },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: rightBase64 } },
            { type: 'text', text: 'Image 2 (second palm):' },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: leftBase64 } },
            { type: 'text', text: 'Are both valid palms? Same hand or different hands? Return ONLY the JSON.' },
          ],
        }],
      });
      let text = response.content[0].text;
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fence) text = fence[1].trim();
      const start = text.indexOf('{'); const end = text.lastIndexOf('}');
      return res.json(JSON.parse(text.slice(start, end + 1)));
    }
  } catch (e) {
    console.error('validatePalms error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
