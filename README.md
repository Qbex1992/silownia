# Dziennik siłowni

Aplikacja PWA (instalowana z przeglądarki na Androidzie) do zapisywania treningów Push / Pull / FBW:
serie, ciężar, powtórzenia, RPE, rekordy, statystyki tygodniowe/miesięczne/półroczne/roczne,
waga, pomiary, zdjęcia sylwetki, poziomy XP, odznaki i nagrody.

Czysty HTML/CSS/JS bez kroku budowania i bez zależności. Dane zostają w telefonie (IndexedDB).

## Podgląd lokalny

```
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Otwórz http://localhost:5180/

## Import historii

Profil → Import z Excela → plik `.xlsx` z zakładkami tygodni. Plik nie ma dat, więc podajesz niedzielę
ostatniego tygodnia; wcześniejsze tygodnie są cofane co 7 dni (sobota Push, niedziela Pull, środa FBW).

## Struktura

- `js/xlsx.js` — czytnik .xlsx (ZIP + XML) bez bibliotek
- `js/importer.js` — parser arkusza, poprawki literówek, raport
- `js/stats.js` — objętość, szacowany 1RM (Epley), rekordy, okresy
- `js/game.js` — XP, poziomy, serie tygodni, odznaki, motywy
- `js/views/` — ekrany
- `sw.js` — tryb offline (najpierw sieć, potem pamięć podręczna)
- `tools/serve.ps1`, `tools/icons.ps1` — serwer podglądu i generator ikon
