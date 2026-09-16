// Printed facts only. These cards are not part of the playable catalog yet.
// Reference inventory: docs/TERRAFORMING_MARS_CORPORATE_ERA.md.
import type { MarsResource } from './actions.js';

export type MarsPrintedTag = 'building' | 'space' | 'science' | 'plant' | 'animal' | 'microbe' | 'earth' | 'jovian' | 'power' | 'city';
export type MarsCorporateRequirement =
    | Readonly<{ kind: 'global'; track: 'oxygen' | 'temperature' | 'oceans'; amount: number; max: boolean }>
    | Readonly<{ kind: 'tag'; tag: MarsPrintedTag; amount: number }>
    | Readonly<{ kind: 'production'; resource: MarsResource; amount: number }>
    | Readonly<{ kind: 'cities'; scope: 'all'; amount: number }>;
export type MarsCorporateScore =
    | Readonly<{ kind: 'fixed'; points: number }>
    | Readonly<{ kind: 'resources'; per: number; points: number }>
    | Readonly<{ kind: 'tag'; tag: MarsPrintedTag; points: number }>
    | Readonly<{ kind: 'adjacentCities'; points: number }>;
export type MarsCorporateCardFact = Readonly<{
    id: string;
    englishName: string;
    number: string;
    cost: number;
    tags: readonly MarsPrintedTag[];
    requirements: readonly MarsCorporateRequirement[];
    type: 'active' | 'automated' | 'event';
    score: MarsCorporateScore;
    resource: 'microbe' | 'science' | 'fighter' | null;
}>;

