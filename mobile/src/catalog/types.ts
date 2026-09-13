// Shape of catalog.generated.ts, produced by ../../../catalog/build-catalog.mjs
// from Rebrickable's public data dumps. Edit catalog/curated.json, not this.

/** Kid-facing visual shape. The UI knows how to draw exactly these. */
export type PartFamily = 'brick' | 'short' | 'plate' | 'slope' | 'curve' | 'wheel' | 'axle';

/** Kid-facing color word. The first seven are the original Algo palette. */
export type KidColor =
  | 'blue' | 'red' | 'yellow' | 'green' | 'white' | 'black' | 'gray'
  | 'darkgray' | 'orange' | 'lime' | 'tan' | 'brown' | 'darkblue' | 'darkgreen'
  | 'darkred' | 'azure' | 'pink' | 'purple' | 'lightorange';

export type CatalogFamily = { id: PartFamily; label: string; hint: string };

export type CatalogColor = {
  /** Rebrickable color id (matches LDraw ids for the classic colors). */
  id: number;
  kid: KidColor;
  /** Official color name, e.g. "Light Bluish Gray". */
  name: string;
  /** Six hex digits, no '#'. */
  rgb: string;
  transparent: boolean;
  years: [number | null, number | null];
};

export type CatalogPart = {
  /** Rebrickable / LEGO design number, e.g. "3001". */
  partNum: string;
  /** Official Rebrickable name, e.g. "Brick 2 x 4". */
  name: string;
  category: string | null;
  material: string;
  family: PartFamily;
  /** What Algo says out loud, e.g. "2 × 4 brick". */
  kidName: string;
  /** Stud dimensions parsed from the name, when present. */
  size: string[] | null;
  /** Color ids this part was actually produced in (subset of the palette). */
  colors: number[];
  /** color id -> LEGO element id for that part+color combination. */
  elements: Record<string, string>;
};

export type Catalog = {
  schemaVersion: 1;
  generatedAt: string;
  source: {
    name: string;
    url: string;
    attribution: string;
    tables: string[];
    rows: Record<string, number>;
  };
  families: CatalogFamily[];
  colors: CatalogColor[];
  parts: CatalogPart[];
};
