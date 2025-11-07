# Remove Commit from Nixarn Repository

## Current Situation
- You're on branch: `nixarn-develop` (based on `upstream/develop`)
- Most recent commit: `bcb8a33 Merge branch 'deploy' into develop`

## To Remove the Last Commit

### Option 1: Remove Last Commit (Discard Changes)
```bash
git reset --hard HEAD~1
```

### Option 2: Remove Last Commit (Keep Changes)
```bash
git reset --soft HEAD~1
```

### Option 3: Remove a Specific Commit (Interactive Rebase)
```bash
# Remove commit f5a6627 (for example)
git rebase -i f5a6627^

# In the editor, change 'pick' to 'drop' for the commit you want to remove
# Save and close
```

## After Removing the Commit

### Push to Nixarn Repository
```bash
# ⚠️ WARNING: This rewrites history!
git push upstream develop --force
```

## ⚠️ Important Notes

1. **You need write access** to `Nixarn/getlostportal`
2. **Force push rewrites history** - warn collaborators first
3. **Test locally first** - verify everything looks correct

## Safe Alternative: Revert Instead

If you can't force push or want to be safer:

```bash
# Revert creates a new commit that undoes changes
git revert bcb8a33

# Push normally (no force needed)
git push upstream develop
```

