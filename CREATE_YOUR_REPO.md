# Creating Your Own Repository - Step by Step

## Option 1: Create New Repo on GitHub (Recommended)

### Step 1: Create Repository on GitHub

1. Go to [github.com](https://github.com) and sign in
2. Click the **"+"** icon → **"New repository"**
3. Fill in:
   - **Repository name**: `getlostportal` (or your preferred name)
   - **Description**: (optional)
   - **Visibility**: Private or Public (your choice)
   - **DO NOT** initialize with README, .gitignore, or license (we already have code)
4. Click **"Create repository"**

### Step 2: Update Remote URL

After creating the repo, GitHub will show you the repository URL. It will look like:
```
https://github.com/YOUR-USERNAME/getlostportal.git
```

Then run these commands:

```bash
# Remove old remote
git remote remove origin

# Add your new repository as origin
git remote add origin https://github.com/YOUR-USERNAME/getlostportal.git

# Verify it's set correctly
git remote -v
```

### Step 3: Push Your Code

```bash
# Push all branches
git push -u origin develop

# If you want to push main branch too
git push -u origin main
```

---

## Option 2: Fork the Existing Repo

If you want to keep a connection to the original repo:

1. Go to `https://github.com/Nixarn/getlostportal`
2. Click **"Fork"** button
3. This creates a copy in your account
4. Then update remote:
   ```bash
   git remote set-url origin https://github.com/YOUR-USERNAME/getlostportal.git
   git push -u origin develop
   ```

---

## Option 3: Keep Both Remotes

If you want to keep the original as `upstream` and add yours as `origin`:

```bash
# Rename current origin to upstream
git remote rename origin upstream

# Add your new repo as origin
git remote add origin https://github.com/YOUR-USERNAME/getlostportal.git

# Push to your repo
git push -u origin develop
```

---

## After Setting Up Your Repo

Once your code is in your own repository, you can:

1. **Deploy to Render** using your new repo
2. **Make changes** without affecting the original
3. **Control access** (private/public)
4. **Set up CI/CD** if needed

---

## Quick Commands Summary

```bash
# See current remote
git remote -v

# Change remote to your repo
git remote set-url origin https://github.com/YOUR-USERNAME/getlostportal.git

# Push to your repo
git push -u origin develop
```

