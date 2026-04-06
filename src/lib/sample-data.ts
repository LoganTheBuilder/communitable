import type { TableMeta, TableSchema, TableData } from "./types";

export const SAMPLE_TABLES: TableMeta[] = [
  { id: "1", name: "World Population by Country", description: "Census estimates from 2020–2024", author: "un_data", rowCount: 195, updatedAt: "2024-03-01" },
  { id: "2", name: "S&P 500 Companies", description: "Constituents, sectors, and market caps", author: "market_data", rowCount: 503, updatedAt: "2024-04-01" },
  { id: "3", name: "Global CO₂ Emissions", description: "Annual emissions per country since 1990", author: "climate_lab", rowCount: 6840, updatedAt: "2024-01-15" },
  { id: "4", name: "Netflix Original Titles", description: "Release dates, genres, and ratings", author: "streaming_db", rowCount: 1200, updatedAt: "2024-02-20" },
  { id: "5", name: "US Federal Holidays", description: "Official observances from 1970 to 2030", author: "gov_data", rowCount: 480, updatedAt: "2023-12-01" },
  { id: "6", name: "Periodic Table of Elements", description: "Atomic number, weight, group, and state", author: "chem_ref", rowCount: 118, updatedAt: "2023-09-10" },
];

// Sample schemas and data per table id
const SCHEMAS: Record<string, TableSchema> = {
  "1": {
    columns: [
      { key: "country",    label: "Country",          type: "string" },
      { key: "population", label: "Population (2024)", type: "number" },
      { key: "area_km2",   label: "Area (km²)",        type: "number" },
      { key: "density",    label: "Density (/km²)",    type: "number" },
      { key: "continent",  label: "Continent",         type: "string" },
    ],
  },
  "6": {
    columns: [
      { key: "number",  label: "Atomic No.", type: "number" },
      { key: "symbol",  label: "Symbol",     type: "string" },
      { key: "name",    label: "Name",       type: "string" },
      { key: "weight",  label: "Atomic Wt.", type: "number" },
      { key: "group",   label: "Group",      type: "number" },
      { key: "period",  label: "Period",     type: "number" },
      { key: "state",   label: "State",      type: "string" },
    ],
  },
};

