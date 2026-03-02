---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.vue"
  - "**/*.js"
---

# Frontend Security Rules

## Mandatory Checks Before Commit

- [ ] No hardcoded secrets (API keys, tokens, passwords)
- [ ] All user inputs validated (Zod at API boundaries)
- [ ] No `v-html` with unsanitized user content (XSS vector)
- [ ] No `innerHTML` or `document.write` with dynamic data
- [ ] Auth tokens stored securely (httpOnly cookies preferred, not localStorage)
- [ ] Error messages don't leak internal details to users
- [ ] Sensitive routes have proper navigation guards

## Secret Management

```typescript
// NEVER: Hardcoded secrets
const apiKey = 'sk-xxxxx'

// CORRECT: Environment variables with VITE_ prefix
const apiUrl = import.meta.env.VITE_API_BASE_URL

// CORRECT: Validate at startup
if (!import.meta.env.VITE_API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL is required')
}
```

Remember: `VITE_` prefixed env vars are embedded in the client bundle and visible to users. Never put true secrets in frontend env vars.

## XSS Prevention

```vue
<!-- WRONG: Direct HTML rendering of user content -->
<div v-html="userComment" />

<!-- CORRECT: Text interpolation (auto-escaped) -->
<div>{{ userComment }}</div>

<!-- CORRECT: If HTML is needed, sanitize first -->
<div v-html="DOMPurify.sanitize(userComment)" />
```

## Input Validation

Validate all external data at system boundaries:

```typescript
import { z } from 'zod'

// Validate API responses
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'user', 'viewer']),
})

// Validate form inputs
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
```

Never trust data from:
- URL parameters / query strings
- API responses (could be tampered)
- localStorage / sessionStorage
- postMessage events

## Authentication & Authorization

- Check auth state in Vue Router navigation guards
- Verify permissions before rendering sensitive UI (not just hiding with v-if)
- Clear all auth state on logout (stores, cookies, cached data)
- Handle token expiration gracefully (redirect to login, not error page)

## Dependencies

- Review new dependencies for known vulnerabilities before installing
- Prefer well-maintained packages with active security patch history
- Pin dependency versions in production builds
- Never install packages from untrusted sources

## Security Response Protocol

If a security issue is discovered:
1. STOP current work immediately
2. Assess severity (CRITICAL / HIGH / MEDIUM / LOW)
3. Fix CRITICAL and HIGH issues before continuing any other work
4. Check codebase for similar patterns
5. Document the fix and prevention strategy
