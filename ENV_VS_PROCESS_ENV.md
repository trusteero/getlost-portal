# `process.env` vs `env` Object - Explained

## 🔍 What is `process.env`?

`process.env` is Node.js's built-in way to access environment variables. It's a plain object with string values.

```typescript
// Direct access - no validation, no types
const apiKey = process.env.RESEND_API_KEY; // Type: string | undefined
const nodeEnv = process.env.NODE_ENV; // Type: string | undefined
const port = process.env.PORT; // Type: string | undefined (even if it's a number!)
```

### Problems with `process.env`:

1. **No Type Safety**
   - TypeScript doesn't know what type the value should be
   - Everything is `string | undefined`
   - No autocomplete for variable names

2. **No Validation**
   - Typos in variable names won't be caught until runtime
   - Invalid values (e.g., wrong format) aren't caught
   - Missing required variables only fail at runtime

3. **No Defaults**
   - You have to manually handle defaults everywhere
   - Inconsistent default handling across files

4. **Runtime Errors**
   - Missing variables cause crashes at runtime
   - Hard to debug which variable is missing

---

## ✅ What is the `env` Object?

The `env` object is a **validated, type-safe** wrapper around `process.env` created using `@t3-oss/env-nextjs`.

```typescript
// From src/env.js
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    RESEND_API_KEY: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.string().transform(Number).optional(),
  },
  // ...
});
```

### Benefits of `env` Object:

1. **Type Safety** ✅
   ```typescript
   // TypeScript knows the exact type!
   const apiKey = env.RESEND_API_KEY; // Type: string | undefined
   const nodeEnv = env.NODE_ENV; // Type: "development" | "test" | "production"
   const port = env.PORT; // Type: number | undefined (automatically converted!)
   ```

2. **Validation at Startup** ✅
   ```typescript
   // If NODE_ENV is "invalid", the app won't start!
   // You get a clear error message immediately
   ```

3. **Autocomplete** ✅
   ```typescript
   // Your IDE will suggest available environment variables
   env. // <- Autocomplete shows: RESEND_API_KEY, NODE_ENV, etc.
   ```

4. **Catches Typos** ✅
   ```typescript
   // This will cause a TypeScript error:
   env.RESEND_API_KE // ❌ Property 'RESEND_API_KE' does not exist
   
   // vs process.env which silently returns undefined:
   process.env.RESEND_API_KE // ✅ No error, just undefined
   ```

5. **Consistent Defaults** ✅
   ```typescript
   // Defaults are defined once in env.js
   NODE_ENV: z.enum([...]).default("development")
   
   // vs process.env where you repeat defaults everywhere:
   process.env.NODE_ENV || "development" // Repeated in every file
   ```

---

## 📊 Side-by-Side Comparison

### Example 1: Accessing Environment Variables

```typescript
// ❌ process.env - No types, no validation
const apiKey = process.env.RESEND_API_KEY; 
// Type: string | undefined
// No validation - could be empty string, wrong format, etc.

// ✅ env object - Type-safe, validated
import { env } from "@/env";
const apiKey = env.RESEND_API_KEY;
// Type: string | undefined (from schema)
// Validated at app startup
```

### Example 2: Type Safety

```typescript
// ❌ process.env - Everything is a string
const port = process.env.PORT; // Type: string | undefined
const numPort = parseInt(process.env.PORT || "3000", 10); // Manual conversion

// ✅ env object - Can transform types
// In env.js:
PORT: z.string().transform(Number).optional()
// Usage:
const port = env.PORT; // Type: number | undefined (automatically converted!)
```

### Example 3: Enum Validation

```typescript
// ❌ process.env - No validation
const nodeEnv = process.env.NODE_ENV; // Could be "dev", "prod", "invalid", etc.
if (nodeEnv === "production") { // Might never be true if typo exists
  // ...
}

// ✅ env object - Validated enum
// In env.js:
NODE_ENV: z.enum(["development", "test", "production"]).default("development")
// Usage:
const nodeEnv = env.NODE_ENV; // Type: "development" | "test" | "production"
// Guaranteed to be one of these values!
```

### Example 4: Error Messages

```typescript
// ❌ process.env - Silent failures
const apiKey = process.env.RESEND_API_KEY;
// Later in code:
await fetch("https://api.resend.com/emails", {
  headers: { Authorization: `Bearer ${apiKey}` } // apiKey is undefined!
});
// Error: "Unauthorized" - not helpful!

// ✅ env object - Fails fast with clear error
// If RESEND_API_KEY is required but missing:
// Error at startup: "Missing required environment variable: RESEND_API_KEY"
// App won't start until fixed - prevents runtime errors!
```

