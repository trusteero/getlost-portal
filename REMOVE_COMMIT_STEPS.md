# Remove Commit from Nixarn Repository - Step by Step

## Prerequisites
- You're in the `/Users/eerogetlost/getlostportal` directory
- Upstream remote is already configured

## Step-by-Step Instructions

### Step 1: Navigate to the project directory
```bash
cd /Users/eerogetlost/getlostportal
```

### Step 2: Fetch latest from upstream
```bash
git fetch upstream
```

### Step 3: Checkout the upstream develop branch
```bash
git checkout -b nixarn-develop upstream/develop
```

### Step 4: See what commit you want to remove
```bash
git log --oneline -10
```

### Step 5: Remove the commit

**To remove the LAST commit:**
```bash
# Remove last commit and discard changes
git reset --hard HEAD~1

# OR remove last commit but keep changes
git reset --soft HEAD~1
```

**To remove a SPECIFIC commit (interactive rebase):**
```bash
# Replace N with number of commits to review
git rebase -i HEAD~N

# In the editor:
# - Change 'pick' to 'drop' for the commit you want to remove
# - Save and close
```

### Step 6: Force push to Nixarn repo
```bash
# ⚠️ WARNING: This rewrites history!
git push upstream develop --force
```

## ⚠️ Important Notes

1. **You need write access** to `Nixarn/getlostportal` repository
2. **Force push rewrites history** - warn collaborators first
3. **Test locally first** - make sure everything looks right before pushing

## Alternative: Safe Revert (No Force Push)

If you can't force push or want to be safer:

```bash
# Revert creates a new commit that undoes changes
git revert <commit-hash>

# Push normally (no force needed)
git push upstream develop
```

This is safer because it doesn't rewrite history.

