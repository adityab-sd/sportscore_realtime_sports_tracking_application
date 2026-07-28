/**
 * F1 static data: team colors, driver-image mappings, circuit SVG mappings,
 * country flags, and helper lookups.
 */

// ─── Team colors (official F1 team colors) ──────────────────────────────────

export const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  "Mercedes":        { primary: "#27F4D2", secondary: "#00A19C" },
  "Ferrari":         { primary: "#E8002D", secondary: "#A6001A" },
  "Red Bull Racing": { primary: "#3671C6", secondary: "#1B3A7B" },
  "McLaren":         { primary: "#FF8000", secondary: "#CC6600" },
  "Aston Martin":    { primary: "#229971", secondary: "#174F3E" },
  "Alpine":          { primary: "#0093CC", secondary: "#005F85" },
  "Williams":        { primary: "#64C4FF", secondary: "#005AFF" },
  "Racing Bulls":    { primary: "#6692FF", secondary: "#2B4A8E" },
  "Haas":            { primary: "#B6BABD", secondary: "#86898C" },
  "Cadillac":        { primary: "#1E6B3A", secondary: "#0D3D1F" },
  "Audi":            { primary: "#E0002A", secondary: "#990A1D" },
  // aliases
  "Red Bull":        { primary: "#3671C6", secondary: "#1B3A7B" },
  "Kick Sauber":     { primary: "#52E252", secondary: "#006341" },
  "Sauber":          { primary: "#52E252", secondary: "#006341" },
  "AlphaTauri":      { primary: "#6692FF", secondary: "#2B4A8E" },
  "VCARB":           { primary: "#6692FF", secondary: "#2B4A8E" },
  "Stake F1 Team":   { primary: "#52E252", secondary: "#006341" },
};

export function getTeamColor(team: string | null | undefined): string {
  if (!team) return "#333333";
  for (const [key, val] of Object.entries(TEAM_COLORS)) {
    if (team.toLowerCase().includes(key.toLowerCase())) return val.primary;
  }
  return "#333333";
}

export function getTeamGradient(team: string | null | undefined): string {
  if (!team) return "linear-gradient(135deg, #333 0%, #222 100%)";
  for (const [key, val] of Object.entries(TEAM_COLORS)) {
    if (team.toLowerCase().includes(key.toLowerCase()))
      return `linear-gradient(135deg, ${val.primary} 0%, ${val.secondary} 100%)`;
  }
  return "linear-gradient(135deg, #333 0%, #222 100%)";
}

// ─── Driver image mapping ───────────────────────────────────────────────────
// Maps driverName -> local public image path. The naming convention is
// {teamlowercase}{first3last3}.jpeg

export interface DriverInfo {
  name: string;
  firstName: string;
  lastName: string;
  team: string;
  teamSlug: string;
  number: number;
  nationality: string;
  nationalityCode: string;
  flagEmoji: string;
  image: string;
}

