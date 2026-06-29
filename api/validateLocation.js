module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { location } = req.body;
  if (!location) return res.status(400).json({ valid: false, message: 'Location is required.' });

  try {
    const encoded = encodeURIComponent(location);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'MyFateApp/1.0 (harishks007@gmail.com)' },
    });
    const data = await response.json();

    if (!data || data.length === 0) {
      return res.json({ valid: false, message: 'Location not found. Please check the city and country name.' });
    }

    const result = data[0];
    const address = result.address || {};
    const displayName = result.display_name || location;

    // Extract clean city and country for confirmation
    const city = address.city || address.town || address.village || address.county || '';
    const country = address.country || '';
    const suggestion = city && country ? `${city}, ${country}` : displayName.split(',').slice(0, 2).join(',').trim();

    return res.json({ valid: true, suggestion });
  } catch (e) {
    console.error('validateLocation error:', e.message);
    // If validation service is down, allow through
    return res.json({ valid: true, suggestion: location });
  }
};
