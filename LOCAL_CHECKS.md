# Running the Same Checks Locally as Render

## 🎯 Goal

Run the **exact same checks** locally that Render runs during deployment, so you catch errors **before** pushing.

---

## ✅ Quick Commands

### 1. **Type Check Only** (Fastest - catches TypeScript errors)
```bash
npm run typecheck
```

### 2. **Full Build** (Same as Render - catches everything)
```bash
npm run build
```

### 3. **Build with Type Check First** (Recommended workflow)
```bash
npm run build:check
```

---

## 📋 What Each Command Does

### `npm run typecheck`
- ✅ Checks TypeScript types
- ✅ Validates imports
- ✅ Catches type errors
- ⚡ Fast (doesn't build the app)
- ❌ Doesn't catch runtime issues

### `npm run build`
- ✅ Checks TypeScript types
- ✅ Validates imports
- ✅ Builds the entire app
- ✅ Catches build-time errors
- ✅ Same as what Render runs
- ⏱️ Slower (full build)

### `npm run build:check`
- ✅ Runs typecheck first (fast feedback)
- ✅ Then runs full build if typecheck passes
- ✅ Best of both worlds

---

## 🔄 Recommended Workflow

**Before every push:**

```bash
# Option 1: Quick check (recommended for frequent commits)
npm run typecheck

# Option 2: Full check (recommended before important pushes)
npm run build:check

# Option 3: Just build (same as Render)
npm run build
```

**If no errors, then push:**
```bash
git add .
git commit -m "Your message"
git push origin develop
```

**If errors, fix them first!**

---

## 🎯 What Render Runs

Render runs `npm run build` which:
1. ✅ Type checks all TypeScript files
2. ✅ Validates all imports
3. ✅ Builds the Next.js app
4. ✅ Catches any build errors

**So if `npm run build` passes locally, it will pass on Render!**

---

## 💡 Pro Tips

### Add a Pre-Push Hook (Optional)

Create `.husky/pre-push`:
```bash
#!/bin/sh
npm run typecheck
```

Or use a simpler approach - just remember to run `npm run typecheck` before pushing!

### Quick Fix Script

Add to your workflow:
```bash
# Check before pushing
npm run typecheck && git push origin develop
```

---

## 🚀 Summary

- **`npm run typecheck`** = Fast TypeScript check
- **`npm run build`** = Full build (same as Render)
- **`npm run build:check`** = Type check + build (best workflow)

**Always run one of these before pushing to catch errors early!**