export const DRIVERS_2026: DriverInfo[] = [
  { name: "George Russell", firstName: "George", lastName: "Russell", team: "Mercedes", teamSlug: "mercedes", number: 63, nationality: "British", nationalityCode: "GBR", flagEmoji: "🇬🇧", image: "/f1/drivers/mercedesgeorus.jpeg" },
  { name: "Kimi Antonelli", firstName: "Kimi", lastName: "Antonelli", team: "Mercedes", teamSlug: "mercedes", number: 12, nationality: "Italian", nationalityCode: "ITA", flagEmoji: "🇮🇹", image: "/f1/drivers/mercedesandant.jpeg" },
  { name: "Charles Leclerc", firstName: "Charles", lastName: "Leclerc", team: "Ferrari", teamSlug: "ferrari", number: 16, nationality: "Monégasque", nationalityCode: "MON", flagEmoji: "🇲🇨", image: "/f1/drivers/ferrarichalec.jpeg" },
  { name: "Lewis Hamilton", firstName: "Lewis", lastName: "Hamilton", team: "Ferrari", teamSlug: "ferrari", number: 44, nationality: "British", nationalityCode: "GBR", flagEmoji: "🇬🇧", image: "/f1/drivers/ferrarilewham.jpeg" },
  { name: "Lando Norris", firstName: "Lando", lastName: "Norris", team: "McLaren", teamSlug: "mclaren", number: 4, nationality: "British", nationalityCode: "GBR", flagEmoji: "🇬🇧", image: "/f1/drivers/mclarenlannor.jpeg" },
  { name: "Oscar Piastri", firstName: "Oscar", lastName: "Piastri", team: "McLaren", teamSlug: "mclaren", number: 81, nationality: "Australian", nationalityCode: "AUS", flagEmoji: "🇦🇺", image: "/f1/drivers/mclarenoscpia.jpeg" },
  { name: "Max Verstappen", firstName: "Max", lastName: "Verstappen", team: "Red Bull Racing", teamSlug: "redbull", number: 1, nationality: "Dutch", nationalityCode: "NED", flagEmoji: "🇳🇱", image: "/f1/drivers/redbullracingmaxver.jpeg" },
  { name: "Isack Hadjar", firstName: "Isack", lastName: "Hadjar", team: "Red Bull Racing", teamSlug: "redbull", number: 6, nationality: "French", nationalityCode: "FRA", flagEmoji: "🇫🇷", image: "/f1/drivers/redbullracingisahad.jpeg" },
  { name: "Fernando Alonso", firstName: "Fernando", lastName: "Alonso", team: "Aston Martin", teamSlug: "astonmartin", number: 14, nationality: "Spanish", nationalityCode: "ESP", flagEmoji: "🇪🇸", image: "/f1/drivers/astonmartinferalo.jpeg" },
  { name: "Lance Stroll", firstName: "Lance", lastName: "Stroll", team: "Aston Martin", teamSlug: "astonmartin", number: 18, nationality: "Canadian", nationalityCode: "CAN", flagEmoji: "🇨🇦", image: "/f1/drivers/astonmartinlanstr.jpeg" },
  { name: "Pierre Gasly", firstName: "Pierre", lastName: "Gasly", team: "Alpine", teamSlug: "alpine", number: 10, nationality: "French", nationalityCode: "FRA", flagEmoji: "🇫🇷", image: "/f1/drivers/alpinepiegas.jpeg" },
  { name: "Franco Colapinto", firstName: "Franco", lastName: "Colapinto", team: "Alpine", teamSlug: "alpine", number: 43, nationality: "Argentine", nationalityCode: "ARG", flagEmoji: "🇦🇷", image: "/f1/drivers/alpinefracol.jpeg" },
  { name: "Alexander Albon", firstName: "Alexander", lastName: "Albon", team: "Williams", teamSlug: "williams", number: 23, nationality: "Thai", nationalityCode: "THA", flagEmoji: "🇹🇭", image: "/f1/drivers/williamsalealb.jpeg" },
  { name: "Carlos Sainz", firstName: "Carlos", lastName: "Sainz", team: "Williams", teamSlug: "williams", number: 55, nationality: "Spanish", nationalityCode: "ESP", flagEmoji: "🇪🇸", image: "/f1/drivers/williamscarsai.jpeg" },
  { name: "Liam Lawson", firstName: "Liam", lastName: "Lawson", team: "Racing Bulls", teamSlug: "racingbulls", number: 30, nationality: "New Zealander", nationalityCode: "NZL", flagEmoji: "🇳🇿", image: "/f1/drivers/racingbullslialaw.jpeg" },
  { name: "Arvid Lindblad", firstName: "Arvid", lastName: "Lindblad", team: "Racing Bulls", teamSlug: "racingbulls", number: 27, nationality: "British", nationalityCode: "GBR", flagEmoji: "🇬🇧", image: "/f1/drivers/racingbullsarvlin.jpeg" },
  { name: "Esteban Ocon", firstName: "Esteban", lastName: "Ocon", team: "Haas", teamSlug: "haas", number: 31, nationality: "French", nationalityCode: "FRA", flagEmoji: "🇫🇷", image: "/f1/drivers/haasestoco.jpeg" },
  { name: "Oliver Bearman", firstName: "Oliver", lastName: "Bearman", team: "Haas", teamSlug: "haas", number: 87, nationality: "British", nationalityCode: "GBR", flagEmoji: "🇬🇧", image: "/f1/drivers/haasolibea.jpeg" },
  { name: "Gabriel Bortoleto", firstName: "Gabriel", lastName: "Bortoleto", team: "Audi", teamSlug: "audi", number: 5, nationality: "Brazilian", nationalityCode: "BRA", flagEmoji: "🇧🇷", image: "/f1/drivers/audigabbor.jpeg" },
  { name: "Nico Hülkenberg", firstName: "Nico", lastName: "Hülkenberg", team: "Audi", teamSlug: "audi", number: 27, nationality: "German", nationalityCode: "GER", flagEmoji: "🇩🇪", image: "/f1/drivers/audinichul.jpeg" },
  { name: "Sergio Perez", firstName: "Sergio", lastName: "Perez", team: "Cadillac", teamSlug: "cadillac", number: 11, nationality: "Mexican", nationalityCode: "MEX", flagEmoji: "🇲🇽", image: "/f1/drivers/cadillacserper.jpeg" },
  { name: "Valtteri Bottas", firstName: "Valtteri", lastName: "Bottas", team: "Cadillac", teamSlug: "cadillac", number: 77, nationality: "Finnish", nationalityCode: "FIN", flagEmoji: "🇫🇮", image: "/f1/drivers/cadillacvalbot.jpeg" },
];