export const MARS_CORPORATE_ERA_CARD_FACTS = [
    {"id": "AcquiredCompany", "englishName": "Acquired Company", "number": "106", "cost": 10, "tags": ["earth"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "AdvancedAlloys", "englishName": "Advanced Alloys", "number": "071", "cost": 9, "tags": ["science"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "AICentral", "englishName": "AI Central", "number": "208", "cost": 21, "tags": ["science", "building"], "requirements": [{"kind": "tag", "tag": "science", "amount": 3}], "type": "active", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "AntiGravityTechnology", "englishName": "Anti-Gravity Technology", "number": "150", "cost": 14, "tags": ["science"], "requirements": [{"kind": "tag", "tag": "science", "amount": 7}], "type": "active", "score": {"kind": "fixed", "points": 3}, "resource": null},
    {"id": "AsteroidMiningConsortium", "englishName": "Asteroid Mining Consortium", "number": "002", "cost": 13, "tags": ["jovian"], "requirements": [{"kind": "production", "resource": "titanium", "amount": 1}], "type": "automated", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "BribedCommittee", "englishName": "Bribed Committee", "number": "112", "cost": 7, "tags": ["earth"], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": -2}, "resource": null},
    {"id": "BuildingIndustries", "englishName": "Building Industries", "number": "065", "cost": 6, "tags": ["building"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "BusinessContacts", "englishName": "Business Contacts", "number": "111", "cost": 7, "tags": ["earth"], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "BusinessNetwork", "englishName": "Business Network", "number": "110", "cost": 4, "tags": ["earth"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "CallistoPenalMines", "englishName": "Callisto Penal Mines", "number": "082", "cost": 24, "tags": ["jovian", "space"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 2}, "resource": null},
    {"id": "CaretakerContract", "englishName": "Caretaker Contract", "number": "154", "cost": 3, "tags": [], "requirements": [{"kind": "global", "track": "temperature", "amount": 0, "max": false}], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "Cartel", "englishName": "Cartel", "number": "137", "cost": 8, "tags": ["earth"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "CEOsFavoriteProject", "englishName": "CEO's Favorite Project", "number": "149", "cost": 1, "tags": [], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "CommercialDistrict", "englishName": "Commercial District", "number": "085", "cost": 16, "tags": ["building"], "requirements": [], "type": "automated", "score": {"kind": "adjacentCities", "points": 1}, "resource": null},
    {"id": "CorporateStronghold", "englishName": "Corporate Stronghold", "number": "182", "cost": 11, "tags": ["city", "building"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": -2}, "resource": null},
    {"id": "DevelopmentCenter", "englishName": "Development Center", "number": "014", "cost": 11, "tags": ["science", "building"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "EarthCatapult", "englishName": "Earth Catapult", "number": "070", "cost": 23, "tags": ["earth"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 2}, "resource": null},
    {"id": "EarthOffice", "englishName": "Earth Office", "number": "105", "cost": 1, "tags": ["earth"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "ElectroCatapult", "englishName": "Electro Catapult", "number": "069", "cost": 17, "tags": ["building"], "requirements": [{"kind": "global", "track": "oxygen", "amount": 8, "max": true}], "type": "active", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "EnergyTapping", "englishName": "Energy Tapping", "number": "201", "cost": 3, "tags": ["power"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": -1}, "resource": null},
    {"id": "FuelFactory", "englishName": "Fuel Factory", "number": "180", "cost": 6, "tags": ["building"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "GeneRepair", "englishName": "Gene Repair", "number": "091", "cost": 12, "tags": ["science"], "requirements": [{"kind": "tag", "tag": "science", "amount": 3}], "type": "automated", "score": {"kind": "fixed", "points": 2}, "resource": null},
    {"id": "GreatEscarpmentConsortium", "englishName": "Great Escarpment Consortium", "number": "061", "cost": 6, "tags": [], "requirements": [{"kind": "production", "resource": "steel", "amount": 1}], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "Hackers", "englishName": "Hackers", "number": "125", "cost": 3, "tags": [], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": -1}, "resource": null},
    {"id": "HiredRaiders", "englishName": "Hired Raiders", "number": "124", "cost": 1, "tags": [], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "IndenturedWorkers", "englishName": "Indentured Workers", "number": "195", "cost": 0, "tags": [], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": -1}, "resource": null},
    {"id": "IndustrialCenter", "englishName": "Industrial Center", "number": "123", "cost": 4, "tags": ["building"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "InterstellarColonyShip", "englishName": "Interstellar Colony Ship", "number": "027", "cost": 24, "tags": ["earth", "space"], "requirements": [{"kind": "tag", "tag": "science", "amount": 5}], "type": "event", "score": {"kind": "fixed", "points": 4}, "resource": null},
    {"id": "InventionContest", "englishName": "Invention Contest", "number": "192", "cost": 2, "tags": ["science"], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "InventorsGuild", "englishName": "Inventors' Guild", "number": "006", "cost": 9, "tags": ["science"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "InvestmentLoan", "englishName": "Investment Loan", "number": "151", "cost": 3, "tags": ["earth"], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "IoMiningIndustries", "englishName": "Io Mining Industries", "number": "092", "cost": 41, "tags": ["jovian", "space"], "requirements": [], "type": "automated", "score": {"kind": "tag", "tag": "jovian", "points": 1}, "resource": null},
    {"id": "LagrangeObservatory", "englishName": "Lagrange Observatory", "number": "196", "cost": 9, "tags": ["science", "space"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "LandClaim", "englishName": "Land Claim", "number": "066", "cost": 1, "tags": [], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "LightningHarvest", "englishName": "Lightning Harvest", "number": "046", "cost": 8, "tags": ["power"], "requirements": [{"kind": "tag", "tag": "science", "amount": 3}], "type": "automated", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "MarsUniversity", "englishName": "Mars University", "number": "073", "cost": 8, "tags": ["science", "building"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "MassConverter", "englishName": "Mass Converter", "number": "094", "cost": 8, "tags": ["science", "power"], "requirements": [{"kind": "tag", "tag": "science", "amount": 5}], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "MediaArchives", "englishName": "Media Archives", "number": "107", "cost": 8, "tags": ["earth"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "MediaGroup", "englishName": "Media Group", "number": "109", "cost": 6, "tags": ["earth"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "MedicalLab", "englishName": "Medical Lab", "number": "207", "cost": 13, "tags": ["science", "building"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "Mine", "englishName": "Mine", "number": "056", "cost": 4, "tags": ["building"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "MineralDeposit", "englishName": "Mineral Deposit", "number": "062", "cost": 5, "tags": [], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "MiningArea", "englishName": "Mining Area", "number": "064", "cost": 4, "tags": ["building"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "MirandaResort", "englishName": "Miranda Resort", "number": "051", "cost": 12, "tags": ["jovian", "space"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "OlympusConference", "englishName": "Olympus Conference", "number": "185", "cost": 10, "tags": ["science", "earth", "building"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 1}, "resource": "science"},
    {"id": "PhysicsComplex", "englishName": "Physics Complex", "number": "095", "cost": 12, "tags": ["science", "building"], "requirements": [], "type": "active", "score": {"kind": "resources", "per": 1, "points": 2}, "resource": "science"},
    {"id": "PowerInfrastructure", "englishName": "Power Infrastructure", "number": "194", "cost": 4, "tags": ["power", "building"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "PowerSupplyConsortium", "englishName": "Power Supply Consortium", "number": "160", "cost": 5, "tags": ["power"], "requirements": [{"kind": "tag", "tag": "power", "amount": 2}], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "ProtectedHabitats", "englishName": "Protected Habitats", "number": "173", "cost": 5, "tags": [], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "QuantumExtractor", "englishName": "Quantum Extractor", "number": "079", "cost": 13, "tags": ["science", "power"], "requirements": [{"kind": "tag", "tag": "science", "amount": 4}], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "RadSuits", "englishName": "Rad-Suits", "number": "186", "cost": 6, "tags": [], "requirements": [{"kind": "cities", "amount": 2, "scope": "all"}], "type": "automated", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "Research", "englishName": "Research", "number": "090", "cost": 11, "tags": ["science", "science"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "RestrictedArea", "englishName": "Restricted Area", "number": "199", "cost": 11, "tags": ["science"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "RoboticWorkforce", "englishName": "Robotic Workforce", "number": "086", "cost": 9, "tags": ["science"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "Sabotage", "englishName": "Sabotage", "number": "121", "cost": 1, "tags": [], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "Satellites", "englishName": "Satellites", "number": "175", "cost": 10, "tags": ["space"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "SecurityFleet", "englishName": "Security Fleet", "number": "028", "cost": 12, "tags": ["space"], "requirements": [], "type": "active", "score": {"kind": "resources", "per": 1, "points": 1}, "resource": "fighter"},
    {"id": "SpaceElevator", "englishName": "Space Elevator", "number": "013", "cost": 27, "tags": ["space", "building"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 2}, "resource": null},
    {"id": "SpaceStation", "englishName": "Space Station", "number": "025", "cost": 10, "tags": ["space"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "Sponsors", "englishName": "Sponsors", "number": "068", "cost": 6, "tags": ["earth"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "StandardTechnology", "englishName": "Standard Technology", "number": "156", "cost": 6, "tags": ["science"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "Tardigrades", "englishName": "Tardigrades", "number": "049", "cost": 4, "tags": ["microbe"], "requirements": [], "type": "active", "score": {"kind": "resources", "per": 4, "points": 1}, "resource": "microbe"},
    {"id": "TechnologyDemonstration", "englishName": "Technology Demonstration", "number": "204", "cost": 5, "tags": ["science", "space"], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "TerraformingGanymede", "englishName": "Terraforming Ganymede", "number": "197", "cost": 33, "tags": ["jovian", "space"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 2}, "resource": null},
    {"id": "TitaniumMine", "englishName": "Titanium Mine", "number": "144", "cost": 7, "tags": ["building"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "TollStation", "englishName": "Toll Station", "number": "099", "cost": 12, "tags": ["space"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "TransNeptuneProbe", "englishName": "Trans-Neptune Probe", "number": "084", "cost": 6, "tags": ["science", "space"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "TropicalResort", "englishName": "Tropical Resort", "number": "098", "cost": 13, "tags": ["building"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 2}, "resource": null},
    {"id": "VestaShipyard", "englishName": "Vesta Shipyard", "number": "057", "cost": 15, "tags": ["jovian", "space"], "requirements": [], "type": "automated", "score": {"kind": "fixed", "points": 1}, "resource": null},
    {"id": "ViralEnhancers", "englishName": "Viral Enhancers", "number": "074", "cost": 9, "tags": ["science", "microbe"], "requirements": [], "type": "active", "score": {"kind": "fixed", "points": 0}, "resource": null},
    {"id": "Virus", "englishName": "Virus", "number": "050", "cost": 1, "tags": ["microbe"], "requirements": [], "type": "event", "score": {"kind": "fixed", "points": 0}, "resource": null},
] as const satisfies readonly MarsCorporateCardFact[];

export type MarsCorporateCorporationFact = Readonly<{
    id: string;
    englishName: string;
    money: number;
    tags: readonly MarsPrintedTag[];
    production: Readonly<Partial<Record<MarsResource, number>>>;
    passive:
        | Readonly<{ kind: 'jovianProduction'; resource: 'money'; amount: 1; scope: 'allPlayers'; includesSelf: true }>
        | Readonly<{ kind: 'cardDiscount'; tag: 'earth'; amount: 3 }>;
}>;

export const MARS_CORPORATE_ERA_CORPORATION_FACTS = [
    { id: 'SaturnSystems', englishName: 'Saturn Systems', money: 42, tags: ['jovian'], production: { titanium: 1 },
        passive: { kind: 'jovianProduction', resource: 'money', amount: 1, scope: 'allPlayers', includesSelf: true } },
    { id: 'Teractor', englishName: 'Teractor', money: 60, tags: ['earth'], production: {},
        passive: { kind: 'cardDiscount', tag: 'earth', amount: 3 } },
] as const satisfies readonly MarsCorporateCorporationFact[];
