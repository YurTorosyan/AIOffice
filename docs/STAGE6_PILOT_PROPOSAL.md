# Stage 6 — предложение реального Backend Developer

Workflow: `fa179d5b-c5ab-45c7-8cfc-b6f9a21cd180`. Задание уже исполнено один раз. Ни один из этих файлов ещё не создан.

Предлагается создать только два новых файла ниже в текущем AI Office. Они добавляют проверочный модуль и не меняют офис, API, auth, зависимости или конфигурацию.

## Точный diff (оба файла новые)

### `src/team-pilot/clamp.ts`

SHA-256 нового содержимого: `57382de988b1cb60ffb050bbd733b9abfccc4f6967c89a4d702728593c04cb7f`. Исходный файл отсутствует.

```typescript
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError('clamp arguments must be finite numbers');
  }

  if (min > max) {
    throw new RangeError('clamp minimum must not exceed maximum');
  }

  if (value < min) return min;
  if (value > max) return max;
  return value;
}
```

### `tests/team-pilot-clamp.test.ts`

SHA-256 нового содержимого: `90627a74c055ff088e077c30933946d51fce095e6ae528a05971a41f7cdf862e`. Исходный файл отсутствует.

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';

import { clamp } from '../src/team-pilot/clamp.ts';

test('clamp preserves values within the inclusive range', () => {
  assert.equal(clamp(0, 0, 10), 0);
  assert.equal(clamp(10, 0, 10), 10);
  assert.equal(clamp(4, 0, 10), 4);
});

test('clamp returns the nearest bound outside the range', () => {
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test('clamp rejects every non-finite argument', () => {
  const nonFiniteValues = [NaN, Infinity, -Infinity];

  for (const nonFinite of nonFiniteValues) {
    assert.throws(() => clamp(nonFinite, 0, 10), RangeError);
    assert.throws(() => clamp(5, nonFinite, 10), RangeError);
    assert.throws(() => clamp(5, 0, nonFinite), RangeError);
  }
});

test('clamp rejects a minimum greater than the maximum', () => {
  assert.throws(() => clamp(5, 10, 0), RangeError);
});
```

## Отдельный запуск QA

После согласованного создания файлов предлагается выполнить ровно:

```text
node --experimental-strip-types --test tests/team-pilot-clamp.test.ts
```

Команда запускает только показанный выше Node test-файл. Тест использует стандартные node:test и node:assert/strict и импортирует только показанную функцию. В коде нет сетевых запросов, доступа к файлам, subprocess или credentials. Node запускается локально с минимальным окружением; это не OS sandbox.

Ожидается проверка четырёх групп: диапазон и границы; значения за пределами; NaN/±Infinity в каждом аргументе; min > max. Фактический PASS будет определён только по настоящему exit code, не по тексту модели.

Согласие относится только к этим двум новым файлам и данной команде. При изменении содержимого или scope понадобится новое подтверждение. Независимый Reviewer и Lead ещё должны оценить результат.