export function findDriver(name: string): DriverInfo | undefined {
  const lower = name.toLowerCase();
  return DRIVERS_2026.find(d =>
    d.name.toLowerCase() === lower ||
    d.lastName.toLowerCase() === lower.split(" ").pop() ||
    lower.includes(d.lastName.toLowerCase())
  );
}

export function findDriverById(id: string): DriverInfo | undefined {
  // Won't match by ESPN id, but can be used with slug-style matching
  return undefined;
}

// ─── Team data ──────────────────────────────────────────────────────────────

export interface TeamInfo {
  name: string;
  slug: string;
  carImage: string;
  color: string;
  drivers: string[];
}

export const TEAMS_2026: TeamInfo[] = [
  { name: "Mercedes", slug: "mercedes", carImage: "/f1/cars/mercedes.jpeg", color: "#27F4D2", drivers: ["George Russell", "Kimi Antonelli"] },
  { name: "Ferrari", slug: "ferrari", carImage: "/f1/cars/ferrari.jpeg", color: "#E8002D", drivers: ["Charles Leclerc", "Lewis Hamilton"] },
  { name: "McLaren", slug: "mclaren", carImage: "/f1/cars/mclaren.jpeg", color: "#FF8000", drivers: ["Lando Norris", "Oscar Piastri"] },
  { name: "Red Bull Racing", slug: "redbull", carImage: "/f1/cars/redbull.jpeg", color: "#3671C6", drivers: ["Max Verstappen", "Isack Hadjar"] },
  { name: "Aston Martin", slug: "astonmartin", carImage: "/f1/cars/astonmartin.jpeg", color: "#229971", drivers: ["Fernando Alonso", "Lance Stroll"] },
  { name: "Alpine", slug: "alpine", carImage: "/f1/cars/alpine.jpeg", color: "#0093CC", drivers: ["Pierre Gasly", "Franco Colapinto"] },
  { name: "Williams", slug: "williams", carImage: "/f1/cars/williams.jpeg", color: "#64C4FF", drivers: ["Alexander Albon", "Carlos Sainz"] },
  { name: "Racing Bulls", slug: "racingbulls", carImage: "/f1/cars/racingbulls.jpeg", color: "#6692FF", drivers: ["Liam Lawson", "Arvid Lindblad"] },
  { name: "Haas", slug: "haas", carImage: "/f1/cars/haas.jpeg", color: "#B6BABD", drivers: ["Esteban Ocon", "Oliver Bearman"] },
  { name: "Audi", slug: "audi", carImage: "/f1/cars/audi.jpeg", color: "#E0002A", drivers: ["Gabriel Bortoleto", "Nico Hülkenberg"] },
  { name: "Cadillac", slug: "cadillac", carImage: "/f1/cars/cadillac.jpeg", color: "#1E6B3A", drivers: ["Sergio Perez", "Valtteri Bottas"] },
];

export function findTeam(name: string): TeamInfo | undefined {
  const lower = name.toLowerCase();
  return TEAMS_2026.find(t =>
    t.name.toLowerCase() === lower ||
    t.slug === lower ||
    lower.includes(t.slug)
  );
}

