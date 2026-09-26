# UPI — Uday's Product Interface
### Plan for a game-style 3D portfolio for Uday Kiran Bokka, Technical Product Manager

---

## 1. Source facts (what the site claims)

Sources: the March 2024 resume PDF plus the notes Uday wrote for this project. LinkedIn blocks automated reads (HTTP 999), so nothing here came from it. Every claim on the site comes from one of those two sources. **No metrics are made up.** Where Uday gave no number, the copy stays qualitative.

| Area | Facts |
|---|---|
| Identity | Uday Kiran Bokka · from Hyderabad, Telangana · lives in Mumbai |
| Current | ICICI Bank, Technical Product Manager (BA + PM hybrid), joined 26 Jun 2024, Mumbai |
| Products owned | Corporates & Reports Dashboard (Power BI) · E-Circulars · Branch Network (APIs + dashboard) · Compliance Certificates (COMP1→COMP4 escalation) · HR4U (HR + Payroll) |
| Stack | Legacy .NET, .NET Core, Web APIs, MS SQL Server, Power BI, microservice API integration, email + MS Teams alerting |
| Ways of working | Agile/Scrum. Runs scrum calls, deadlines, progress updates, retros and team activities. Owns requirements, feasibility and timelines, and gets work done through developers |
| Earlier | Jarvis Technology & Strategy Consulting, SDE (Jun–Jul 2023, NCR) · Gupshup, SDE Intern (May–Nov 2022, Mumbai): Journey Builder localization, React Testing Library, WhatsApp Scheduler on the WhatsApp Business API · Verzeo, SDE Intern (May–Jun 2021, Bengaluru) |
| Education | IIT Dharwad, B.Tech CSE, 2019–2023 |
| Campus | Hostel Secretary (2nd year) · Secretary, Photography & Films Club (2021–22) and lead photographer for PARSEC · PR Coordinator, CDC · SMP mentor · Inter IIT Cultural Meet 5.0 (IIT Madras) Group Dance · core member of the Dance and Cricket clubs |
| Side builds | MERN Todo app (live) · Geolocation Weather app (live) · WhatsApp Scheduler (Spring Boot, MySQL, JUnit) |
| Hobbies | Photography, Cricket, Coding |
| Also | Hands-on with AI tools (Claude, ChatGPT) · Industries: Fintech, Payments, Banking, HR-tech |

---

## 2. Concepts considered

Research inputs: game-like portfolios such as Bruno Simon's drivable world, Jordan Breton's floating island and circuit-style Minecraft portfolios, which point to low-poly styling, guided paths and collectibles as the pattern that keeps people engaged. The theme is Indian payments rails. A UPI payment goes App → PSP → NPCI → Remitter bank (debit) → Beneficiary bank (credit) → Settlement.

| # | Concept | Verdict |
|---|---|---|
| A | **UPI Rail Runner.** The visitor *is* a payment moving along NPCI-style rails from Hyderabad to Mumbai. Each career step is a clearing node. | ✅ **Chosen.** It fits a fintech TPM, it has clear progress (payment states), it's easy to play in one hand and it's unique. |
| B | Mumbai Local line map: stations as milestones | Good for navigation but passive. **Folded into A** as the route bar. |
| C | Vault heist: each project cracks one digit of a vault code | Fun, but "heist" is the wrong tone for a compliance/banking PM |
| D | Branch city builder (isometric SimCity-lite) | Heavy to build and slow to reveal info |
| E | ATM arcade (insert card, pick menu options) | Kitschy, and it has no journey or progress arc |
| F | Paper-plane flyer | Excluded by the brief |

### Why A works for a TPM
- **Progress is the story.** The status stepper *Initiated → KYC Verified → Authorized → Processing → Settled* reads as a career arc.
- **Obstacles are PM enemies.** *Scope Creep, Prod Bug, Blocker, Missed SLA*. Collectibles are **skills** credited to a "Skill Wallet".
- **Mini-games show real work.** They simulate what Uday actually ships: a Power BI refresh that fails and fires Email and Teams alerts, a COMP1→COMP4 compliance escalation and an HR4U onboarding flow.
- **A recruiter escape hatch.** *Passbook mode* is the whole résumé as a bank statement that can be printed or saved as a PDF. It is also the no-WebGL fallback.

---

## 3. Game design

### Loop
1. **Boot:** a UPI-app-style "Pay" screen. Payer: *Uday Kiran Bokka*, payee: *Your Team*, amount: *₹ ∞ value*. Pressing **PAY** fills a 4-dot PIN animation, then the camera dives into the world.
2. **Run:** a glowing ₹ coin auto-runs on a 3-lane neon rail.
   - ←/→ (A/D, or swipe) switches lanes.
   - Holding Space/↑ (or the ⚡ button) boosts.
   - Skill coins add ₹ "Value Settled". Obstacles cost value and shake the screen. You never lose.
