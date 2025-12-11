# Soul Engine UI

The interface for the Soul Engine chat debugger.

## Hosted demos

Demos are hosted under https://souls.chat/s/demo-id using a reverse proxy to the actual demo. The demo code is usually store in the community repository.

### Configuring a new hosted demo

1. Add a new rewrite rule to `next.config.mjs` in this repository.
2. Copy these files to your project folder in the community repository: [next.config.mjs](https://github.com/opensouls/community/blob/main/demos/nextjs/cranky/web/next.config.mjs) and [middleware.ts](https://github.com/opensouls/community/blob/main/demos/nextjs/cranky/web/app/middleware.ts).
3. Deploy your project to Vercel, making sure you set the root directory to the correct folder in your project containing the Next.js app.
4. Configure the following environment variables in Vercel (tip: you can paste this entire block there):
```
NEXT_PUBLIC_ASSET_BASE_URL="https://souls.chat/s/opensouls/<your-project-id>"
ASSET_PREFIX_FOR_PROXY="/s/opensouls/<your-project-id>/"
CORS_RESTRICT_ORIGIN="https://souls.chat"
NEXT_PUBLIC_SOUL_ENGINE_BLUEPRINT="blueprint id"
NEXT_PUBLIC_SOUL_ENGINE_ORGANIZATION="organization id"
```
5. If you have images in your project, you might need to add a `getAssetPath` helper function like [this one](https://github.com/opensouls/community/blob/main/demos/nextjs/cranky/web/lib/assets.ts) and use that so the images are proxied correctly. If you see a bunch of 404s in the console, this is likely the issue.
6. Make sure you have all the metadata properly configured in your project: favicon, title, description, og image.
7. Make sure the ["Made with Soul Engine" badge](https://github.com/opensouls/community/blob/main/demos/nextjs/cranky/web/components/made-with-soul-engine.tsx) appears somewhere in the demo.