---

## 🎯 Real Example from Your Codebase

### Before (using `process.env`):

```typescript
// src/server/services/email.ts
const RESEND_API_KEY = process.env.RESEND_API_KEY; // No type, no validation
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

const getAppUrl = (): string => {
  const customDomain = process.env.CUSTOM_DOMAIN || process.env.NEXT_PUBLIC_CUSTOM_DOMAIN;
  // Could be invalid URL, no validation
  return process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
};

const disableEmailFlag = process.env.DISABLE_EMAIL_IN_TESTS === "true";
const isTestNodeEnv = process.env.NODE_ENV === "test";
// NODE_ENV could be "invalid" and this would still work incorrectly
```

**Problems:**
- No type checking
- Typos won't be caught (e.g., `process.env.RESEND_API_KE`)
- Invalid values aren't validated
- Errors only appear at runtime

### After (using `env` object):

```typescript
// src/server/services/email.ts
import { env } from "@/env";

const RESEND_API_KEY = env.RESEND_API_KEY; // Type: string | undefined
const RESEND_FROM_EMAIL = env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

const getAppUrl = (): string => {
  const customDomain = env.CUSTOM_DOMAIN || env.NEXT_PUBLIC_CUSTOM_DOMAIN;
  // env.CUSTOM_DOMAIN is validated as URL in schema
  return env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
};

const disableEmailFlag = env.DISABLE_EMAIL_IN_TESTS === "true";
const isTestNodeEnv = env.NODE_ENV === "test";
// env.NODE_ENV is guaranteed to be "development" | "test" | "production"
```

**Benefits:**
- ✅ Type safety - TypeScript knows the types
- ✅ Validation - Invalid values caught at startup
- ✅ Autocomplete - IDE suggests available variables
- ✅ Typos caught - Compile-time errors
- ✅ Consistent - All defaults in one place

---

## 🔧 How It Works

### 1. Schema Definition (`src/env.js`)

```typescript
export const env = createEnv({
  server: {
    // Define what variables exist and their types
    RESEND_API_KEY: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.string().transform(Number).optional(),
  },
  runtimeEnv: {
    // Map to actual process.env values
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
  },
});
```

### 2. Validation at Startup

When your app starts, `createEnv`:
1. Reads values from `process.env`
2. Validates them against the schema
3. Transforms types (e.g., string → number)
4. Applies defaults
5. **Throws an error if validation fails** (app won't start)

### 3. Type-Safe Usage

```typescript
import { env } from "@/env";

// TypeScript knows the exact types from the schema
const apiKey = env.RESEND_API_KEY; // string | undefined
const nodeEnv = env.NODE_ENV; // "development" | "test" | "production"
```

---

## 🚨 When to Use Each

### Use `env` object (Recommended) ✅

- **Server-side code** (API routes, server utilities)
- **When you need type safety**
- **When you want validation**
- **When you want to catch errors early**

```typescript
import { env } from "@/env";
const apiKey = env.RESEND_API_KEY;
```

### Use `process.env` (Limited cases) ⚠️

- **Client-side code** (browser) - `env` object is server-only
- **In `env.js` itself** - It needs to read from `process.env` to create the `env` object
- **Edge cases** where you need raw access

```typescript
// Client-side (browser)
const publicUrl = process.env.NEXT_PUBLIC_APP_URL; // ✅ OK

// In env.js runtimeEnv mapping
runtimeEnv: {
  RESEND_API_KEY: process.env.RESEND_API_KEY, // ✅ OK - this is where we read it
}
```

---

## 📝 Summary

| Feature | `process.env` | `env` object |
|---------|---------------|--------------|
| **Type Safety** | ❌ No | ✅ Yes |
| **Validation** | ❌ No | ✅ Yes (at startup) |
| **Autocomplete** | ❌ No | ✅ Yes |
| **Catches Typos** | ❌ No | ✅ Yes |
| **Default Values** | ❌ Manual | ✅ In schema |
| **Error Timing** | ❌ Runtime | ✅ Startup |
| **Type Transformations** | ❌ Manual | ✅ Automatic |

---

## 🎯 Key Takeaway

**`env` object = `process.env` + Type Safety + Validation + Better Developer Experience**

Think of it as a **type-safe, validated wrapper** around `process.env` that:
- Catches errors before your app runs
- Provides better TypeScript support
- Makes your code more maintainable
- Prevents runtime bugs

**Always use `env` object in server-side code when possible!** 🚀

