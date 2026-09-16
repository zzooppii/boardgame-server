import type { MarsEffect } from './catalog.js';
import type { MARS_CORPORATE_ERA_CARD_FACTS } from './corporate-era-facts.js';
type CorporateCardId = typeof MARS_CORPORATE_ERA_CARD_FACTS[number]['id'];

// Implemented effect descriptions for the next catalog assembly step. This is not a deck.
export const MARS_CORPORATE_ERA_ECONOMIC_EFFECTS = {
    RoboticWorkforce: [{ kind: 'copyProduction' }],
    IndenturedWorkers: [{ kind: 'nextCardDiscount', amount: 8 }],
    AcquiredCompany: [{ kind: 'production', resource: 'money', amount: 3 }],
    BuildingIndustries: [{ kind: 'production', resource: 'energy', amount: -1 }, { kind: 'production', resource: 'steel', amount: 2 }],
    CallistoPenalMines: [{ kind: 'production', resource: 'money', amount: 3 }],
    Cartel: [{ kind: 'dynamic', rule: 'earthIncome' }],
    FuelFactory: [{ kind: 'production', resource: 'energy', amount: -1 }, { kind: 'production', resource: 'money', amount: 1 }, { kind: 'production', resource: 'titanium', amount: 1 }],
    GeneRepair: [{ kind: 'production', resource: 'money', amount: 2 }],
    InvestmentLoan: [{ kind: 'production', resource: 'money', amount: -1 }, { kind: 'stock', resource: 'money', amount: 10 }],
    IoMiningIndustries: [{ kind: 'production', resource: 'titanium', amount: 2 }, { kind: 'production', resource: 'money', amount: 2 }],
    LagrangeObservatory: [{ kind: 'draw', amount: 1 }],
    LightningHarvest: [{ kind: 'production', resource: 'energy', amount: 1 }, { kind: 'production', resource: 'money', amount: 1 }],
    MassConverter: [{ kind: 'production', resource: 'energy', amount: 6 }],
    MedicalLab: [{ kind: 'dynamic', rule: 'buildingIncome' }],
    Mine: [{ kind: 'production', resource: 'steel', amount: 1 }],
    MineralDeposit: [{ kind: 'stock', resource: 'steel', amount: 5 }],
    MirandaResort: [{ kind: 'dynamic', rule: 'earthIncome' }],
    QuantumExtractor: [{ kind: 'production', resource: 'energy', amount: 4 }],
    Research: [{ kind: 'draw', amount: 2 }],
    Satellites: [{ kind: 'dynamic', rule: 'spaceIncome' }],
    Sponsors: [{ kind: 'production', resource: 'money', amount: 2 }],
    TechnologyDemonstration: [{ kind: 'draw', amount: 2 }],
    TitaniumMine: [{ kind: 'production', resource: 'titanium', amount: 1 }],
    TollStation: [{ kind: 'dynamic', rule: 'opponentsSpaceIncome' }],
    TropicalResort: [{ kind: 'production', resource: 'heat', amount: -2 }, { kind: 'production', resource: 'money', amount: 3 }],
    VestaShipyard: [{ kind: 'production', resource: 'titanium', amount: 1 }],
} as const satisfies Partial<Record<CorporateCardId, readonly MarsEffect[]>>;
