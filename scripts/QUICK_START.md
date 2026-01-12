# Quick Start: Generate Supercharge HTML & ZIP Files

## Run the Script

Open your terminal and run:

```bash
cd /Users/eerogetlost/getlostportal/scripts
./create-supercharge-zips.sh
```

That's it! The script will:
1. ✅ Generate **two** HTML files (one for covers, one for videos)
2. ✅ Create **two** ZIP files (one for covers, one for videos)
3. ✅ Show you where the ZIP files are located

## Output Location

The ZIP files will be created at:
```
/Users/eerogetlost/GetLostBooks/supercharge/
├── supercharge-covers.zip    (HTML + covers/)
└── supercharge-videos.zip    (HTML + videos/)
```

## What's Included

### Covers ZIP (`supercharge-covers.zip`):
- `supercharge-covers.html` - HTML file for covers
- `covers/` - All 6 cover images

### Videos ZIP (`supercharge-videos.zip`):
- `supercharge-videos.html` - HTML file for videos
- `videos/` - All 10 video files

## Upload to Portal

### Upload Covers:
1. Go to your portal admin dashboard
2. Select the Supercharge book
3. Go to **Book Covers** section
4. Click **Upload**
5. Select: `/Users/eerogetlost/GetLostBooks/supercharge/supercharge-covers.zip`

### Upload Videos:
1. Go to your portal admin dashboard
2. Select the Supercharge book
3. Go to **Marketing Assets** section
4. Click **Upload**
5. Select: `/Users/eerogetlost/GetLostBooks/supercharge/supercharge-videos.zip`

## Full Path

If you need the absolute path:
```bash
/Users/eerogetlost/getlostportal/scripts/create-supercharge-zips.sh
```

## Alternative: Run from Anywhere

You can also run it with the full path:
```bash
/Users/eerogetlost/getlostportal/scripts/create-supercharge-zips.sh
```

