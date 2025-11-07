# Render Account Setup

## ✅ What You Need

You need a **personal Render account** (not a service account). Render uses GitHub OAuth for authentication.

## 📋 Step-by-Step Account Setup

### 1. Create Render Account

1. Go to [render.com](https://render.com)
2. Click **"Get Started"** or **"Sign Up"**
3. Choose **"Sign up with GitHub"** (recommended - easiest way)
   - This will use GitHub OAuth
   - No separate password needed
   - Render will automatically have access to your repositories

### 2. Authorize Render

When you sign up with GitHub:
- GitHub will ask: "Authorize Render?"
- Click **"Authorize Render"**
- Render will request access to your repositories
- You can grant access to:
  - **All repositories** (easiest)
  - **Selected repositories** (more secure)

### 3. That's It!

Once you've signed up and authorized GitHub:
- ✅ Your Render account is ready
- ✅ Render can see your repositories
- ✅ You can create services immediately

## 🔐 No Service Account Needed

Render doesn't use "service accounts" like Google Cloud Platform. Instead:
- **Personal account** = Your GitHub account
- **Authentication** = GitHub OAuth
- **Access** = Based on GitHub repository permissions

## 📝 What Happens Next

After account setup:
1. Render can see your `trusteero/getlost-portal` repository
2. You can create a new Web Service
3. Render will auto-detect `render.yaml` and configure everything

## ⚠️ Important Notes

- **Free tier available**: Render has a free tier for testing
- **Credit card**: May be required for some features, but free tier works without it initially
- **GitHub access**: Render needs read access to your repository to deploy

## 🚀 Ready to Deploy?

Once you have your Render account:
1. Go to Render dashboard
2. Click **"New +"** → **"Blueprint"**
3. Select `trusteero/getlost-portal`
4. Follow the deployment guide!

No service account needed - just your GitHub account! 🎉

