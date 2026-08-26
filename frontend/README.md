# SPAS Frontend

React/Vite portal imported from the UI-only fork. It is deliberately independent
of the source fork's workspace packages so it can be installed from this repo.

## Run

```bash
npm install
npm run dev
```

## Backend integration

The portal currently calls relative `/api/*` endpoints. Configure the Vite
development proxy or serve the built files behind the backend after the team
aligns endpoint paths and response schemas with the UI contract.
