# UPI — Uday's Product Interface

This is the portfolio of **Uday Kiran Bokka**, Technical Product Manager at ICICI Bank. It plays like a game: you ride a ₹ coin along a neon payment rail from Hyderabad to Mumbai and unlock a career node at each stop.

The concept and full design are in [PLAN.md](PLAN.md).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Adding `?start` to the URL skips the pay screen.

## Build and deploy

```bash
npm run build
```

This writes a static site to `dist/`. Any static host works:

- **Netlify:** drag the `dist/` folder onto app.netlify.com/drop.
- **Vercel:** run `npx vercel --prod`, or import the repo; the framework is auto-detected as Vite.
- **GitHub Pages:** push `dist/`. The build uses relative asset paths (`base: './'`).

## Edit content

All text lives in **`src/data.js`**: profile, the 11 nodes, skill coins and obstacles. The game, receipt cards and Passbook résumé are all generated from it.

- Leave `PROFILE.phone` as `null` to keep your number off the public site, or set it to show a call button.
- Each node's `landmark` picks its 3D model from `src/world/landmarks.js`.

## Structure

```
src/main.js              game state machine, camera, loop
src/data.js              all content
src/world/scene.js       renderer, sky, grid ground, stars, instanced city
src/world/track.js       rail curve, deck shader, barriers, portal gates
src/world/landmarks.js   11 procedural landmarks (no model files)
src/world/player.js      ₹ coin + trail
src/world/pickups.js     skill coins + PM obstacles
src/ui/*                 HUD, receipt cards + mini-games, passbook, audio, input, icons
test/*.html              dev-only harnesses (landmarks gallery, UI cards)
```

Dev-only test pages:

- `/test/landmarks.html?key=charminar`
- `/test/ui.html?node=4`

## Controls

| Action | Keys |
|---|---|
| Switch lane | ← / → (or A / D) |
| Boost | Space / ↑ (hold) |
| Continue | Enter |
| Passbook | P |
| Sound | S |
| Help | H |
| Fast-travel | Click a station on the route bar |

On a phone, swipe left or right to switch lanes and hold ⚡ to boost.
