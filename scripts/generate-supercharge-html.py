#!/usr/bin/env python3
"""
Generate separate HTML files for Supercharge book:
1. One HTML file for covers
2. One HTML file for videos
Creates HTML that references images/videos from GetLostBooks/supercharge/
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any, List

def list_covers(covers_dir: Path) -> List[str]:
    """List all cover images in the covers directory."""
    if not covers_dir.exists():
        return []
    
    covers = []
    for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
        covers.extend(covers_dir.glob(f'*{ext}'))
        covers.extend(covers_dir.glob(f'*{ext.upper()}'))
    
    return sorted([f.name for f in covers])

def list_videos(videos_dir: Path) -> List[str]:
    """List all video files in the videos directory."""
    if not videos_dir.exists():
        return []
    
    videos = []
    for ext in ['.mp4', '.mov', '.webm', '.avi']:
        videos.extend(videos_dir.glob(f'*{ext}'))
        videos.extend(videos_dir.glob(f'*{ext.upper()}'))
    
    return sorted([f.name for f in videos])

def generate_covers_html(
    book_data: Dict[str, Any],
    covers_dir: Path,
    output_path: Path
) -> str:
    """Generate HTML for covers only."""
    
    title = book_data.get('title', 'Supercharge')
    author = book_data.get('author', '')
    subtitle = book_data.get('subtitle', '')
    description = book_data.get('description', '')
    
    # Get all covers
    covers = list_covers(covers_dir)
    main_cover = f"covers/{covers[0]}" if covers else ""
    
    # Generate covers gallery HTML
    covers_html = ""
    if covers:
        covers_html = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">\n'
        for cover in covers:
            cover_name = cover.replace('.png', '').replace('.jpg', '').replace('_', ' ').title()
            covers_html += f'''        <div class="cover-card bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            <div class="p-3 bg-gray-50 flex items-center justify-center min-h-[180px]">
                <img src="covers/{cover}" alt="{cover_name}" class="max-h-[160px] max-w-full object-contain" />
            </div>
            <div class="p-3 border-t border-gray-100">
                <p class="text-sm font-semibold text-gray-800 mb-2 text-center line-clamp-2" title="{cover_name}">{cover_name}</p>
                <a href="covers/{cover}" download="{cover}" class="block w-full text-center px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors">
                    Download Full Size
                </a>
            </div>
        </div>
'''
        covers_html += '      </div>'
    else:
        covers_html = '<p class="text-gray-500">No covers found in covers/ directory.</p>'
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Book Covers</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }}
        .cover-card {{
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }}
        .cover-card:hover {{
            transform: translateY(-4px);
        }}
    </style>
</head>
<body class="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-8">
    <!-- Main Content -->
    <main class="px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
            <!-- Header Section -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">Book Covers</h1>
                <p class="text-gray-600 text-lg">Available cover options for {title}</p>
            </div>
            
            <!-- Covers Grid -->
            <div class="bg-white rounded-xl shadow-lg p-6 md:p-8">
                {covers_html}
            </div>
        </div>
    </main>
</body>
</html>"""
    
    return html

def generate_videos_html(
    book_data: Dict[str, Any],
    videos_dir: Path,
    output_path: Path
) -> str:
    """Generate HTML for videos only."""
    
    title = book_data.get('title', 'Supercharge')
    author = book_data.get('author', '')
    subtitle = book_data.get('subtitle', '')
    description = book_data.get('description', '')
    
    # Get videos
    videos = list_videos(videos_dir)
    
    # Generate videos HTML
    videos_html = ""
    if videos:
        videos_html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">\n'
        for video in videos:
            video_name = video.replace('.mp4', '').replace('.mov', '').replace('_', ' ').title()
            videos_html += f'''      <div class="bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden hover:shadow-lg transition-shadow">
        <div class="p-4">
            <h4 class="font-semibold mb-3 text-lg text-gray-900">{video_name}</h4>
            <div class="rounded-lg overflow-hidden bg-black">
                <video src="videos/{video}" controls class="w-full" preload="metadata">
                  Your browser does not support the video tag.
                </video>
            </div>
            <p class="text-xs text-gray-500 mt-3 font-mono">{video}</p>
        </div>
      </div>
'''
        videos_html += '    </div>'
    else:
        videos_html = '<p class="text-gray-500">No videos found in videos/ directory.</p>'
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Videos</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }}
        video {{
            background: #000;
        }}
    </style>