export function findTeamByDriver(driverName: string): TeamInfo | undefined {
  return TEAMS_2026.find(t => t.drivers.some(d => d.toLowerCase() === driverName.toLowerCase()));
}

// ─── Country flag emoji lookup ──────────────────────────────────────────────

const FLAG_MAP: Record<string, string> = {
  "Australia": "🇦🇺", "Bahrain": "🇧🇭", "China": "🇨🇳", "Japan": "🇯🇵",
  "United States": "🇺🇸", "USA": "🇺🇸", "Canada": "🇨🇦", "Monaco": "🇲🇨",
  "Spain": "🇪🇸", "Austria": "🇦🇹", "Great Britain": "🇬🇧", "United Kingdom": "🇬🇧",
  "Belgium": "🇧🇪", "Hungary": "🇭🇺", "Netherlands": "🇳🇱", "Italy": "🇮🇹",
  "Azerbaijan": "🇦🇿", "Singapore": "🇸🇬", "Mexico": "🇲🇽", "Brazil": "🇧🇷",
  "Qatar": "🇶🇦", "UAE": "🇦🇪", "Abu Dhabi": "🇦🇪", "Saudi Arabia": "🇸🇦",
  "France": "🇫🇷", "Germany": "🇩🇪", "Finland": "🇫🇮", "Argentina": "🇦🇷",
  "Thailand": "🇹🇭", "New Zealand": "🇳🇿", "Denmark": "🇩🇰", "Switzerland": "🇨🇭",
};

export function getCountryFlag(country: string | null | undefined): string {
  if (!country) return "🏁";
  return FLAG_MAP[country] || "🏁";
}

// ─── Circuit SVG mapping ────────────────────────────────────────────────────
// Maps race name keywords to circuit SVG filenames

const CIRCUIT_MAP: Record<string, string> = {
  "australia": "australia", "australian": "australia",
  "china": "china", "chinese": "china", "shanghai": "china",
  "japan": "japan", "japanese": "japan", "suzuka": "japan",
  "miami": "miami",
  "canada": "canada", "canadian": "canada", "montreal": "canada",
  "monaco": "monaco",
  "spain": "spain", "spanish": "spain", "barcelona": "barcelona",
  "austria": "austria", "austrian": "austria", "spielberg": "austria",
  "britain": "greatbritain", "british": "greatbritain", "silverstone": "greatbritain",
  "belgium": "belgium", "belgian": "belgium", "spa": "belgium",
  "hungary": "hungary", "hungarian": "hungary", "hungaroring": "hungary",
  "netherlands": "netherlands", "dutch": "netherlands", "zandvoort": "netherlands",
  "italy": "italy", "italian": "italy", "monza": "italy",
  "emilia": "emiliaromagna", "imola": "emiliaromagna",
  "azerbaijan": "azerbaijan", "baku": "azerbaijan",
  "singapore": "singapore",
  "united states": "usa", "us grand": "usa", "austin": "usa", "cota": "usa",
  "mexico": "mexico", "mexican": "mexico",
  "brazil": "brazil", "brazilian": "brazil", "são paulo": "brazil", "sao paulo": "brazil", "interlagos": "brazil",
  "las vegas": "lasvegas",
  "qatar": "qatar", "lusail": "qatar",
  "abu dhabi": "abudhabi", "yas marina": "abudhabi",
  "bahrain": "bahrain", "sakhir": "bahrain",
  "saudi": "saudiarabia", "jeddah": "saudiarabia",
};

export function getCircuitSvg(raceName: string): string | null {
  const lower = raceName.toLowerCase();
  for (const [key, file] of Object.entries(CIRCUIT_MAP)) {
    if (lower.includes(key)) return `/f1/circuits/${file}.svg`;
  }
  return null;
}

// ─── Driver slug for URL ────────────────────────────────────────────────────

export function driverSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function teamSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Date formatting ────────────────────────────────────────────────────────

export function formatRaceDate(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "TBA";
  try {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;
    const sDay = start.getUTCDate();
    const eDay = end.getUTCDate();
    const month = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
    if (sDay === eDay) return `${sDay} ${month}`;
    return `${sDay} – ${eDay} ${month}`;
  } catch {
    return "TBA";
  }
}

export function extractRound(name: string, index: number): number {
  return index + 1;
}