3. **Node:** passing a gate docks the coin and the camera orbits that station's 3D landmark. A **Transaction Receipt** card slides in with the content, and some cards include a mini-game. Enter or **Continue** resumes the run.
4. **Streaks:** 6 coins without a hit gives a "SIX! 🏏" toast (a cricket nod) and bonus value.
5. **Settlement:** the Mumbai sea-link finale ends on a "Payment Successful" receipt showing value, skills, time, contact links and Replay.

### Nodes (11)
| # | Node | Status | Landmark (procedural low-poly) | Interaction |
|---|---|---|---|---|
| 0 | Hyderabad (origin) | Initiated | Charminar | Intro + controls |
| 1 | IIT Dharwad | KYC Verified | Campus block + floating grad cap | Campus life chips |
| 2 | Builder Years | Authorized | Chat bubble + scheduler clock | Internships + live side builds |
| 3 | ICICI Bank | Processing | Glass tower + spinning vault door | Role overview + stat tiles |
| 4 | Corporates & Reports Dashboard | Processing | Animated 3D bar chart | **Refresh simulator** (API → merge → model → publish → alert) |
| 5 | E-Circulars | Processing | Orbiting circulars + bell | Module list |
| 6 | Branch Network | Processing | Pin network → API core with pulses | API consumer diagram |
| 7 | Compliance Certificates | Processing | 4-tier ziggurat, COMP1–4 | **Escalation simulator** |
| 8 | HR4U | Processing | ID card + payroll coin stack | **Onboarding flow** stepper |
| 9 | Agile HQ | Processing | Rotating sprint loop + kanban | Ways of working + AI tools |
| 10 | Mumbai | Settled | Bandra–Worli sea link + giant ✓ | Final receipt + contact |

### HUD
- Top left: brand, UTR id, 5-step status stepper.
- Top right: ₹ Value Settled (Indian digit grouping), Skill Wallet count, sound, passbook and help.
- Bottom: a Mumbai-local-style **route bar**. Clicking any station fast-travels there, for impatient recruiters.
- Mobile: lane buttons and a ⚡ boost button, and cards become bottom sheets.

---

## 4. Visual direction
- **Palette:** "tricolor neon on midnight".
  - Background: midnight `#070A18` / `#0D1230`.
  - Saffron `#FF9933`.
  - Mint-green `#19E3B1`.
  - Signal white `#F4F6FF`.
  - Accents: gold ₹ `#FFC94D` and alert pink `#FF3D71`.
  - It reads as Indian fintech without copying any bank's brand. The site uses no ICICI logos or brand marks, only the employer's name as text.
- **Type:** Unbounded (display, game-like) · Space Grotesk (body) · JetBrains Mono (HUD/receipts).
- **World:** gradient sky dome, fogged grid ground, instanced night-city blocks with lit windows, star particles, animated dash shaders on the rail lanes and a coin trail.

## 5. Tech architecture
- **Vite + vanilla JS + Three.js from npm.** Tree-shaken, one bundle, static output in `dist/`, deployable on Vercel, Netlify or GitHub Pages.
- **No external 3D models.** Every landmark is built from primitives in code: zero model downloads and tiny payloads.

```
index.html              DOM: boot, HUD, route bar, card, passbook, final
src/data.js             ALL content (edit here)
src/main.js             boot, state machine, game loop
src/world/scene.js      renderer, sky, fog, lights, ground, stars, city
src/world/track.js      curve, rail meshes, lane shader, gates
src/world/landmarks.js  11 procedural landmark builders
src/world/player.js     coin + ring + trail
src/world/pickups.js    skill coins / obstacles, collisions
src/world/labels.js     canvas-texture text sprites
src/ui/*.js             hud, cards (+ mini-games), passbook, audio, input, icons
src/style.css           design tokens, layout, responsive
```

## 6. Performance budget
- JS under ~200 KB gzipped (mostly Three.js). No textures over the network. Fonts via Google Fonts with `display=swap`.
- Pixel ratio capped at 1.5 (1.0 on low-end or mobile). No shadow maps and no post-processing: glow is faked with additive sprites.
- Instanced city (1 draw call). Frames are skipped while the tab is hidden, and landmark animation only runs near the camera.
- `prefers-reduced-motion`: no shake, slower camera. No WebGL: the Passbook opens automatically.

## 7. Accessibility and SEO
- The whole résumé is real, semantic HTML in the Passbook. The page has a meta description, OG tags and a JSON-LD `Person` record.
- Everything works from the keyboard, and dialogs have focus and ARIA labels.

## 8. Deploy
```bash
npm install
npm run dev      # local
npm run build    # outputs dist/
```
Drag `dist/` into Netlify, or `vercel --prod`.

## 9. Later ideas
- A real photo gallery node (Uday's photography).
- Optional GLTF Charminar and sea-link models once the look is locked. Keep each under 300 KB with Draco.
- Analytics on nodes reached (a PM measures the funnel).
