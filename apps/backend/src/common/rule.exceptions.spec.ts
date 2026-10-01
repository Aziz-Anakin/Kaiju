import { HttpException } from '@nestjs/common';
import {
  AdjacencyException,
  PermissionException,
  RetentionException,
} from './rule.exceptions';

const RULES: [string, HttpException, number, string][] = [
  ['permission', new PermissionException('interdit'), 403, 'permission'],
  ['adjacence', new AdjacencyException('pas voisins'), 422, 'adjacency'],
  ['rétention', new RetentionException('verrouillé'), 423, 'retention'],
];

describe('Exceptions de règle', () => {
  it.each(RULES)(
    'la règle de %s répond %i et se nomme dans la réponse',
    (_label, exception, status, rule) => {
      expect(exception.getStatus()).toBe(status);
      expect(exception.getResponse()).toMatchObject({ rule });
    },
  );

  it('garde un message lisible pour le frontend', () => {
    const exception = new RetentionException('Rétention : garder 4 unités');

    expect(exception.message).toBe('Rétention : garder 4 unités');
    expect(exception.getResponse()).toMatchObject({
      message: 'Rétention : garder 4 unités',
    });
  });

  it('donne un code différent à chaque règle', () => {
    const statuses = RULES.map(([, exception]) => exception.getStatus());

    expect(new Set(statuses).size).toBe(RULES.length);
  });
});
