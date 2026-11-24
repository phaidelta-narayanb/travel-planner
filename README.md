# EzMyGo

**Easy does it. Let's go.** An offline-first travel planner built with React, TypeScript, Vite, and VitePWA.

App name, tagline, and page metadata are centralized in `src/config.ts`.

```powershell
yarn
yarn dev
```

The app is usable without an account and stores trips and plans in browser local storage. To connect the sync service, start the API and use **Sync now** to register or sign in. Set `VITE_API_URL` in a `.env` file when the API is hosted somewhere other than `http://localhost:8000`.

```powershell
yarn build
yarn preview
```

## Navigation diagram (not implemented yet)

```mermaid
flowchart LR
    subgraph TabBar
        Calendar <-->|Tab click| Timeline
        Calendar <-->|Tab click| MT(My trips)
        Timeline <-->|Tab click| MT
        MT -->|Navigate Back| Calendar
        Timeline -->|Navigate Back| Calendar
    end

    Start([Start]) -->|Homepage| Calendar
    Calendar -->|Navigate Back| Close([Close app])

    MT -->|Edit trip details| EYT(Edit your trip)
    MT -->|Click on a trip| YTP(Your trip plan)
    YTP -->|Edit itinerary| MIYO(Make it your own)
 
    EYT -->|Tab click| TabBar
    YTP -->|Tab click| TabBar
    MIYO -->|Tab click| TabBar

    Calendar <-->|Click on event| ALA[A little adjustment modal] -->|Edit plan| YTP

    MIYO -->|Navigate Back| YTP
    YTP -->|Navigate Back| MT
    EYT -->|Navigate Back| MT
```
