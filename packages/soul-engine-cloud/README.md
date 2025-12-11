# Soul Engine

Proprietary server for running user defined souls

## Running locally

### Install Docker & Bun
- [Docker Desktop](https://docs.docker.com/desktop/)
- [Bun](https://bun.sh/docs/installation)

### Secrets
Both `soul-engine` and `soul-engine-ui` require some secrets to work, you can check the .env.example in each of those repos for necessary values.
`soul-engine-ui` uses env from `.env.local` and `soul-engine-cloud` from `.env`

### Run soul-engine-cloud
```bash
# install
bun i 
bun run prisma:generate

# run 
bunx supabase start # if necessary, after computer restarts or docker quits
bunx supabase db reset # if the database migrations or the seeds.sql has changed then you need to do this in the soul-engine.
bun run dev
```

### Run soul-engine-ui
```bash
bun i
bun run dev
```

### samantha-learns
```bash
bun i
bunx soul-engine dev --local
```

### Authorization
After logging in, open the Supabase Editor and add your username to the `allowed_github_usernames` table.
[Supabase Table Editor](http://localhost:54323/project/default/editor)



