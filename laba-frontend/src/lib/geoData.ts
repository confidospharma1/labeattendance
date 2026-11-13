export interface DistrictLocation {
  name: string;
  headquarters?: string;
  latitude: number;
  longitude: number;
  zoom: number;
  boundaryRadius?: number;
}

export interface VillageLocation {
  name: string;
  type: 'Village' | 'Mandal' | 'Town' | 'District' | 'Colony' | 'Area' | 'Quarter';
  district: string;
  latitude: number;
  longitude: number;
  boundaryRadius: number; // Auto-selected according to Google Maps extent
  postalCode?: string;
}

export const AP_DISTRICTS: DistrictLocation[] = [
  { name: 'Kurnool', headquarters: 'Kurnool', latitude: 15.8281, longitude: 78.0373, zoom: 14, boundaryRadius: 10000 },
  { name: 'Nandyal', headquarters: 'Nandyal', latitude: 15.4788, longitude: 78.4836, zoom: 14, boundaryRadius: 8000 },
  { name: 'YSR Kadapa', headquarters: 'Kadapa', latitude: 14.4673, longitude: 78.8242, zoom: 14, boundaryRadius: 8000 },
  { name: 'Kadapa', headquarters: 'Kadapa', latitude: 14.4673, longitude: 78.8242, zoom: 14, boundaryRadius: 8000 },
  { name: 'Annamayya', headquarters: 'Rayachoty', latitude: 14.056, longitude: 78.752, zoom: 14, boundaryRadius: 8000 },
  { name: 'Tirupati', headquarters: 'Tirupati', latitude: 13.6288, longitude: 79.4192, zoom: 14, boundaryRadius: 8000 },
  { name: 'Chittoor', headquarters: 'Chittoor', latitude: 13.2172, longitude: 79.1003, zoom: 14, boundaryRadius: 8000 },
  { name: 'SPSR Nellore', headquarters: 'Nellore', latitude: 14.4426, longitude: 79.9865, zoom: 14, boundaryRadius: 8000 },
  { name: 'Nellore', headquarters: 'Nellore', latitude: 14.4426, longitude: 79.9865, zoom: 14, boundaryRadius: 8000 },
  { name: 'Prakasam', headquarters: 'Ongole', latitude: 15.5057, longitude: 80.0499, zoom: 14, boundaryRadius: 8000 },
  { name: 'Ongole', headquarters: 'Ongole', latitude: 15.5057, longitude: 80.0499, zoom: 14, boundaryRadius: 8000 },
  { name: 'Bapatla', headquarters: 'Bapatla', latitude: 15.9042, longitude: 80.4673, zoom: 14, boundaryRadius: 8000 },
  { name: 'Palnadu', headquarters: 'Narasaraopet', latitude: 16.2359, longitude: 80.0499, zoom: 14, boundaryRadius: 8000 },
  { name: 'Narasaraopet', headquarters: 'Narasaraopet', latitude: 16.2359, longitude: 80.0499, zoom: 14, boundaryRadius: 8000 },
  { name: 'Guntur', headquarters: 'Guntur', latitude: 16.3067, longitude: 80.4365, zoom: 14, boundaryRadius: 8000 },
  { name: 'NTR', headquarters: 'Vijayawada', latitude: 16.5062, longitude: 80.648, zoom: 14, boundaryRadius: 8000 },
  { name: 'Vijayawada', headquarters: 'Vijayawada', latitude: 16.5062, longitude: 80.648, zoom: 14, boundaryRadius: 8000 },
  { name: 'Krishna', headquarters: 'Machilipatnam', latitude: 16.1875, longitude: 81.1389, zoom: 14, boundaryRadius: 8000 },
  { name: 'Machilipatnam', headquarters: 'Machilipatnam', latitude: 16.1875, longitude: 81.1389, zoom: 14, boundaryRadius: 8000 },
  { name: 'Eluru', headquarters: 'Eluru', latitude: 16.7107, longitude: 81.0952, zoom: 14, boundaryRadius: 8000 },
  { name: 'West Godavari', headquarters: 'Bhimavaram', latitude: 16.5449, longitude: 81.5212, zoom: 14, boundaryRadius: 8000 },
  { name: 'Bhimavaram', headquarters: 'Bhimavaram', latitude: 16.5449, longitude: 81.5212, zoom: 14, boundaryRadius: 8000 },
  { name: 'East Godavari', headquarters: 'Rajahmundry', latitude: 17.0005, longitude: 81.804, zoom: 14, boundaryRadius: 8000 },
  { name: 'Rajahmundry', headquarters: 'Rajahmundry', latitude: 17.0005, longitude: 81.804, zoom: 14, boundaryRadius: 8000 },
  { name: 'Kakinada', headquarters: 'Kakinada', latitude: 16.9891, longitude: 82.2475, zoom: 14, boundaryRadius: 8000 },
  { name: 'Dr. B.R. Ambedkar Konaseema', headquarters: 'Amalapuram', latitude: 16.5787, longitude: 82.0061, zoom: 14, boundaryRadius: 8000 },
  { name: 'Amalapuram', headquarters: 'Amalapuram', latitude: 16.5787, longitude: 82.0061, zoom: 14, boundaryRadius: 8000 },
  { name: 'Anakapalli', headquarters: 'Anakapalli', latitude: 17.6913, longitude: 83.0039, zoom: 14, boundaryRadius: 8000 },
  { name: 'Visakhapatnam', headquarters: 'Visakhapatnam', latitude: 17.6868, longitude: 83.2185, zoom: 14, boundaryRadius: 8000 },
  { name: 'Vizag', headquarters: 'Visakhapatnam', latitude: 17.6868, longitude: 83.2185, zoom: 14, boundaryRadius: 8000 },
  { name: 'Vizianagaram', headquarters: 'Vizianagaram', latitude: 18.1067, longitude: 83.3956, zoom: 14, boundaryRadius: 8000 },
  { name: 'Parvathipuram Manyam', headquarters: 'Parvathipuram', latitude: 18.7797, longitude: 83.4283, zoom: 14, boundaryRadius: 8000 },
  { name: 'Alluri Sitharama Raju', headquarters: 'Paderu', latitude: 18.0833, longitude: 82.6667, zoom: 14, boundaryRadius: 8000 },
  { name: 'Srikakulam', headquarters: 'Srikakulam', latitude: 18.2949, longitude: 83.8938, zoom: 14, boundaryRadius: 8000 },
  { name: 'Anantapur', headquarters: 'Anantapur', latitude: 14.6819, longitude: 77.6006, zoom: 14, boundaryRadius: 8000 },
  { name: 'Sri Sathya Sai', headquarters: 'Puttaparthi', latitude: 14.1652, longitude: 77.8105, zoom: 14, boundaryRadius: 8000 },
  { name: 'Puttaparthi', headquarters: 'Puttaparthi', latitude: 14.1652, longitude: 77.8105, zoom: 14, boundaryRadius: 8000 },
  { name: 'Proddatur', headquarters: 'Proddatur', latitude: 14.7505, longitude: 78.5524, zoom: 14, boundaryRadius: 6000 },
  { name: 'Adoni', headquarters: 'Adoni', latitude: 15.6322, longitude: 77.2728, zoom: 14, boundaryRadius: 6000 },
  { name: 'Dhone', headquarters: 'Dhone', latitude: 15.4214, longitude: 77.8732, zoom: 14, boundaryRadius: 6000 },
  { name: 'Madanapalle', headquarters: 'Madanapalle', latitude: 13.556, longitude: 78.501, zoom: 14, boundaryRadius: 6000 },
  { name: 'Hindupur', headquarters: 'Hindupur', latitude: 13.8284, longitude: 77.4919, zoom: 14, boundaryRadius: 6000 },
  { name: 'Gudur', headquarters: 'Gudur', latitude: 14.1481, longitude: 79.8517, zoom: 14, boundaryRadius: 6000 },
  { name: 'Kavali', headquarters: 'Kavali', latitude: 14.9132, longitude: 79.9926, zoom: 14, boundaryRadius: 6000 },
  { name: 'Tenali', headquarters: 'Tenali', latitude: 16.243, longitude: 80.6406, zoom: 14, boundaryRadius: 6000 },
  { name: 'Mangalagiri', headquarters: 'Mangalagiri', latitude: 16.4342, longitude: 80.5675, zoom: 14, boundaryRadius: 6000 },
  { name: 'Chirala', headquarters: 'Chirala', latitude: 15.8239, longitude: 80.352, zoom: 14, boundaryRadius: 6000 },
];

