# Database Backup Strategy

This document outlines backup strategies for the Get Lost Portal database and files.

## 📊 What Needs Backing Up

### Critical (Must Backup)
1. **Database** (`/var/data/db.sqlite`)
   - All user accounts and sessions
   - All books and metadata
   - All purchases and features
   - All reports, covers, marketing assets, landing pages
   - All digest jobs and processing status

### Important (Should Backup)
2. **Uploaded Files** (stored in `/var/data/*`)
   - Book manuscripts: `/var/data/books/`
   - Cover images: `/var/data/covers/`
   - Reports: `/var/data/reports/`
   - Book reports: `/var/data/book-reports/`
   - Uploads: `/var/data/uploads/`

### Note
- Content (reports, marketing assets) may be stored in another location
- Database is the most critical - contains all relationships and metadata

---

## 🔧 Backup Methods

### Method 1: Manual Download via Admin Panel (Recommended for Quick Backups)

**Access:**
1. Go to `/admin` → Click "Database" button
2. Or use the backup API endpoint directly

**API Endpoint:**
```bash
GET /api/admin/database/backup
```

**Returns:** Database file download with timestamp in filename

**Use Cases:**
- Quick one-off backups
- Before major changes
- Manual verification

---

### Method 2: Automated Script (Recommended for Regular Backups)

**Script:** `scripts/backup-database.js`

**Usage:**
```bash
# Local backup
node scripts/backup-database.js

# Custom directory
node scripts/backup-database.js /path/to/backups

# S3 backup (requires AWS CLI configured)
node scripts/backup-database.js s3://your-bucket/backups
```

**Features:**
- Automatic timestamp in filename
- Cleans up backups older than 30 days
- Supports local and S3 storage
- Shows backup size

---

### Method 3: Render Scheduled Jobs (Recommended for Production)

**Setup:**
1. Go to Render Dashboard → Scheduled Jobs
2. Create new scheduled job
3. Configure:
   - **Schedule:** Daily at 2 AM (or your preferred time)
   - **Command:** `node scripts/backup-database.js s3://your-bucket/backups`
   - **Mount Disk:** Yes (to access `/var/data`)

**Requirements:**
- AWS CLI configured with credentials
- S3 bucket for storing backups
- Or use local backup and download manually

**Environment Variables:**
```bash
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_DEFAULT_REGION=us-east-1
DATABASE_URL=file:/var/data/db.sqlite
```

---

### Method 4: External Backup Service

**Options:**
1. **Render + S3** (Recommended)
   - Use scheduled jobs to backup to S3
   - S3 provides versioning and lifecycle policies
   - Cost-effective for backups

2. **Render + External Script**
   - Use webhook/cron to trigger backup
   - Store in your own storage (Dropbox, Google Drive, etc.)

3. **Third-party Backup Services**
   - Services like Backblaze, Wasabi
   - Often cheaper than S3 for backups

---

## 🚀 Recommended Setup for Production

### Daily Automated Backups to S3

1. **Create S3 Bucket:**
   ```bash
   aws s3 mb s3://getlostportal-backups
   ```

2. **Set up S3 Lifecycle Policy:**
   - Keep daily backups for 30 days
   - Keep weekly backups for 12 weeks
   - Keep monthly backups for 12 months

3. **Create Render Scheduled Job:**
   - Schedule: Daily at 2:00 AM UTC
   - Command: `node scripts/backup-database.js s3://getlostportal-backups/database/`
   - Mount disk: Yes

4. **Configure AWS Credentials in Render:**
   - Add `AWS_ACCESS_KEY_ID`
   - Add `AWS_SECRET_ACCESS_KEY`
   - Add `AWS_DEFAULT_REGION`

### Manual Backup Button in Admin Panel

Add a "Backup Database" button that:
- Downloads the database file directly
- Shows backup size
- Provides immediate backup capability

---

## 📋 Backup Checklist

### Before Major Changes
- [ ] Create manual backup via admin panel
- [ ] Verify backup file is valid
- [ ] Store backup in safe location

### Regular Maintenance
- [ ] Verify automated backups are running
- [ ] Check backup storage usage
- [ ] Test restore process (on test environment)

### Monthly Review
- [ ] Verify backups are completing successfully
- [ ] Check backup storage costs
- [ ] Review backup retention policy
- [ ] Test full restore procedure

---

## 🔄 Restore Process

### Restore from Backup

1. **Download backup file** (from S3, admin panel, etc.)

2. **Stop the service** (if possible, or use maintenance mode)

3. **Replace database:**
   ```bash
   # On Render (via shell)
   cp /var/data/db.sqlite /var/data/db.sqlite.old
   cp backup-file.sqlite /var/data/db.sqlite
   ```

4. **Restart service**

5. **Verify:**
   - Check admin panel
   - Verify data integrity
   - Test key functionality

---

## 💾 Backup Storage Recommendations

### S3 (Recommended)
- **Cost:** ~$0.023/GB/month
- **Features:** Versioning, lifecycle policies, encryption
- **Setup:** Easy with AWS CLI

### Backblaze B2
- **Cost:** ~$0.005/GB/month (cheaper than S3)
- **Features:** Similar to S3
- **Setup:** Similar to S3

### Local Storage
- **Cost:** Free (but requires manual management)
- **Features:** Fast access, but no redundancy
- **Setup:** Just run the script

---

## ⚠️ Important Notes

1. **Database Size:** Monitor database size - large databases take longer to backup
2. **Backup Frequency:** Daily is recommended for production
3. **Retention:** Keep at least 30 days of backups
4. **Testing:** Regularly test restore process
5. **Encryption:** Consider encrypting backups if they contain sensitive data
6. **Off-site:** Store backups in a different location than production

---

## 🔐 Security Considerations

1. **Access Control:** Backup endpoints are admin-only
2. **Encryption:** Consider encrypting backups at rest
3. **Credentials:** Store AWS credentials securely in Render
4. **Backup Access:** Limit who can access backup files
5. **Audit Logs:** Log all backup operations

---

## 📊 Monitoring

### Check Backup Status

**Via Admin Panel:**
- Disk Status button shows database size
- Can manually trigger backup

**Via Logs:**
- Check Render logs for scheduled job execution
- Monitor for backup failures

**Via S3:**
- Check S3 bucket for recent backups
- Set up S3 notifications for failed uploads

---

## 🛠️ Quick Commands

### Create Backup Now
```bash
# Via API (admin only)
curl -H "Cookie: your-session-cookie" https://your-app.onrender.com/api/admin/database/backup -o backup.sqlite

# Via Script
node scripts/backup-database.js
```

### List Backups
```bash
# Local
ls -lh backups/

# S3
aws s3 ls s3://your-bucket/backups/ --recursive
```

### Restore from Backup
```bash
# On Render shell
cp /var/data/db.sqlite /var/data/db.sqlite.old
# Upload your backup.sqlite file
cp backup.sqlite /var/data/db.sqlite
```

---

## 📈 Backup Size Estimates

- **Small deployment:** < 10 MB
- **Medium deployment:** 10-100 MB
- **Large deployment:** 100 MB - 1 GB
- **Very large:** > 1 GB

**Note:** Database size grows with:
- Number of users
- Number of books
- Number of reports/assets
- Amount of metadata stored

---

## ✅ Next Steps

1. **Set up S3 bucket** for backups
2. **Configure AWS credentials** in Render
3. **Create scheduled job** for daily backups
4. **Add backup button** to admin panel (optional)
5. **Test restore process** in development
6. **Document restore procedure** for your team

