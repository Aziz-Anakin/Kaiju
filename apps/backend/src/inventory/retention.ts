export interface RetentionState {
  disasterLevel: number;
  retentionLowered: boolean;
}

// 30 % de la dotation initiale, arrondis au supérieur. Le City Director peut
// ramener ce plancher à 15 %, mais seulement tant que le quartier est au
// niveau 5 : le drapeau seul ne suffit pas, sinon il survivrait à la crise.
// Le calcul se fait en entiers pour ne dépendre d'aucun arrondi flottant.
export function retentionFloor(
  initialQuantity: number,
  quarter: RetentionState,
): number {
  const percent =
    quarter.retentionLowered && quarter.disasterLevel === 5 ? 15 : 30;

  return Math.ceil((initialQuantity * percent) / 100);
}
