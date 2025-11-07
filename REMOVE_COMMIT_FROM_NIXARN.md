# How to Remove a Commit from Nixarn Repository

## ⚠️ Important Prerequisites

1. **You need write access** to `https://github.com/Nixarn/getlostportal`
2. **Force push required** - this rewrites history
3. **Warn collaborators** - this affects everyone using the repo

---

## Step-by-Step Guide

### Step 1: Add Nixarn Repo as Remote

```bash
# Add the Nixarn repo as a remote (if not already added)
git remote add upstream https://github.com/Nixarn/getlostportal.git

# Or if you want to push directly to it
git remote add nixarn https://github.com/Nixarn/getlostportal.git

# Verify remotes
git remote -v
```

### Step 2: Fetch Latest from Nixarn Repo

```bash
# Fetch latest commits
git fetch upstream

# Or if using 'nixarn' remote
git fetch nixarn

# See commits on their repo
git log upstream/develop --oneline -10
```

### Step 3: Identify the Commit to Remove

```bash
# See commit history
git log --oneline -10

# Find the commit hash you want to remove
# Example: abc1234 Bad commit message
```

### Step 4: Remove the Commit

**Option A: Remove Last Commit (Keep Changes)**

```bash
# Remove last commit but keep changes
git reset --soft HEAD~1

# Or remove last commit and discard changes
git reset --hard HEAD~1
```

**Option B: Remove Specific Commit (Interactive Rebase)**

```bash
# Start interactive rebase (replace N with number of commits to review)
git rebase -i HEAD~N

# In the editor that opens:
# - Change 'pick' to 'drop' for commits you want to remove
# - Or delete the line entirely
# Save and close

# If conflicts occur, resolve them and continue:
git rebase --continue
```

**Option C: Remove Commit from Middle of History**

```bash
# Interactive rebase to specific commit
git rebase -i <commit-hash-before-the-one-to-remove>^

# In editor: change 'pick' to 'drop' for unwanted commit
# Save and close
```

### Step 5: Force Push to Nixarn Repo

```bash
# ⚠️ WARNING: This rewrites history on the remote!

# If you added as 'upstream' and want to push to it:
git push upstream develop --force

# Or if you added as 'nixarn':
git push nixarn develop --force

# Or if you changed origin back to Nixarn:
git remote set-url origin https://github.com/Nixarn/getlostportal.git
git push origin develop --force
```

---

## ⚠️ Important Warnings

1. **Force push rewrites history** - anyone who pulled the old commits will have issues
2. **Warn your team** before force pushing
3. **Make sure you have write access** to the repository
4. **Backup first** - consider creating a backup branch

---

## Safe Alternative: Revert Instead of Remove

If you can't force push or want to be safer:

```bash
# Revert a commit (creates new commit that undoes changes)
git revert <commit-hash>

# Push normally (no force needed)
git push origin develop
```

This is safer because:
- ✅ Doesn't rewrite history
- ✅ No force push needed
- ✅ Safe for collaborators
- ✅ Can be undone easily

---

## Example: Remove Last Commit

```bash
# 1. Check current commits
git log --oneline -5

# 2. Remove last commit (keep changes)
git reset --soft HEAD~1

# 3. Or remove last commit (discard changes)
git reset --hard HEAD~1

# 4. Force push to Nixarn repo
git push upstream develop --force
```

---

## Check Your Access First

Before trying to push, verify you have access:

```bash
# Try to fetch (read access)
git fetch upstream

# If this works, you have read access
# To check write access, you'll need to try pushing
```

---

## If You Don't Have Write Access

If you don't have write access to `Nixarn/getlostportal`:

1. **Ask the repo owner** to remove the commit
2. **Fork the repo** and work on your fork
3. **Create a pull request** to revert the commit
4. **Use your own repo** (`trusteero/getlost-portal`) instead

---

## Quick Reference

```bash
# See commits
git log --oneline

# Remove last commit (keep changes)
git reset --soft HEAD~1

# Remove last commit (discard changes)  
git reset --hard HEAD~1

# Remove specific commit (interactive)
git rebase -i HEAD~N

# Force push (⚠️ dangerous)
git push upstream develop --force

# Safe revert instead
git revert <commit-hash>
git push upstream develop
```