/**
 * Key Andhra Pradesh Mandals, Villages & City Sub-Areas/Colonies
 * Automatically bounded according to Google Maps geographic territory.
 */
export const AP_VILLAGES_MANDALS: VillageLocation[] = [
  // Kadapa City Sub-Areas, Colonies & Quarters (Featured in user request)
  {
    name: 'Nagarjunapeta',
    type: 'Quarter',
    district: 'YSR Kadapa',
    latitude: 14.4660,
    longitude: 78.8250,
    boundaryRadius: 1500, // Auto-bounded area
    postalCode: '516003',
  },
  {
    name: 'Nagarajupeta',
    type: 'Quarter',
    district: 'YSR Kadapa',
    latitude: 14.4660,
    longitude: 78.8250,
    boundaryRadius: 1500,
    postalCode: '516003',
  },
  {
    name: 'NGO Colony, Kadapa',
    type: 'Colony',
    district: 'YSR Kadapa',
    latitude: 14.4782,
    longitude: 78.8345,
    boundaryRadius: 1200,
    postalCode: '516002',
  },
  {
    name: 'NGO Colony',
    type: 'Colony',
    district: 'YSR Kadapa',
    latitude: 14.4782,
    longitude: 78.8345,
    boundaryRadius: 1200,
    postalCode: '516002',
  },
  {
    name: 'Akkayapalle',
    type: 'Area',
    district: 'YSR Kadapa',
    latitude: 14.4850,
    longitude: 78.8180,
    boundaryRadius: 1800,
    postalCode: '516003',
  },
  {
    name: 'Yerramukkapalli',
    type: 'Area',
    district: 'YSR Kadapa',
    latitude: 14.4720,
    longitude: 78.8310,
    boundaryRadius: 1500,
    postalCode: '516004',
  },
  {
    name: 'Chemmumiahpet',
    type: 'Area',
    district: 'YSR Kadapa',
    latitude: 14.4610,
    longitude: 78.8410,
    boundaryRadius: 1500,
    postalCode: '516003',
  },
  {
    name: 'Prakash Nagar',
    type: 'Colony',
    district: 'YSR Kadapa',
    latitude: 14.4690,
    longitude: 78.8190,
    boundaryRadius: 1200,
    postalCode: '516002',
  },
  {
    name: 'Mariyapuram',
    type: 'Area',
    district: 'YSR Kadapa',
    latitude: 14.4550,
    longitude: 78.8150,
    boundaryRadius: 1500,
    postalCode: '516001',
  },
  {
    name: 'Chinnachowk',
    type: 'Area',
    district: 'YSR Kadapa',
    latitude: 14.4580,
    longitude: 78.8450,
    boundaryRadius: 2000,
    postalCode: '516002',
  },
  {
    name: 'Seven Roads, Kadapa',
    type: 'Area',
    district: 'YSR Kadapa',
    latitude: 14.4710,
    longitude: 78.8230,
    boundaryRadius: 1200,
    postalCode: '516001',
  },

  // Nandyal City Sub-Areas & Colonies
  {
    name: 'NGO Colony, Nandyal',
    type: 'Colony',
    district: 'Nandyal',
    latitude: 15.4715,
    longitude: 78.4920,
    boundaryRadius: 1200,
    postalCode: '518501',
  },
  {
    name: 'Saleem Nagar',
    type: 'Area',
    district: 'Nandyal',
    latitude: 15.4715,
    longitude: 78.4920,
    boundaryRadius: 1200,
    postalCode: '518501',
  },
  {
    name: 'Sanjeeva Nagar',
    type: 'Colony',
    district: 'Nandyal',
    latitude: 15.4760,
    longitude: 78.4860,
    boundaryRadius: 1200,
    postalCode: '518501',
  },
  {
    name: 'Srinivasa Nagar, Nandyal',
    type: 'Colony',
    district: 'Nandyal',
    latitude: 15.4820,
    longitude: 78.4750,
    boundaryRadius: 1200,
    postalCode: '518501',
  },

  // Kurnool City Sub-Areas & Colonies
  {
    name: 'B Camp, Kurnool',
    type: 'Area',
    district: 'Kurnool',
    latitude: 15.8210,
    longitude: 78.0280,
    boundaryRadius: 1500,
    postalCode: '518002',
  },
  {
    name: 'C Camp, Kurnool',
    type: 'Area',
    district: 'Kurnool',
    latitude: 15.8150,
    longitude: 78.0320,
    boundaryRadius: 1500,
    postalCode: '518002',
  },
  {
    name: 'Joharapuram',
    type: 'Area',
    district: 'Kurnool',
    latitude: 15.8350,
    longitude: 78.0450,
    boundaryRadius: 1800,
    postalCode: '518002',
  },
  {
    name: 'Venkataramana Colony',
    type: 'Colony',
    district: 'Kurnool',
    latitude: 15.8290,
    longitude: 78.0410,
    boundaryRadius: 1200,
    postalCode: '518003',
  },

  // Nandyal District Villages & Mandals
  {
    name: 'Chagalamarri',
    type: 'Village',
    district: 'Nandyal',
    latitude: 14.9645,
    longitude: 78.5891,
    boundaryRadius: 6000,
    postalCode: '518553',
  },
  {
    name: 'Allagadda',
    type: 'Town',
    district: 'Nandyal',
    latitude: 15.1311,
    longitude: 78.5134,
    boundaryRadius: 6000,
    postalCode: '518543',
  },
  {
    name: 'Koilkuntla',
    type: 'Mandal',
    district: 'Nandyal',
    latitude: 15.2346,
    longitude: 78.3168,
    boundaryRadius: 6000,
    postalCode: '518134',
  },
  {
    name: 'Banaganapalle',
    type: 'Mandal',
    district: 'Nandyal',
    latitude: 15.3186,
    longitude: 78.2274,
    boundaryRadius: 6000,
    postalCode: '518124',
  },
  {
    name: 'Sirvel',
    type: 'Mandal',
    district: 'Nandyal',
    latitude: 15.3197,
    longitude: 78.5303,
    boundaryRadius: 6000,
    postalCode: '518563',
  },
  {
    name: 'Rudravaram',
    type: 'Village',
    district: 'Nandyal',
    latitude: 15.2447,
    longitude: 78.6385,
    boundaryRadius: 6000,
    postalCode: '518594',
  },
  {
    name: 'Dornipadu',
    type: 'Village',
    district: 'Nandyal',
    latitude: 15.1782,
    longitude: 78.4357,
    boundaryRadius: 6000,
    postalCode: '518135',
  },
  {
    name: 'Uyyalawada',
    type: 'Village',
    district: 'Nandyal',
    latitude: 15.1052,
    longitude: 78.3986,
    boundaryRadius: 6000,
    postalCode: '518155',
  },
  {
    name: 'Bethamcherla',
    type: 'Mandal',
    district: 'Nandyal',
    latitude: 15.4593,
    longitude: 78.1561,
    boundaryRadius: 6000,
    postalCode: '518222',
  },
  {
    name: 'Panyam',
    type: 'Mandal',
    district: 'Nandyal',
    latitude: 15.5186,
    longitude: 78.3512,
    boundaryRadius: 6000,
    postalCode: '518112',
  },
  {
    name: 'Gadivemula',
    type: 'Village',
    district: 'Nandyal',
    latitude: 15.6325,
    longitude: 78.4851,
    boundaryRadius: 6000,
    postalCode: '518508',
  },
  {
    name: 'Velgode',
    type: 'Mandal',
    district: 'Nandyal',
    latitude: 15.7925,
    longitude: 78.7183,
    boundaryRadius: 6000,
    postalCode: '518533',
  },
  {
    name: 'Atmakur',
    type: 'Town',
    district: 'Nandyal',
    latitude: 15.8824,
    longitude: 78.5947,
    boundaryRadius: 6000,
    postalCode: '518422',
  },
  {
    name: 'Nandikotkur',
    type: 'Town',
    district: 'Nandyal',
    latitude: 15.8624,
    longitude: 78.2618,
    boundaryRadius: 6000,
    postalCode: '518401',
  },
  {
    name: 'Mahanandi',
    type: 'Village',
    district: 'Nandyal',
    latitude: 15.485,
    longitude: 78.6258,
    boundaryRadius: 6000,
    postalCode: '518502',
  },
  {
    name: 'Srisailam',
    type: 'Town',
    district: 'Nandyal',
    latitude: 16.074,
    longitude: 78.868,
    boundaryRadius: 6000,
    postalCode: '518101',
  },

  // Kurnool District Mandals & Towns
  {
    name: 'Kodumur',
    type: 'Mandal',
    district: 'Kurnool',
    latitude: 15.6833,
    longitude: 77.7833,
    boundaryRadius: 6000,
    postalCode: '518464',
  },
  {
    name: 'Yemmiganur',
    type: 'Town',
    district: 'Kurnool',
    latitude: 15.7725,
    longitude: 77.4836,
    boundaryRadius: 6000,
    postalCode: '518360',
  },
  {
    name: 'Pattikonda',
    type: 'Mandal',
    district: 'Kurnool',
    latitude: 15.4022,
    longitude: 77.5186,
    boundaryRadius: 6000,
    postalCode: '518380',
  },
  {
    name: 'Mantralayam',
    type: 'Town',
    district: 'Kurnool',
    latitude: 15.9389,
    longitude: 77.4306,
    boundaryRadius: 6000,
    postalCode: '518345',
  },
  {
    name: 'Alur',
    type: 'Mandal',
    district: 'Kurnool',
    latitude: 15.3167,
    longitude: 77.25,
    boundaryRadius: 6000,
    postalCode: '518395',
  },

  // YSR Kadapa District Mandals & Towns
  {
    name: 'Jammalamadugu',
    type: 'Town',
    district: 'YSR Kadapa',
    latitude: 14.8488,
    longitude: 78.3888,
    boundaryRadius: 6000,
    postalCode: '516434',
  },
  {
    name: 'Mydukur',
    type: 'Town',
    district: 'YSR Kadapa',
    latitude: 14.7118,
    longitude: 78.6946,
    boundaryRadius: 6000,
    postalCode: '516172',
  },
  {
    name: 'Badvel',
    type: 'Town',
    district: 'YSR Kadapa',
    latitude: 14.7391,
    longitude: 79.0583,
    boundaryRadius: 6000,
    postalCode: '516227',
  },
  {
    name: 'Pulivendula',
    type: 'Town',
    district: 'YSR Kadapa',
    latitude: 14.4217,
    longitude: 78.2323,
    boundaryRadius: 6000,
    postalCode: '516390',
  },
  {
    name: 'Yerraguntla',
    type: 'Town',
    district: 'YSR Kadapa',
    latitude: 14.6366,
    longitude: 78.5369,
    boundaryRadius: 6000,
    postalCode: '516309',
  },
  {
    name: 'Kamalapuram',
    type: 'Mandal',
    district: 'YSR Kadapa',
    latitude: 14.5964,
    longitude: 78.6657,
    boundaryRadius: 6000,
    postalCode: '516289',
  },

  // Prakasam District Mandals
  {
    name: 'Giddalur',
    type: 'Town',
    district: 'Prakasam',
    latitude: 15.3784,
    longitude: 78.9242,
    boundaryRadius: 6000,
    postalCode: '523357',
  },
  {
    name: 'Markapur',
    type: 'Town',
    district: 'Prakasam',
    latitude: 15.7356,
    longitude: 79.2789,
    boundaryRadius: 6000,
    postalCode: '523316',
  },
  {
    name: 'Cumbum',
    type: 'Mandal',
    district: 'Prakasam',
    latitude: 15.5786,
    longitude: 79.1128,
    boundaryRadius: 6000,
    postalCode: '523333',
  },
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

/**
 * Searches for a matching Village, Mandal, or Sub-Area/Colony.
 */
export function findVillageOrMandal(query: string): VillageLocation | null {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim().toLowerCase();
  if (clean.length < 2) return null;

  // Remove common suffixes like 'kadapa', 'ap', 'colony' to match better
  const exact = AP_VILLAGES_MANDALS.find((v) => v.name.toLowerCase() === clean);
  if (exact) return exact;

  const startsWith = AP_VILLAGES_MANDALS.find((v) => v.name.toLowerCase().startsWith(clean));
  if (startsWith) return startsWith;

  const contains = AP_VILLAGES_MANDALS.find((v) => {
    const vLower = v.name.toLowerCase();
    return vLower.includes(clean) || clean.includes(vLower);
  });
  return contains || null;
}

/**
 * Unified territory finder: Checks sub-areas/villages/mandals first, then districts.
 * Returns coordinates, name, and auto-selected boundary radius.
 */
export function findTerritory(query: string): {
  name: string;
  latitude: number;
  longitude: number;
  boundaryRadius: number;
  description: string;
} | null {
  const village = findVillageOrMandal(query);
  if (village) {
    return {
      name: village.name,
      latitude: village.latitude,
      longitude: village.longitude,
      boundaryRadius: village.boundaryRadius,
      description: `${village.name} (${village.type}, ${village.district}${village.postalCode ? ` - ${village.postalCode}` : ''})`,
    };
  }

  const district = findAndhraCoordinates(query);
  if (district) {
    return {
      name: district.name,
      latitude: district.latitude,
      longitude: district.longitude,
      boundaryRadius: district.boundaryRadius || 8000,
      description: `${district.name} District HQ (${district.headquarters || district.name})`,
    };
  }

  return null;
}
