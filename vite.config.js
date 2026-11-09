
import { defineConfig } from 'vite'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const localHandlers = {
  '/api/list-users': () => import('./api/list-users.js'),
  '/api/neis-meals': () => import('./api/neis-meals.js'),
  '/api/delete-user': () => import('./api/delete-user.js'),
  '/api/daily-maintenance': () => import('./api/daily-maintenance.js'),
  '/api/generate-fortune': () => import('./api/generate-fortune.js')
}

function localApiPlugin() {
  return {
    name: 'classroom-hub-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname
        const loadHandler = localHandlers[pathname]
        if (!loadHandler) return next()

        const env = loadEnv(server.config.mode, process.cwd(), '')
        for (const key of ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'NEIS_API_KEY', 'GEMINI_API_KEY', 'CRON_SECRET']) {
          if (env[key]) process.env[key] = env[key]
        }
        process.env.SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || process.env.SUPABASE_URL

        req.query = Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams.entries())
        res.status = (status) => { res.statusCode = status; return res }
        res.json = (body) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(body))
        }

        try {
          if (req.method !== 'GET' && req.headers['content-type']?.includes('application/json')) {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const rawBody = Buffer.concat(chunks).toString('utf8')
            req.body = rawBody ? JSON.parse(rawBody) : {}
          }
          const { default: handler } = await loadHandler()
          await handler(req, res)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: error.message || '로컬 API 처리에 실패했습니다.' }))
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), localApiPlugin()],
})
