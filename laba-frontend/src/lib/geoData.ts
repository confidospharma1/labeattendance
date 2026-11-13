export interface DistrictLocation {
  name: string;
  headquarters?: string;
  latitude: number;
  longitude: number;
  zoom: number;
}

export const AP_DISTRICTS: DistrictLocation[] = [
  { name: 'Kurnool', headquarters: 'Kurnool', latitude: 15.8281, longitude: 78.0373, zoom: 14 },
  { name: 'Nandyal', headquarters: 'Nandyal', latitude: 15.4788, longitude: 78.4836, zoom: 14 },
  { name: 'YSR Kadapa', headquarters: 'Kadapa', latitude: 14.4673, longitude: 78.8242, zoom: 14 },
  { name: 'Kadapa', headquarters: 'Kadapa', latitude: 14.4673, longitude: 78.8242, zoom: 14 },
  { name: 'Annamayya', headquarters: 'Rayachoty', latitude: 14.056, longitude: 78.752, zoom: 14 },
  { name: 'Tirupati', headquarters: 'Tirupati', latitude: 13.6288, longitude: 79.4192, zoom: 14 },
  { name: 'Chittoor', headquarters: 'Chittoor', latitude: 13.2172, longitude: 79.1003, zoom: 14 },
  { name: 'SPSR Nellore', headquarters: 'Nellore', latitude: 14.4426, longitude: 79.9865, zoom: 14 },
  { name: 'Nellore', headquarters: 'Nellore', latitude: 14.4426, longitude: 79.9865, zoom: 14 },
  { name: 'Prakasam', headquarters: 'Ongole', latitude: 15.5057, longitude: 80.0499, zoom: 14 },
  { name: 'Ongole', headquarters: 'Ongole', latitude: 15.5057, longitude: 80.0499, zoom: 14 },
  { name: 'Bapatla', headquarters: 'Bapatla', latitude: 15.9042, longitude: 80.4673, zoom: 14 },
  { name: 'Palnadu', headquarters: 'Narasaraopet', latitude: 16.2359, longitude: 80.0499, zoom: 14 },
  { name: 'Narasaraopet', headquarters: 'Narasaraopet', latitude: 16.2359, longitude: 80.0499, zoom: 14 },
  { name: 'Guntur', headquarters: 'Guntur', latitude: 16.3067, longitude: 80.4365, zoom: 14 },
  { name: 'NTR', headquarters: 'Vijayawada', latitude: 16.5062, longitude: 80.648, zoom: 14 },
  { name: 'Vijayawada', headquarters: 'Vijayawada', latitude: 16.5062, longitude: 80.648, zoom: 14 },
  { name: 'Krishna', headquarters: 'Machilipatnam', latitude: 16.1875, longitude: 81.1389, zoom: 14 },
  { name: 'Machilipatnam', headquarters: 'Machilipatnam', latitude: 16.1875, longitude: 81.1389, zoom: 14 },
  { name: 'Eluru', headquarters: 'Eluru', latitude: 16.7107, longitude: 81.0952, zoom: 14 },
  { name: 'West Godavari', headquarters: 'Bhimavaram', latitude: 16.5449, longitude: 81.5212, zoom: 14 },
  { name: 'Bhimavaram', headquarters: 'Bhimavaram', latitude: 16.5449, longitude: 81.5212, zoom: 14 },
  { name: 'East Godavari', headquarters: 'Rajahmundry', latitude: 17.0005, longitude: 81.804, zoom: 14 },
  { name: 'Rajahmundry', headquarters: 'Rajahmundry', latitude: 17.0005, longitude: 81.804, zoom: 14 },
  { name: 'Kakinada', headquarters: 'Kakinada', latitude: 16.9891, longitude: 82.2475, zoom: 14 },
  { name: 'Dr. B.R. Ambedkar Konaseema', headquarters: 'Amalapuram', latitude: 16.5787, longitude: 82.0061, zoom: 14 },
  { name: 'Amalapuram', headquarters: 'Amalapuram', latitude: 16.5787, longitude: 82.0061, zoom: 14 },
  { name: 'Anakapalli', headquarters: 'Anakapalli', latitude: 17.6913, longitude: 83.0039, zoom: 14 },
  { name: 'Visakhapatnam', headquarters: 'Visakhapatnam', latitude: 17.6868, longitude: 83.2185, zoom: 14 },
  { name: 'Vizag', headquarters: 'Visakhapatnam', latitude: 17.6868, longitude: 83.2185, zoom: 14 },
  { name: 'Vizianagaram', headquarters: 'Vizianagaram', latitude: 18.1067, longitude: 83.3956, zoom: 14 },
  { name: 'Parvathipuram Manyam', headquarters: 'Parvathipuram', latitude: 18.7797, longitude: 83.4283, zoom: 14 },
  { name: 'Alluri Sitharama Raju', headquarters: 'Paderu', latitude: 18.0833, longitude: 82.6667, zoom: 14 },
  { name: 'Srikakulam', headquarters: 'Srikakulam', latitude: 18.2949, longitude: 83.8938, zoom: 14 },
  { name: 'Anantapur', headquarters: 'Anantapur', latitude: 14.6819, longitude: 77.6006, zoom: 14 },
  { name: 'Sri Sathya Sai', headquarters: 'Puttaparthi', latitude: 14.1652, longitude: 77.8105, zoom: 14 },
  { name: 'Puttaparthi', headquarters: 'Puttaparthi', latitude: 14.1652, longitude: 77.8105, zoom: 14 },
  { name: 'Proddatur', headquarters: 'Proddatur', latitude: 14.7505, longitude: 78.5524, zoom: 14 },
  { name: 'Adoni', headquarters: 'Adoni', latitude: 15.6322, longitude: 77.2728, zoom: 14 },
  { name: 'Dhone', headquarters: 'Dhone', latitude: 15.4214, longitude: 77.8732, zoom: 14 },
  { name: 'Madanapalle', headquarters: 'Madanapalle', latitude: 13.556, longitude: 78.501, zoom: 14 },
  { name: 'Hindupur', headquarters: 'Hindupur', latitude: 13.8284, longitude: 77.4919, zoom: 14 },
  { name: 'Gudur', headquarters: 'Gudur', latitude: 14.1481, longitude: 79.8517, zoom: 14 },
  { name: 'Kavali', headquarters: 'Kavali', latitude: 14.9132, longitude: 79.9926, zoom: 14 },
  { name: 'Tenali', headquarters: 'Tenali', latitude: 16.243, longitude: 80.6406, zoom: 14 },
  { name: 'Mangalagiri', headquarters: 'Mangalagiri', latitude: 16.4342, longitude: 80.5675, zoom: 14 },
  { name: 'Chirala', headquarters: 'Chirala', latitude: 15.8239, longitude: 80.352, zoom: 14 },
];

/**
 * Searches for a matching Andhra Pradesh district or city by name or prefix.
 */
export function findAndhraCoordinates(query: string): DistrictLocation | null {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim().toLowerCase();
  if (clean.length < 2) return null;

  // Exact match
  const exact = AP_DISTRICTS.find(
    (d) => d.name.toLowerCase() === clean || d.headquarters?.toLowerCase() === clean
  );
  if (exact) return exact;

  // Starts with match
  const startsWith = AP_DISTRICTS.find(
    (d) =>
      d.name.toLowerCase().startsWith(clean) ||
      (d.headquarters && d.headquarters.toLowerCase().startsWith(clean))
  );
  if (startsWith) return startsWith;

  // Contains match
  const contains = AP_DISTRICTS.find(
    (d) =>
      d.name.toLowerCase().includes(clean) ||
      (d.headquarters && d.headquarters.toLowerCase().includes(clean))
  );
  return contains || null;
}

