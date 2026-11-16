# GARGANTUA

Živá GPU vizualizační komponenta černé díry pro portfolio [svanda.tech](https://svanda.tech). Není to samostatná aplikace ani vědecký simulátor; jde o fyzikálně inspirované WebGL pozadí se zjednodušenou Schwarzschildovou geometrií.

## Co komponenta dělá

- numericky integruje světelné paprsky ve fragment shaderu;
- vykresluje akreční disk, hvězdné pole a post-processing přes Three.js;
- přizpůsobuje počet kroků, DPR a pixelový rozpočet mobilnímu či desktopovému zařízení;
- při `prefers-reduced-motion`, pomalých snímcích nebo nedostupném WebGL použije statický poster;
- pozastavuje renderování ve skryté kartě a ošetřuje ztrátu WebGL contextu.

## Technologie podle části

| Část | Technologie |
| --- | --- |
| Grafická pipeline | Three.js, WebGL2, post-processing |
| Shader a trasování paprsků | GLSL, ray marching |
| Odolnost a přístupnost | adaptive quality, reduced motion, poster fallback |

## Struktura

```text
public/gargantua/
├── background.html       # samostatný vstup komponenty
├── css/background.css    # fullscreen layout a fallback stavy
├── js/background.js      # Three.js pipeline, adaptivní kvalita a lifecycle
├── js/shaders.js         # ray pass a finální composite shader
├── poster.png            # statický fallback
└── vendor/               # lokálně uložené browser moduly Three.js
```

## Lokální spuštění

ES moduly vyžadují HTTP server. Z kořene portfolia spusťte:

```bash
python3 -m http.server 8000
```

Potom otevřete `http://127.0.0.1:8000/public/gargantua/background.html`.

## Co jsem se naučil

Adaptivní počet kroků a pixelový rozpočet jsou pro plynulý ray marching stejně důležité jako samotný shader. Half-float render target a volitelný bloom vyžadují vědomý kompromis mezi kvalitou a dostupností na různých GPU. Reduced-motion režim, detekce pomalých snímků a poster fallback proto patří přímo do grafického řešení, ne až do dodatečného hardeningu.

## Známé hranice

- Vizualizace není numericky ani obrazově regresně testovaná na všech GPU.
- Model není vědeckou simulací rotující černé díry.
- Složka je součástí hlavního portfolia a nemá vlastní release ani balíček.
