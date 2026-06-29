// Country name to ISO code mapping for strict validation
const COUNTRY_CODES = {
  'afghanistan': 'af', 'albania': 'al', 'algeria': 'dz', 'argentina': 'ar', 'australia': 'au',
  'austria': 'at', 'bangladesh': 'bd', 'belgium': 'be', 'brazil': 'br', 'bulgaria': 'bg',
  'canada': 'ca', 'chile': 'cl', 'china': 'cn', 'colombia': 'co', 'croatia': 'hr',
  'czech republic': 'cz', 'denmark': 'dk', 'egypt': 'eg', 'ethiopia': 'et', 'finland': 'fi',
  'france': 'fr', 'germany': 'de', 'ghana': 'gh', 'greece': 'gr', 'hungary': 'hu',
  'india': 'in', 'indonesia': 'id', 'iran': 'ir', 'iraq': 'iq', 'ireland': 'ie',
  'israel': 'il', 'italy': 'it', 'japan': 'jp', 'jordan': 'jo', 'kenya': 'ke',
  'malaysia': 'my', 'mexico': 'mx', 'morocco': 'ma', 'myanmar': 'mm', 'nepal': 'np',
  'netherlands': 'nl', 'new zealand': 'nz', 'nigeria': 'ng', 'norway': 'no', 'pakistan': 'pk',
  'peru': 'pe', 'philippines': 'ph', 'poland': 'pl', 'portugal': 'pt', 'romania': 'ro',
  'russia': 'ru', 'saudi arabia': 'sa', 'singapore': 'sg', 'south africa': 'za',
  'south korea': 'kr', 'spain': 'es', 'sri lanka': 'lk', 'sweden': 'se', 'switzerland': 'ch',
  'taiwan': 'tw', 'tanzania': 'tz', 'thailand': 'th', 'turkey': 'tr', 'ukraine': 'ua',
  'united arab emirates': 'ae', 'uae': 'ae', 'united kingdom': 'gb', 'uk': 'gb',
  'england': 'gb', 'scotland': 'gb', 'wales': 'gb',
  'united states': 'us', 'usa': 'us', 'us': 'us', 'america': 'us',
  'venezuela': 've', 'vietnam': 'vn', 'zimbabwe': 'zw',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { location } = req.body;
  if (!location) return res.status(400).json({ valid: false, message: 'Location is required.' });

  const parts = location.split(',').map(p => p.trim());
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return res.json({ valid: false, message: 'Please enter both city and country (e.g. Mumbai, India).' });
  }

  const city = parts[0];
  const countryInput = parts[1].toLowerCase();

  // Step 1 — Validate country against known list
  const countryCode = COUNTRY_CODES[countryInput];
  if (!countryCode) {
    return res.json({ valid: false, message: `"${parts[1]}" is not a recognised country. Please check the spelling.` });
  }

  // Step 2 — Validate city exists in that country using Nominatim
  try {
    const encoded = encodeURIComponent(city);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&countrycodes=${countryCode}&format=json&limit=1&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MyFateApp/1.0 (harishks007@gmail.com)' },
    });
    const data = await response.json();

    if (!data || data.length === 0) {
      return res.json({ valid: false, message: `"${city}" was not found in ${parts[1]}. Please check the city name.` });
    }

    const address = data[0].address || {};
    const foundCity = address.city || address.town || address.village || address.county || city;
    const foundCountry = address.country || parts[1];
    const suggestion = `${foundCity}, ${foundCountry}`;

    return res.json({ valid: true, suggestion });
  } catch (e) {
    console.error('validateLocation error:', e.message);
    return res.json({ valid: true, suggestion: location });
  }
};
