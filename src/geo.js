export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This device does not support location.'))
    navigator.geolocation.getCurrentPosition(resolve, (e) =>
      reject(new Error(e.code === 1
        ? 'Location is blocked. Allow location for this site in your browser settings, then try again.'
        : 'Could not get your location. Move near a window and try again.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  })
}

// at_office: inside the radius. unverified: outside, but GPS too weak to be sure. away: outside with a good signal.
export function classify(distance, accuracy, radius) {
  if (distance <= radius) return 'at_office'
  return accuracy > 150 ? 'unverified' : 'away'
}

export const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`
export const STATUS_LABEL = { at_office: 'At office', away: 'Away', unverified: "Couldn't verify" }