</head>
<body class="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-8">
    <!-- Main Content -->
    <main class="px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
            <!-- Header Section -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">Videos</h1>
                <p class="text-gray-600 text-lg">Available video assets for {title}</p>
            </div>
            
            <!-- Videos Grid -->
            <div class="bg-white rounded-xl shadow-lg p-6 md:p-8">
                {videos_html}
            </div>
        </div>
    </main>
</body>
</html>"""
    
    return html

def main():
    """Main function."""
    if len(sys.argv) < 2:
        print("Usage: python3 generate-supercharge-html.py <output-dir> [book-data.json]")
        print("\nExample:")
        print("  python3 generate-supercharge-html.py /path/to/output")
        print("  python3 generate-supercharge-html.py /path/to/output book-data.json")
        print("\nThis will generate:")
        print("  - supercharge-covers.html (for covers)")
        print("  - supercharge-videos.html (for videos)")
        print("\nBoth files reference:")
        print("  - Covers from GetLostBooks/supercharge/covers/")
        print("  - Videos from GetLostBooks/supercharge/videos/")
        sys.exit(1)
    
    output_dir = Path(sys.argv[1])
    
    # Default book data
    book_data = {
        "title": "Supercharge",
        "author": "",
        "subtitle": "",
        "description": ""
    }
    
    # Load book data if provided
    if len(sys.argv) >= 3:
        book_data_file = Path(sys.argv[2])
        if book_data_file.exists():
            with open(book_data_file, 'r') as f:
                book_data.update(json.load(f))
    
    # Set up paths
    getlost_books = Path("/Users/eerogetlost/GetLostBooks")
    supercharge_dir = getlost_books / "supercharge"
    covers_dir = supercharge_dir / "covers"
    videos_dir = supercharge_dir / "videos"
    
    print(f"📚 Generating HTML files for: {book_data.get('title', 'Supercharge')}")
    print(f"📁 Covers directory: {covers_dir}")
    print(f"🎥 Videos directory: {videos_dir}")
    print(f"📂 Output directory: {output_dir}")
    
    # Check directories
    if not covers_dir.exists():
        print(f"⚠️  Warning: Covers directory not found: {covers_dir}")
    else:
        covers = list_covers(covers_dir)
        print(f"   Found {len(covers)} cover image(s)")
    
    if not videos_dir.exists():
        print(f"⚠️  Warning: Videos directory not found: {videos_dir}")
    else:
        videos = list_videos(videos_dir)
        print(f"   Found {len(videos)} video file(s)")
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate covers HTML
    print(f"\n📄 Generating covers HTML...")
    covers_html = generate_covers_html(book_data, covers_dir, output_dir)
    covers_file = output_dir / "supercharge-covers.html"
    with open(covers_file, 'w', encoding='utf-8') as f:
        f.write(covers_html)
    print(f"   ✅ Created: {covers_file}")
    
    # Generate videos HTML
    print(f"📄 Generating videos HTML...")
    videos_html = generate_videos_html(book_data, videos_dir, output_dir)
    videos_file = output_dir / "supercharge-videos.html"
    with open(videos_file, 'w', encoding='utf-8') as f:
        f.write(videos_html)
    print(f"   ✅ Created: {videos_file}")
    
    print(f"\n✅ Both HTML files generated!")
    print(f"\n📦 To create ZIP files for upload:")
    print(f"   cd {supercharge_dir}")
    print(f"   zip -r supercharge-covers.zip {covers_file.name} covers/")
    print(f"   zip -r supercharge-videos.zip {videos_file.name} videos/")
    print(f"\n   Then upload each ZIP separately to the portal!")

if __name__ == '__main__':
    main()
