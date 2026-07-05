# EN internal area mapping pack

Источник: `english.zip`, файл `[leveltracker] areas 2.json`.

## Что это даёт

Этот файл закрывает нормальный mapping для EN-клиента по строкам лога вида:

```text
Generating level 42 area "G4_5_1" with seed 123456789
```

Теперь internal id должен вести в текущий `guide.json`, а UI должен показывать русское имя из `guide.zone_ru`.

## Главный файл

Положить/заменить:

```text
src/data/internal-area-aliases.en.json
```

из файла:

```text
internal-area-aliases.en.json
```

## Важная правка Act 1

В раннем beta-маппинге Act 1 были ошибки. По `[leveltracker] areas 2.json` правильно так:

```text
G1_5  -> Red Vale / Красная Долина
G1_6  -> Grim Tangle / Мрачные заросли
G1_8  -> Mausoleum of the Praetor / Мавзолей претора
G1_9  -> Tomb of the Consort / Супружеская гробница
G1_11 -> Hunting Grounds / Охотничьи угодья
G1_12 -> Freythorn / Фрейторн
```

## Smoke tests

Вставлять через live-helper:

```text
Generating level 41 area "G4_2_1" with seed 123456789
```
Ожидание: `АКТ 4 · Кеджский залив`.

```text
Generating level 42 area "G4_3_2" with seed 123456789
```
Ожидание: `АКТ 4 · Поющие пещеры`.

```text
Generating level 45 area "G4_4_1" with seed 123456789
```
Ожидание: `АКТ 4 · Глаз Хинекоры`.

```text
Generating level 47 area "G4_11_1b" with seed 123456789
```
Ожидание: `АКТ 4 · Нгакану`.

```text
Generating level 48 area "P2_5" with seed 123456789
```
Ожидание: `АКТ 5 · Врата Голай`.

```text
Generating level 52 area "P2_6" with seed 123456789
```
Ожидание: `АКТ 5 · Кима`.

```text
Generating level 55 area "P3_3" with seed 123456789
```
Ожидание: `АКТ 5 · Ледниковое озеро`.

```text
Generating level 56 area "P1_3" with seed 123456789
```
Ожидание: `АКТ 5 · Чёрный лес`.

## Замечания

`internal-area-aliases.en.json` — практический вариант. Он маппит некоторые промежуточные EN-зоны в ближайшие карточки текущего guide.json, потому что в нашем гайде не каждая EN-зона вынесена отдельной карточкой.

`internal-area-aliases.en.conservative.json` — более осторожный вариант: меньше покрытия, зато меньше route-collapsing.
