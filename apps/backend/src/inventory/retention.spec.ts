import { retentionFloor } from './retention';

const NORMAL = { disasterLevel: 1, retentionLowered: false };
const LOWERED = { disasterLevel: 5, retentionLowered: true };

// Dotations et minimums recopiés tels quels de l'annexe « Kaiju Rules »,
// colonnes A, E, W, X, Z
const ANNEX: Record<string, { initial: number[]; minimum: number[] }> = {
  'Medical personnel': { initial: [12, 5, 8, 3, 7], minimum: [4, 2, 3, 1, 3] },
  'Rescue teams': { initial: [4, 9, 3, 6, 5], minimum: [2, 3, 1, 2, 2] },
  'Transport vehicles': { initial: [6, 3, 10, 4, 7], minimum: [2, 1, 3, 2, 3] },
  'Emergency shelters': { initial: [8, 6, 4, 10, 2], minimum: [3, 2, 2, 3, 1] },
  'Food & water supplies': { initial: [5, 8, 6, 7, 9], minimum: [2, 3, 2, 3, 3] },
  'Communication equipment': { initial: [3, 7, 5, 8, 4], minimum: [1, 3, 2, 3, 2] },
  'Power generators': { initial: [7, 2, 9, 5, 6], minimum: [3, 1, 3, 2, 2] },
  'Engineering crews': { initial: [2, 6, 7, 4, 8], minimum: [1, 2, 3, 2, 3] },
  'Security units': { initial: [9, 4, 2, 6, 3], minimum: [3, 2, 1, 2, 1] },
  'Hazmat equipment': { initial: [3, 5, 4, 2, 10], minimum: [1, 2, 2, 1, 3] },
};

const CASES = Object.entries(ANNEX).flatMap(([resource, { initial, minimum }]) =>
  ['A', 'E', 'W', 'X', 'Z'].map((quarter, index) => ({
    resource,
    quarter,
    initial: initial[index],
    minimum: minimum[index],
  })),
);

describe('retentionFloor', () => {
  it.each(CASES)(
    '$resource dans $quarter : $initial unités, en garde $minimum',
    ({ initial, minimum }) => {
      expect(retentionFloor(initial, NORMAL)).toBe(minimum);
    },
  );

  it('descend à 15 % quand le CD a abaissé la rétention au niveau 5', () => {
    expect(retentionFloor(12, LOWERED)).toBe(2);
    expect(retentionFloor(10, LOWERED)).toBe(2);
  });

  it('ignore le drapeau si le quartier est redescendu sous le niveau 5', () => {
    expect(retentionFloor(12, { disasterLevel: 4, retentionLowered: true })).toBe(4);
  });
});
