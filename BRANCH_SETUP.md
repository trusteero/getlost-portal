# Branch Setup for Development and Deployment

## ✅ Branch Structure

You now have two branches:

### 1. `develop` - Development Branch
- **Purpose**: Daily development work
- **Current branch**: You're working here
- **Remote**: `origin/develop`
- **Use for**: Testing, feature development, bug fixes

### 2. `main` - Deployment Branch
- **Purpose**: Production-ready code for deployment
- **Remote**: `origin/main` (will be created on first push)
- **Use for**: Deploying to Render/production

---

## 🔄 Workflow

### Development Workflow

```bash
# 1. Work on develop branch (you're already here)
git checkout develop

# 2. Make changes, commit
git add .
git commit -m "Your changes"

# 3. Push to develop
git push origin develop
```

### Deployment Workflow

When ready to deploy:

```bash
# 1. Make sure develop is up to date
git checkout develop
git pull origin develop

# 2. Merge develop into main
git checkout main
git merge develop

# 3. Push main to trigger deployment
git push origin main
```

---

## 📋 Quick Commands

### Switch Branches

```bash
# Switch to development
git checkout develop

# Switch to deployment
git checkout main
```

### Deploy to Production

```bash
# Merge develop into main and deploy
git checkout main
git merge develop
git push origin main
```

### Update Develop from Main

```bash
# If you need to sync develop with main
git checkout develop
git merge main
```

---

## 🚀 Render Configuration

Update your Render service to use the `main` branch:

1. Go to Render dashboard → Your service
2. Click **"Settings"**
3. Under **"Build & Deploy"**, change:
   - **Branch**: `main` (instead of `develop`)
4. Save changes

**Or** keep using `develop` if you want to deploy from development branch.

---

## 💡 Recommended Setup

**Option 1: Deploy from `main` (Recommended)**
- Develop on `develop`
- Deploy from `main`
- More control over what goes to production

**Option 2: Deploy from `develop`**
- Develop and deploy from `develop`
- Simpler, but less control

---

## 📝 Current Status

- ✅ `develop` branch: Ready for development
- ✅ `main` branch: Created, ready for deployment
- ⚠️ `main` branch needs to be pushed to GitHub first

---

## 🔧 Push Main Branch to GitHub

To make `main` available on GitHub:

```bash
git checkout main
git push -u origin main
```

Then update Render to use `main` branch for deployments.

---

## 🎯 Summary

- **Develop**: `develop` branch (current)
- **Deploy**: `main` branch (created)
- **Workflow**: Develop on `develop`, merge to `main` when ready to deploy

Your branches are set up! 🎉

