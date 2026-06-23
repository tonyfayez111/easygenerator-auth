# Frontend Folder Structure

## Overview
The frontend follows a **feature-based, scalable folder structure** optimized for enterprise-level applications.

## Folder Structure

```
src/
├── 📁 routes/                          # TanStack Router file-based routing
│   ├── __root.tsx                      # Root layout
│   ├── index.tsx                       # Home redirect to /login
│   ├── _unauthenticated.tsx            # Public routes group layout
│   ├── _unauthenticated/               # Public routes (no prefix in URL)
│   │   ├── login.tsx                   # /login route
│   │   └── signup.tsx                  # /signup route
│   ├── _authenticated.tsx              # Protected routes group layout
│   ├── _authenticated/                 # Protected routes (no prefix in URL)
│   │   └── dashboard.tsx               # /dashboard route
│   └── routeTree.gen.ts                # 🔴 Auto-generated (DO NOT EDIT)
│
├── 📁 features/                        # Feature-based modules
│   └── auth/                           # Authentication feature
│       ├── components/                 # React components
│       │   ├── SignInPage.tsx          # Sign in form
│       │   ├── SignUpPage.tsx          # Sign up form
│       │   └── AppPage.tsx             # Protected dashboard
│       ├── hooks/                      # Custom React hooks
│       │   ├── useSignIn.ts            # Sign in mutation with navigation
│       │   ├── useSignUp.ts            # Sign up mutation with navigation
│       │   ├── useLogout.ts            # Logout mutation
│       │   ├── useProfile.ts           # Fetch user profile query
│       │   └── index.ts                # Barrel export
│       ├── types/                      # TypeScript types & schemas
│       │   └── auth.ts                 # Auth types and Zod schemas
│       ├── api/                        # API calls
│       │   └── authApi.ts              # Auth endpoints & error handling
│       └── index.ts                    # Barrel export
│
├── 📁 components/                      # Shared UI components
│   └── ui/                             # Reusable UI components
│       ├── buttons/                    # Button variants
│       ├── tables/                     # Table components
│       ├── badges/                     # Badge components
│       ├── icons/                      # Icon components
│       ├── selectors/                  # Dropdown/select components
│       ├── mappings/                   # Data mapping components
│       ├── ColorSchemeToggle.tsx       # Theme toggle
│       ├── ErrorComponent.tsx          # Error display
│       ├── LoaderComponent.tsx         # Loading spinner
│       ├── NotificationBell.tsx        # Notifications
│       └── index.ts                    # Barrel export
│
├── 📁 context/                         # Global context providers
│   └── AuthContext.tsx                 # Authentication state (global)
│
├── 📁 api/                             # API utilities & configuration
│   ├── axios.ts                        # Axios instance with interceptors
│   └── types.ts                        # API type definitions
│
├── 📁 lib/                             # Core libraries & utilities
│   ├── queryClient.ts                  # TanStack Query config
│   ├── router.ts                       # Router instance & config
│   └── index.ts                        # Barrel export
│
├── 📁 utils/                           # General utilities & helpers
│   ├── urlHelper.ts                    # URL manipulation
│   ├── formatters.ts                   # Data formatting
│   └── index.ts                        # Barrel export
│
├── 📁 services/                        # Core business logic services
│   └── entity.service.ts               # Generic service
│
├── 📁 styles/                          # Theme & global styles
│   ├── index.css                       # Global styles
│   └── tailwind.css                    # Tailwind directives
│
├── 📁 types/                           # Global TypeScript types
│   └── index.ts                        # Global type exports
│
├── 📁 assets/                          # Static assets
│   └── css/                            # CSS assets
│
├── env.ts                              # Environment variables (typed)
├── App.tsx                             # App root (providers & router)
├── main.tsx                            # React entry point
└── routeTree.gen.ts                    # 🔴 Auto-generated route tree
```

## Key Concepts

### Route Groups (Underscore Prefix)
- `_unauthenticated.tsx` - Layout for public routes (no URL segment)
  - Routes: `/login`, `/signup`
- `_authenticated.tsx` - Layout for protected routes (no URL segment)
  - Routes: `/dashboard`

### Feature Folders
Each feature (like `auth`) contains:
- **components/** - UI presentation layers
- **hooks/** - Custom hooks with business logic
- **types/** - TypeScript types and Zod schemas
- **api/** - API function calls
- **index.ts** - Convenient barrel exports

### Shared Resources
- **components/ui/** - Reusable UI components (buttons, tables, etc.)
- **lib/** - Core libraries (router config, query client)
- **utils/** - Utility functions (formatters, helpers)
- **context/** - Global state providers

## Usage Examples

### Importing from Features
```typescript
// Import components, hooks, and types from auth feature
import { 
  SignInPage, 
  useSignIn, 
  useProfile,
  signInSchema 
} from '@/features/auth';
```

### Importing Shared Components
```typescript
// Import from shared UI components
import { Button } from '@/components/ui/buttons';
```

### Using Environment Variables
```typescript
import { ENV } from '@/env';
console.log(ENV.API_URL);
```

## Adding a New Feature

1. **Create feature folder:**
   ```
   src/features/myfeature/
   ├── components/
   ├── hooks/
   ├── types/
   ├── api/
   └── index.ts
   ```

2. **Create barrel export (index.ts):**
   ```typescript
   export { MyComponent } from './components/MyComponent';
   export { useMyHook } from './hooks/useMyHook';
   export type { MyType } from './types/myFeature';
   ```

3. **Use in routes:**
   ```typescript
   import { MyComponent } from '@/features/myfeature';
   ```

## File Naming Conventions

- **Components:** PascalCase (e.g., `SignInPage.tsx`)
- **Hooks:** camelCase with `use` prefix (e.g., `useSignIn.ts`)
- **Types:** camelCase (e.g., `auth.ts`)
- **Services:** camelCase with `.service.ts` (e.g., `entity.service.ts`)
- **Utilities:** camelCase (e.g., `formatters.ts`)

## Import Paths

Configure path aliases in `tsconfig.json` for cleaner imports:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/features/*": ["./src/features/*"],
      "@/components/*": ["./src/components/*"]
    }
  }
}
```

Then use:
```typescript
import { useSignIn } from '@/features/auth/hooks';
import { Button } from '@/components/ui/buttons';
```

## Performance Considerations

- **Code Splitting:** Use lazy routes for large features
- **Tree Shaking:** Barrel exports enable better tree-shaking
- **Bundle Size:** Shared components reduce duplication
- **Query Caching:** Configured in `lib/queryClient.ts`

## Scalability

This structure scales to 100+ features:
- Each feature is independent
- Shared code in common locations
- Clear separation of concerns
- Easy to parallelize team development
