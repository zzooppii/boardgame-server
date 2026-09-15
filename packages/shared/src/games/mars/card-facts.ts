// Printed base-game facts. Sources and scope: docs/TERRAFORMING_MARS_GAME_RULES.md.
export const MARS_CARD_FACTS = [
 {
  "id": "AdaptationTechnology",
  "name": "Adaptation Technology",
  "number": "153",
  "cost": 12,
  "tags": [
   "science"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "AdaptedLichen",
  "name": "Adapted Lichen",
  "number": "048",
  "cost": 9,
  "tags": [
   "plant"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "AdvancedEcosystems",
  "name": "Advanced Ecosystems",
  "number": "135",
  "cost": 11,
  "tags": [
   "plant",
   "microbe",
   "animal"
  ],
  "requirements": [
   {
    "kind": "plant",
    "amount": 1,
    "max": false
   },
   {
    "kind": "animal",
    "amount": 1,
    "max": false
   },
   {
    "kind": "microbe",
    "amount": 1,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 3,
  "resource": null
 },
 {
  "id": "AerobrakedAmmoniaAsteroid",
  "name": "Aerobraked Ammonia Asteroid",
  "number": "170",
  "cost": 26,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Ants",
  "name": "Ants",
  "number": "035",
  "cost": 9,
  "tags": [
   "microbe"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 4,
    "max": false
   }
  ],
  "type": "active",
  "score": "resources",
  "points": 2,
  "resource": "microbe"
 },
 {
  "id": "AquiferPumping",
  "name": "Aquifer Pumping",
  "number": "187",
  "cost": 18,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Algae",
  "name": "Algae",
  "number": "047",
  "cost": 10,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "oceans",
    "amount": 5,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ArchaeBacteria",
  "name": "ArchaeBacteria",
  "number": "042",
  "cost": 6,
  "tags": [
   "microbe"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -18,
    "max": true
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ArcticAlgae",
  "name": "Arctic Algae",
  "number": "023",
  "cost": 12,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -12,
    "max": true
   }
  ],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ArtificialLake",
  "name": "Artificial Lake",
  "number": "116",
  "cost": 15,
  "tags": [
   "building"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -6,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "ArtificialPhotosynthesis",
  "name": "Artificial Photosynthesis",
  "number": "115",
  "cost": 12,
  "tags": [
   "science"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Asteroid",
  "name": "Asteroid",
  "number": "009",
  "cost": 14,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "AsteroidMining",
  "name": "Asteroid Mining",
  "number": "040",
  "cost": 30,
  "tags": [
   "jovian",
   "space"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 2,
  "resource": null
 },
 {
  "id": "BeamFromAThoriumAsteroid",
  "name": "Beam From A Thorium Asteroid",
  "number": "058",
  "cost": 32,
  "tags": [
   "jovian",
   "space",
   "power"
  ],
  "requirements": [
   {
    "kind": "jovian",
    "amount": 1,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "BigAsteroid",
  "name": "Big Asteroid",
  "number": "011",
  "cost": 27,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "BiomassCombustors",
  "name": "Biomass Combustors",
  "number": "183",
  "cost": 4,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 6,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": -1,
  "resource": null
 },
 {
  "id": "Birds",
  "name": "Birds",
  "number": "072",
  "cost": 10,
  "tags": [
   "animal"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 13,
    "max": false
   }
  ],
  "type": "active",
  "score": "resources",
  "points": 1,
  "resource": "animal"
 },
 {
  "id": "BlackPolarDust",
  "name": "Black Polar Dust",
  "number": "022",
  "cost": 15,
  "tags": [],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "BreathingFilters",
  "name": "Breathing Filters",
  "number": "114",
  "cost": 11,
  "tags": [
   "science"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 7,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 2,
  "resource": null
 },
 {
  "id": "Bushes",
  "name": "Bushes",
  "number": "093",
  "cost": 10,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -10,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Capital",
  "name": "Capital",
  "number": "008",
  "cost": 26,
  "tags": [
   "city",
   "building"
  ],
  "requirements": [
   {
    "kind": "oceans",
    "amount": 4,
    "max": false
   }
  ],
  "type": "automated",
  "score": "capital",
  "points": 1,
  "resource": null
 },
 {
  "id": "CarbonateProcessing",
  "name": "Carbonate Processing",
  "number": "043",
  "cost": 6,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "CloudSeeding",
  "name": "Cloud Seeding",
  "number": "004",
  "cost": 11,
  "tags": [],
  "requirements": [
   {
    "kind": "oceans",
    "amount": 3,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ColonizerTrainingCamp",
  "name": "Colonizer Training Camp",
  "number": "001",
  "cost": 8,
  "tags": [
   "jovian",
   "building"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 5,
    "max": true
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 2,
  "resource": null
 },
 {
  "id": "Comet",
  "name": "Comet",
  "number": "010",
  "cost": 21,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ConvoyFromEuropa",
  "name": "Convoy From Europa",
  "number": "161",
  "cost": 15,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "CupolaCity",
  "name": "Cupola City",
  "number": "029",
  "cost": 16,
  "tags": [
   "city",
   "building"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 9,
    "max": true
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Decomposers",
  "name": "Decomposers",
  "number": "131",
  "cost": 5,
  "tags": [
   "microbe"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 3,
    "max": false
   }
  ],
  "type": "active",
  "score": "resources",
  "points": 3,
  "resource": "microbe"
 },
 {
  "id": "DeepWellHeating",
  "name": "Deep Well Heating",
  "number": "003",
  "cost": 13,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "DeimosDown",
  "name": "Deimos Down",
  "number": "039",
  "cost": 31,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "DesignedMicroOrganisms",
  "name": "Designed Microorganisms",
  "number": "155",
  "cost": 16,
  "tags": [
   "science",
   "microbe"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -14,
    "max": true
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "DomedCrater",
  "name": "Domed Crater",
  "number": "016",
  "cost": 24,
  "tags": [
   "city",
   "building"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 7,
    "max": true
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "DustSeals",
  "name": "Dust Seals",
  "number": "119",
  "cost": 2,
  "tags": [],
  "requirements": [
   {
    "kind": "oceans",
    "amount": 3,
    "max": true
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "EcologicalZone",
  "name": "Ecological Zone",
  "number": "128",
  "cost": 12,
  "tags": [
   "animal",
   "plant"
  ],
  "requirements": [
   {
    "kind": "greenery",
    "amount": 1,
    "max": false
   }
  ],
  "type": "active",
  "score": "resources",
  "points": 2,
  "resource": "animal"
 },
 {
  "id": "EnergySaving",
  "name": "Energy Saving",
  "number": "189",
  "cost": 15,
  "tags": [
   "power"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "EosChasmaNationalPark",
  "name": "Eos Chasma National Park",
  "number": "026",
  "cost": 16,
  "tags": [
   "plant",
   "building"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -12,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "EquatorialMagnetizer",
  "name": "Equatorial Magnetizer",
  "number": "015",
  "cost": 11,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ExtremeColdFungus",
  "name": "Extreme-Cold Fungus",
  "number": "134",
  "cost": 13,
  "tags": [
   "microbe"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -10,
    "max": true
   }
  ],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Farming",
  "name": "Farming",
  "number": "118",
  "cost": 16,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": 4,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 2,
  "resource": null
 },
 {
  "id": "Fish",
  "name": "Fish",
  "number": "052",
  "cost": 9,
  "tags": [
   "animal"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": 2,
    "max": false
   }
  ],
  "type": "active",
  "score": "resources",
  "points": 1,
  "resource": "animal"
 },
 {
  "id": "Flooding",
  "name": "Flooding",
  "number": "188",
  "cost": 7,
  "tags": [],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": -1,
  "resource": null
 },
 {
  "id": "FoodFactory",
  "name": "Food Factory",
  "number": "041",
  "cost": 12,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "FusionPower",
  "name": "Fusion Power",
  "number": "132",
  "cost": 14,
  "tags": [
   "science",
   "power",
   "building"
  ],
  "requirements": [
   {
    "kind": "power",
    "amount": 2,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "FueledGenerators",
  "name": "Fueled Generators",
  "number": "100",
  "cost": 1,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "GanymedeColony",
  "name": "Ganymede Colony",
  "number": "081",
  "cost": 20,
  "tags": [
   "jovian",
   "space",
   "city"
  ],
  "requirements": [],
  "type": "automated",
  "score": "jovian",
  "points": 1,
  "resource": null
 },
 {
  "id": "GeothermalPower",
  "name": "Geothermal Power",
  "number": "117",
  "cost": 11,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "GHGFactories",
  "name": "GHG Factories",
  "number": "126",
  "cost": 11,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "GHGProducingBacteria",
  "name": "GHG Producing Bacteria",
  "number": "034",
  "cost": 8,
  "tags": [
   "science",
   "microbe"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 4,
    "max": false
   }
  ],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": "microbe"
 },
 {
  "id": "GiantIceAsteroid",
  "name": "Giant Ice Asteroid",
  "number": "080",
  "cost": 36,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "GiantSpaceMirror",
  "name": "Giant Space Mirror",
  "number": "083",
  "cost": 17,
  "tags": [
   "power",
   "space"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Grass",
  "name": "Grass",
  "number": "087",
  "cost": 11,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -16,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "GreatDam",
  "name": "Great Dam",
  "number": "136",
  "cost": 12,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [
   {
    "kind": "oceans",
    "amount": 4,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "Greenhouses",
  "name": "Greenhouses",
  "number": "096",
  "cost": 6,
  "tags": [
   "plant",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Heather",
  "name": "Heather",
  "number": "88",
  "cost": 6,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -14,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "HeatTrappers",
  "name": "Heat Trappers",
  "number": "178",
  "cost": 6,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": -1,
  "resource": null
 },
 {
  "id": "Herbivores",
  "name": "Herbivores",
  "number": "147",
  "cost": 12,
  "tags": [
   "animal"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 8,
    "max": false
   }
  ],
  "type": "active",
  "score": "resources",
  "points": 2,
  "resource": "animal"
 },
 {
  "id": "IceAsteroid",
  "name": "Ice Asteroid",
  "number": "078",
  "cost": 23,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "IceCapMelting",
  "name": "Ice Cap Melting",
  "number": "181",
  "cost": 5,
  "tags": [],
  "requirements": [
   {
    "kind": "temperature",
    "amount": 2,
    "max": false
   }
  ],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ImmigrantCity",
  "name": "Immigrant City",
  "number": "200",
  "cost": 13,
  "tags": [
   "city",
   "building"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ImmigrationShuttles",
  "name": "Immigration Shuttles",
  "number": "198",
  "cost": 31,
  "tags": [
   "earth",
   "space"
  ],
  "requirements": [],
  "type": "automated",
  "score": "cities",
  "points": 3,
  "resource": null
 },
 {
  "id": "ImportedGHG",
  "name": "Imported GHG",
  "number": "162",
  "cost": 7,
  "tags": [
   "earth",
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ImportedHydrogen",
  "name": "Imported Hydrogen",
  "number": "019",
  "cost": 16,
  "tags": [
   "earth",
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ImportedNitrogen",
  "name": "Imported Nitrogen",
  "number": "163",
  "cost": 23,
  "tags": [
   "earth",
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ImportOfAdvancedGHG",
  "name": "Import of Advanced GHG",
  "number": "167",
  "cost": 9,
  "tags": [
   "earth",
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "IndustrialMicrobes",
  "name": "Industrial Microbes",
  "number": "158",
  "cost": 12,
  "tags": [
   "microbe",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Insects",
  "name": "Insects",
  "number": "148",
  "cost": 9,
  "tags": [
   "microbe"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 6,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Insulation",
  "name": "Insulation",
  "number": "152",
  "cost": 2,
  "tags": [],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Ironworks",
  "name": "Ironworks",
  "number": "101",
  "cost": 11,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "KelpFarming",
  "name": "Kelp Farming",
  "number": "055",
  "cost": 17,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "oceans",
    "amount": 6,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "LakeMarineris",
  "name": "Lake Marineris",
  "number": "053",
  "cost": 18,
  "tags": [],
  "requirements": [
   {
    "kind": "temperature",
    "amount": 0,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 2,
  "resource": null
 },
 {
  "id": "LargeConvoy",
  "name": "Large Convoy",
  "number": "143",
  "cost": 36,
  "tags": [
   "earth",
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 2,
  "resource": null
 },
 {
  "id": "LavaFlows",
  "name": "Lava Flows",
  "number": "140",
  "cost": 18,
  "tags": [],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Lichen",
  "name": "Lichen",
  "number": "159",
  "cost": 7,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -24,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Livestock",
  "name": "Livestock",
  "number": "184",
  "cost": 13,
  "tags": [
   "animal"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 9,
    "max": false
   }
  ],
  "type": "active",
  "score": "resources",
  "points": 1,
  "resource": "animal"
 },
 {
  "id": "LocalHeatTrapping",
  "name": "Local Heat Trapping",
  "number": "190",
  "cost": 1,
  "tags": [],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "LunarBeam",
  "name": "Lunar Beam",
  "number": "030",
  "cost": 13,
  "tags": [
   "earth",
   "power"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "MagneticFieldDome",
  "name": "Magnetic Field Dome",
  "number": "171",
  "cost": 5,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "MagneticFieldGenerators",
  "name": "Magnetic Field Generators",
  "number": "165",
  "cost": 20,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Mangrove",
  "name": "Mangrove",
  "number": "059",
  "cost": 12,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": 4,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "MartianRails",
  "name": "Martian Rails",
  "number": "007",
  "cost": 13,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "MethaneFromTitan",
  "name": "Methane From Titan",
  "number": "018",
  "cost": 28,
  "tags": [
   "jovian",
   "space"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 2,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 2,
  "resource": null
 },
 {
  "id": "MicroMills",
  "name": "Micro-Mills",
  "number": "164",
  "cost": 3,
  "tags": [],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "MiningExpedition",
  "name": "Mining Expedition",
  "number": "063",
  "cost": 12,
  "tags": [],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "MiningRights",
  "name": "Mining Rights",
  "number": "067",
  "cost": 9,
  "tags": [],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "MoholeArea",
  "name": "Mohole Area",
  "number": "142",
  "cost": 20,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Moss",
  "name": "Moss",
  "number": "122",
  "cost": 4,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "oceans",
    "amount": 3,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "NaturalPreserve",
  "name": "Natural Preserve",
  "number": "044",
  "cost": 9,
  "tags": [
   "science",
   "building"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 4,
    "max": true
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "NitriteReducingBacteria",
  "name": "Nitrite Reducing Bacteria",
  "number": "157",
  "cost": 11,
  "tags": [
   "microbe"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": "microbe"
 },
 {
  "id": "NitrogenRichAsteroid",
  "name": "Nitrogen-Rich Asteroid",
  "number": "037",
  "cost": 31,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "NitrophilicMoss",
  "name": "Nitrophilic Moss",
  "number": "146",
  "cost": 8,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "oceans",
    "amount": 3,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "NoctisCity",
  "name": "Noctis City",
  "number": "017",
  "cost": 18,
  "tags": [
   "city",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "NoctisFarming",
  "name": "Noctis Farming",
  "number": "176",
  "cost": 10,
  "tags": [
   "plant",
   "building"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -20,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "NuclearPower",
  "name": "Nuclear Power",
  "number": "045",
  "cost": 10,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "NuclearZone",
  "name": "Nuclear Zone",
  "number": "097",
  "cost": 10,
  "tags": [
   "earth"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": -2,
  "resource": null
 },
 {
  "id": "OpenCity",
  "name": "Open City",
  "number": "108",
  "cost": 23,
  "tags": [
   "city",
   "building"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 12,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "OptimalAerobraking",
  "name": "Optimal Aerobraking",
  "number": "031",
  "cost": 7,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "OreProcessor",
  "name": "Ore Processor",
  "number": "104",
  "cost": 13,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "PermafrostExtraction",
  "name": "Permafrost Extraction",
  "number": "191",
  "cost": 8,
  "tags": [],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -8,
    "max": false
   }
  ],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "PeroxidePower",
  "name": "Peroxide Power",
  "number": "089",
  "cost": 7,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Pets",
  "name": "Pets",
  "number": "172",
  "cost": 10,
  "tags": [
   "earth",
   "animal"
  ],
  "requirements": [],
  "type": "active",
  "score": "resources",
  "points": 2,
  "resource": "animal"
 },
 {
  "id": "PhobosSpaceHaven",
  "name": "Phobos Space Haven",
  "number": "021",
  "cost": 25,
  "tags": [
   "space",
   "city"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 3,
  "resource": null
 },
 {
  "id": "Plantation",
  "name": "Plantation",
  "number": "193",
  "cost": 15,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "science",
    "amount": 2,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "PowerGrid",
  "name": "Power Grid",
  "number": "102",
  "cost": 18,
  "tags": [
   "power"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "PowerPlant",
  "name": "Power Plant",
  "number": "141",
  "cost": 4,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Predators",
  "name": "Predators",
  "number": "024",
  "cost": 14,
  "tags": [
   "animal"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 11,
    "max": false
   }
  ],
  "type": "active",
  "score": "resources",
  "points": 1,
  "resource": "animal"
 },
 {
  "id": "ProtectedValley",
  "name": "Protected Valley",
  "number": "174",
  "cost": 23,
  "tags": [
   "plant",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "RadChemFactory",
  "name": "Rad-Chem Factory",
  "number": "205",
  "cost": 8,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "RegolithEaters",
  "name": "Regolith Eaters",
  "number": "033",
  "cost": 13,
  "tags": [
   "science",
   "microbe"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": "microbe"
 },
 {
  "id": "ReleaseOfInertGases",
  "name": "Release of Inert Gases",
  "number": "036",
  "cost": 14,
  "tags": [],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "ResearchOutpost",
  "name": "Research Outpost",
  "number": "020",
  "cost": 18,
  "tags": [
   "science",
   "city",
   "building"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "RoverConstruction",
  "name": "Rover Construction",
  "number": "038",
  "cost": 8,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "SearchForLife",
  "name": "Search For Life",
  "number": "005",
  "cost": 3,
  "tags": [
   "science"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 6,
    "max": true
   }
  ],
  "type": "active",
  "score": "life",
  "points": 3,
  "resource": "science"
 },
 {
  "id": "Shuttles",
  "name": "Shuttles",
  "number": "166",
  "cost": 10,
  "tags": [
   "space"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 5,
    "max": false
   }
  ],
  "type": "active",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "SmallAnimals",
  "name": "Small Animals",
  "number": "054",
  "cost": 6,
  "tags": [
   "animal"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 6,
    "max": false
   }
  ],
  "type": "active",
  "score": "resources",
  "points": 2,
  "resource": "animal"
 },
 {
  "id": "SoilFactory",
  "name": "Soil Factory",
  "number": "179",
  "cost": 9,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "SolarPower",
  "name": "Solar Power",
  "number": "113",
  "cost": 11,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "SolarWindPower",
  "name": "Solar Wind Power",
  "number": "077",
  "cost": 11,
  "tags": [
   "science",
   "space",
   "power"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Soletta",
  "name": "Soletta",
  "number": "203",
  "cost": 35,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "SpaceMirrors",
  "name": "Space Mirrors",
  "number": "076",
  "cost": 3,
  "tags": [
   "power",
   "space"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "SpecialDesign",
  "name": "Special Design",
  "number": "206",
  "cost": 4,
  "tags": [
   "science"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Steelworks",
  "name": "Steelworks",
  "number": "103",
  "cost": 15,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "StripMine",
  "name": "Strip Mine",
  "number": "138",
  "cost": 25,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "SubterraneanReservoir",
  "name": "Subterranean Reservoir",
  "number": "127",
  "cost": 11,
  "tags": [],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "SymbioticFungus",
  "name": "Symbiotic Fungus",
  "number": "133",
  "cost": 4,
  "tags": [
   "microbe"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -14,
    "max": false
   }
  ],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "TectonicStressPower",
  "name": "Tectonic Stress Power",
  "number": "145",
  "cost": 18,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [
   {
    "kind": "science",
    "amount": 2,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "TowingAComet",
  "name": "Towing A Comet",
  "number": "075",
  "cost": 23,
  "tags": [
   "space"
  ],
  "requirements": [],
  "type": "event",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Trees",
  "name": "Trees",
  "number": "060",
  "cost": 13,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -4,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "TundraFarming",
  "name": "Tundra Farming",
  "number": "169",
  "cost": 16,
  "tags": [
   "plant"
  ],
  "requirements": [
   {
    "kind": "temperature",
    "amount": -6,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 2,
  "resource": null
 },
 {
  "id": "UndergroundCity",
  "name": "Underground City",
  "number": "032",
  "cost": 18,
  "tags": [
   "city",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "UndergroundDetonations",
  "name": "Underground Detonations",
  "number": "202",
  "cost": 6,
  "tags": [
   "building"
  ],
  "requirements": [],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "UrbanizedArea",
  "name": "Urbanized Area",
  "number": "120",
  "cost": 10,
  "tags": [
   "city",
   "building"
  ],
  "requirements": [],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "WaterImportFromEuropa",
  "name": "Water Import From Europa",
  "number": "012",
  "cost": 25,
  "tags": [
   "jovian",
   "space"
  ],
  "requirements": [],
  "type": "active",
  "score": "jovian",
  "points": 1,
  "resource": null
 },
 {
  "id": "WaterSplittingPlant",
  "name": "Water Splitting Plant",
  "number": "177",
  "cost": 12,
  "tags": [
   "building"
  ],
  "requirements": [
   {
    "kind": "oceans",
    "amount": 2,
    "max": false
   }
  ],
  "type": "active",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "WavePower",
  "name": "Wave Power",
  "number": "139",
  "cost": 8,
  "tags": [
   "power"
  ],
  "requirements": [
   {
    "kind": "oceans",
    "amount": 3,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "Windmills",
  "name": "Windmills",
  "number": "168",
  "cost": 6,
  "tags": [
   "power",
   "building"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 7,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 },
 {
  "id": "Worms",
  "name": "Worms",
  "number": "130",
  "cost": 8,
  "tags": [
   "microbe"
  ],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 4,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 0,
  "resource": null
 },
 {
  "id": "Zeppelins",
  "name": "Zeppelins",
  "number": "129",
  "cost": 13,
  "tags": [],
  "requirements": [
   {
    "kind": "oxygen",
    "amount": 5,
    "max": false
   }
  ],
  "type": "automated",
  "score": "fixed",
  "points": 1,
  "resource": null
 }
] as const;