const DATA: Record<string, TableData> = {
  "1": {
    rows: [
      { country: "China",        population: 1_419_321_000, area_km2: 9_596_960, density: 148, continent: "Asia"          },
      { country: "India",        population: 1_441_719_000, area_km2: 3_287_263, density: 438, continent: "Asia"          },
      { country: "USA",          population:   335_893_000, area_km2: 9_372_610, density:  36, continent: "North America" },
      { country: "Indonesia",    population:   279_476_000, area_km2: 1_904_569, density: 147, continent: "Asia"          },
      { country: "Pakistan",     population:   245_209_000, area_km2:   881_913, density: 278, continent: "Asia"          },
      { country: "Brazil",       population:   216_422_000, area_km2: 8_515_767, density:  25, continent: "South America" },
      { country: "Nigeria",      population:   229_152_000, area_km2:   923_768, density: 248, continent: "Africa"        },
      { country: "Bangladesh",   population:   173_562_000, area_km2:   147_570, density: 1176, continent: "Asia"         },
      { country: "Russia",       population:   143_957_000, area_km2: 17_098_242, density:   8, continent: "Europe"       },
      { country: "Ethiopia",     population:   126_527_000, area_km2: 1_104_300, density: 115, continent: "Africa"        },
      { country: "Mexico",       population:   129_875_000, area_km2: 1_964_375, density:  66, continent: "North America" },
      { country: "Japan",        population:   123_595_000, area_km2:   377_930, density: 327, continent: "Asia"          },
      { country: "Philippines",  population:   117_337_000, area_km2:   300_000, density: 391, continent: "Asia"          },
      { country: "DR Congo",     population:   102_262_000, area_km2: 2_344_858, density:  44, continent: "Africa"        },
      { country: "Egypt",        population:   107_770_000, area_km2: 1_002_450, density: 107, continent: "Africa"        },
    ],
  },
  "6": {
    rows: [
      { number:  1, symbol: "H",  name: "Hydrogen",   weight:   1.008, group:  1, period: 1, state: "Gas"     },
      { number:  2, symbol: "He", name: "Helium",     weight:   4.003, group: 18, period: 1, state: "Gas"     },
      { number:  3, symbol: "Li", name: "Lithium",    weight:   6.941, group:  1, period: 2, state: "Solid"   },
      { number:  4, symbol: "Be", name: "Beryllium",  weight:   9.012, group:  2, period: 2, state: "Solid"   },
      { number:  5, symbol: "B",  name: "Boron",      weight:  10.811, group: 13, period: 2, state: "Solid"   },
      { number:  6, symbol: "C",  name: "Carbon",     weight:  12.011, group: 14, period: 2, state: "Solid"   },
      { number:  7, symbol: "N",  name: "Nitrogen",   weight:  14.007, group: 15, period: 2, state: "Gas"     },
      { number:  8, symbol: "O",  name: "Oxygen",     weight:  15.999, group: 16, period: 2, state: "Gas"     },
      { number:  9, symbol: "F",  name: "Fluorine",   weight:  18.998, group: 17, period: 2, state: "Gas"     },
      { number: 10, symbol: "Ne", name: "Neon",       weight:  20.180, group: 18, period: 2, state: "Gas"     },
      { number: 11, symbol: "Na", name: "Sodium",     weight:  22.990, group:  1, period: 3, state: "Solid"   },
      { number: 12, symbol: "Mg", name: "Magnesium",  weight:  24.305, group:  2, period: 3, state: "Solid"   },
      { number: 13, symbol: "Al", name: "Aluminum",   weight:  26.982, group: 13, period: 3, state: "Solid"   },
      { number: 14, symbol: "Si", name: "Silicon",    weight:  28.086, group: 14, period: 3, state: "Solid"   },
      { number: 15, symbol: "P",  name: "Phosphorus", weight:  30.974, group: 15, period: 3, state: "Solid"   },
      { number: 16, symbol: "S",  name: "Sulfur",     weight:  32.065, group: 16, period: 3, state: "Solid"   },
      { number: 17, symbol: "Cl", name: "Chlorine",   weight:  35.453, group: 17, period: 3, state: "Gas"     },
      { number: 18, symbol: "Ar", name: "Argon",      weight:  39.948, group: 18, period: 3, state: "Gas"     },
      { number: 26, symbol: "Fe", name: "Iron",       weight:  55.845, group:  8, period: 4, state: "Solid"   },
      { number: 29, symbol: "Cu", name: "Copper",     weight:  63.546, group: 11, period: 4, state: "Solid"   },
      { number: 30, symbol: "Zn", name: "Zinc",       weight:  65.380, group: 12, period: 4, state: "Solid"   },
      { number: 47, symbol: "Ag", name: "Silver",     weight: 107.868, group: 11, period: 5, state: "Solid"   },
      { number: 79, symbol: "Au", name: "Gold",       weight: 196.967, group: 11, period: 6, state: "Solid"   },
      { number: 80, symbol: "Hg", name: "Mercury",    weight: 200.590, group: 12, period: 6, state: "Liquid"  },
      { number: 82, symbol: "Pb", name: "Lead",       weight: 207.200, group: 14, period: 6, state: "Solid"   },
      { number: 92, symbol: "U",  name: "Uranium",    weight: 238.029, group:  3, period: 7, state: "Solid"   },
    ],
  },
};

// Fallback for tables without sample data
function makeFallbackData(meta: TableMeta): { schema: TableSchema; data: TableData } {
  return {
    schema: { columns: [{ key: "note", label: "Note", type: "string" }] },
    data: { rows: [{ note: "Sample data not yet available for this table." }] },
  };
}

export function getTableMeta(id: string): TableMeta | null {
  return SAMPLE_TABLES.find((t) => t.id === id) ?? null;
}

export function getTableSchema(id: string): TableSchema {
  return SCHEMAS[id] ?? makeFallbackData(SAMPLE_TABLES.find((t) => t.id === id)!).schema;
}

export function getTableData(id: string): TableData {
  return DATA[id] ?? makeFallbackData(SAMPLE_TABLES.find((t) => t.id === id)!).data;
}
