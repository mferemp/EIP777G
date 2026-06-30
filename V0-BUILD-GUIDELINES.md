# V0 Build Guidelines & Practices

These guidelines document the methodologies, code practices, and architectural decisions applied during the SecureGate 777G development and audit with v0.

## Design & UI Guidelines

### Color System
- Use exactly 3-5 colors total
- 1 primary brand color + 2-3 neutrals + 1-2 accents
- If overriding component background, override text color for contrast
- Avoid gradients unless explicitly required; if needed, use analogous colors only

### Typography
- Maximum 2 font families total
- One for headings (with weight variants), one for body
- Body text line-height: 1.4-1.6 (use `leading-relaxed` or `leading-6`)
- Minimum 14px for body text, avoid decorative fonts

### Layout Structure
- Mobile-first design, enhance for larger screens
- Flexbox priority for most layouts: `flex items-center justify-between`
- CSS Grid only for complex 2D layouts
- Never use floats or absolute positioning unless absolutely necessary

### Tailwind Implementation
- Prefer spacing scale: `p-4`, `mx-2`, `py-6` (not `p-[16px]`, `mx-[8px]`)
- Use gap classes for spacing: `gap-4`, `gap-x-2`, `gap-y-6`
- Apply semantic Tailwind classes: `items-center`, `justify-between`, `text-center`
- Use responsive prefixes: `md:grid-cols-2`, `lg:text-xl`
- Wrap titles in `text-balance` or `text-pretty` for optimal line breaks
- Never mix margin/padding with gap classes on same element
- Never use space-* classes

## Code Practices

### File Editing
- Always read files before editing with the Edit tool
- Split code into multiple components — never have one large page file
- Only edit files that need to be changed
- When removing code, remove usage first, then remove imports only if no longer needed

### Data Persistence
- Default to real backend storage (Neon, Supabase, etc), NOT localStorage
- Never use localStorage unless explicitly requested
- Session-only state is acceptable for temporary UI state

### Performance & Security
- Use SWR for data fetching, caching, and client-side state sync
- Do NOT fetch inside useEffect — use RSC or SWR instead
- Implement proper Row Level Security (RLS) for databases
- Use parameterized queries to prevent SQL injection
- Implement input validation and sanitization
- Use semantic HTML elements and ARIA attributes
- Add alt text for all non-decorative images

### Debugging
- Use `console.log("[v0] ...")` statements for debugging
- Include meaningful context about what's being checked
- Remove debug statements once issue is resolved
- Examples:
  - `console.log("[v0] User data received:", userData)`
  - `console.log("[v0] Component rendered with props:", props)`
  - `console.log("[v0] Error occurred:", error.message)`

## Context Gathering & Analysis

### Broad → Specific → Verify Approach
1. **Broad search** — Find all related files using glob patterns
2. **Examine all matches** — Don't stop at first result; check variants and versions
3. **Understand full system** — Check parent components, wrappers, utilities, schemas
4. **Verify relationships** — Confirm how changes fit into broader architecture

### Key Questions Before Making Changes
- Is this the right file among multiple options?
- Does a parent/wrapper already handle this?
- Are there existing utilities/patterns I should use?
- How does this fit into the broader architecture?

### Parallel Tool Calls
- Use parallel calls for independent operations (reading 3 files, searching multiple patterns)
- Use sequential calls when later operations depend on earlier results
- Maximize efficiency by running non-blocking operations simultaneously

## Architecture Decisions

### Next.js & React
- Default to Next.js App Router (unless v15+ Pages Router explicitly required)
- Use RSC (React Server Components) where possible
- Use client-side obfuscation for sensitive logic
- Implement proper error boundaries

### Components
- Use shadcn/ui for consistent component library
- Follow existing component patterns in the codebase
- Extract reusable components early — don't duplicate logic
- Use TypeScript for type safety

### Styling
- Use Tailwind CSS as primary styling solution
- Define design tokens in `globals.css` (@theme for Tailwind v4 or tailwind.config.js for v3)
- Apply semantic token classes (bg-background, text-foreground, etc)
- Use CSS variables for theme consistency

### State Management
- Use SWR for shared client state that needs sync across components
- Use React Context for UI state (theme, modals, etc)
- Server state lives in RSC or database
- Never prop-drill deeply — extract to context or SWR

## Security Practices

### Authentication & Authorization
- Implement proper auth flow (never client-side only)
- Use session tokens with expiration
- Validate all inputs server-side
- Never store secrets in client-side code (except hashed values for client-side verification)
- Implement CSRF protection

### Data Protection
- Never log sensitive data (keys, passwords, PII)
- Use HTTPS always
- Implement proper CORS headers
- Sanitize all user input before rendering or storing
- Use Content Security Policy (CSP) headers

### API Security
- Validate request structure and types
- Implement rate limiting
- Use parameterized queries (prevent SQL injection)
- Implement proper error messages (don't leak system details)
- Authenticate all endpoints

## Code Quality

### Postambles
- After Edit/Write operations, write 2-4 sentence postamble explaining changes
- Never write more than a paragraph
- Focus on what changed and why

### Comments & Documentation
- Use comments to explain "why" not "what"
- Keep comments updated with code changes
- Remove stale comments during cleanup

### Testing
- Write tests for critical paths
- Test security boundaries
- Test error states and edge cases
- Use descriptive test names

## Git & Version Control

### Commits
- Make atomic commits (one feature/fix per commit)
- Write clear commit messages explaining what changed and why
- Include co-author trailers when appropriate
- Never force-push to main/master

### Branches
- Use feature branches for development
- Name branches descriptively: `auth-gate-tightening`, `revoke-bundler`, etc
- Keep branches up-to-date with main
- Create PRs for review before merging

## SecureGate 777G Specific

### Security Layers (DO NOT REMOVE)
- Auth-Gate lock overlay (CSS + JS enforcement)
- Backend API gates (all require token validation)
- Immutable contract binding (keccak256 genesis hash)
- JavaScript obfuscation (RC4 + Terser on gate.js + app.js)
- CSP hardening (default-src 'self' only)
- Session purge mechanics (SCRUB/ESC/idle/tab-close)
- K1 nesting (contract wraps K1, nullifies autonomous execution)
- Rate limiting + blacklist (50-attempt trap)

### Dashboard Architecture
- 20 required spec IDs must remain wired
- All auth copy must match final approved version
- No data persistence (session-only RAM only)
- No server-side access to K1/K2/K3/auth data
- All auth runs client-side in obfuscated code

### Environment Variables
- All operational keys documented in `.env.example`
- No secrets committed to repository
- `.env.local` and `.env.development.local` in `.gitignore`
- Clear commentary on which keys must stay offline (K2)

## Tools & Workflows

### File Operations
- Read files before editing (required)
- Use Edit tool for code changes
- Use Write tool for new files
- Use Delete tool to remove files
- Use Move tool with operation="copy" for duplicating

### Search & Analysis
- Use Grep for content search (ripgrep syntax)
- Use Glob for file pattern matching
- Use Bash for system commands (installations, git, etc)
- Use WebSearch for external documentation

### Debugging & Verification
- Use console.log("[v0] ...") for runtime debugging
- Use grep/bash to verify changes after edit
- Use git diff to review changes before commit
- Use git log to verify commit history

---

**Document Version:** 1.0  
**Last Updated:** SecureGate 777G Final Audit  
**Maintained by:** Empress (@Hope_ology)
