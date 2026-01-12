#!/usr/bin/env python3
"""
Generate HTML files for upload to Get Lost Portal
Creates standalone HTML files that can be uploaded directly to the portal
for Reports, Landing Pages, Covers, or Marketing Assets.
"""

import json
import base64
import sys
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

def embed_image_as_base64(image_path: Path) -> Optional[str]:
    """Embed an image as base64 data URI."""
    try:
        if not image_path.exists():
            return None
        
        with open(image_path, 'rb') as f:
            image_data = f.read()
        
        # Determine MIME type from extension
        ext = image_path.suffix.lower()
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml'
        }
        mime_type = mime_types.get(ext, 'image/jpeg')
        
        base64_data = base64.b64encode(image_data).decode('utf-8')
        return f"data:{mime_type};base64,{base64_data}"
    except Exception as e:
        print(f"Warning: Could not embed image {image_path}: {e}")
        return None

def generate_book_report_html(book_data: Dict[str, Any], output_path: Path, embed_images: bool = False) -> str:
    """Generate a book report HTML file for portal upload."""
    
    # Extract book information
    title = book_data.get('title', 'Untitled Book')
    author = book_data.get('author', 'Unknown Author')
    subtitle = book_data.get('subtitle', '')
    description = book_data.get('description', '')
    
    # Get cover image - use relative path by default, embed only if requested
    cover_image_src = ""
    if 'cover_image' in book_data:
        if embed_images:
            # Embed as base64
            cover_path = Path(book_data['cover_image'])
            if cover_path.exists():
                cover_image_src = embed_image_as_base64(cover_path) or ""
        else:
            # Use relative path - portal will find and embed it automatically
            cover_image_src = book_data['cover_image']
    
    # Generate HTML
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} by {author} - Book Analysis Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    <style>
        .tab-content {{
            display: none;
        }}
        .tab-content.active {{
            display: block;
        }}
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
        <section class="px-4 py-8 sm:px-6 lg:px-8 bg-white border-b">
            <div class="mx-auto max-w-6xl">
                <div class="bg-blue-50 p-6 rounded-lg">
                    <div class="flex flex-col lg:flex-row gap-8 items-center">
                        <!-- Book Info -->
                        <div class="flex-1">
                            <h1 class="text-2xl lg:text-3xl text-black font-medium mb-3">
                                <em>{title}</em> by {author}
                            </h1>
                            {f'<h2 class="text-xl text-blue-600 mb-4">{subtitle}</h2>' if subtitle else ''}
                            {f'<p class="text-gray-700 leading-relaxed">{description}</p>' if description else ''}
                        </div>
                        
                        <!-- Book Cover -->
                        {f'<div class="flex justify-center lg:justify-end w-56 h-80 flex-shrink-0"><img src="{cover_image_src}" alt="{title}" class="w-56 h-80 object-contain rounded-lg shadow-lg" /></div>' if cover_image_src else ''}
                    </div>
                </div>
            </div>
        </section>
        
        <!-- Tabs -->
        <div class="mx-auto max-w-6xl">
            <div class="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 rounded-lg border bg-gray-100 p-1 shadow-sm mb-8">
                <button class="tab-button flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md bg-white text-gray-900 shadow-sm" data-tab="overview">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                    </svg>
                    Overview
                </button>
                <button class="tab-button flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md text-gray-500 hover:bg-white hover:text-gray-900 transition-colors" data-tab="demographics">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                    </svg>
                    Demographics
                </button>
                <button class="tab-button flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md text-gray-500 hover:bg-white hover:text-gray-900 transition-colors" data-tab="positioning">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clip-rule="evenodd"></path>
                    </svg>
                    Classification
                </button>
                <button class="tab-button flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md text-gray-500 hover:bg-white hover:text-gray-900 transition-colors" data-tab="personas">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                    </svg>
                    Personas
                </button>
                <button class="tab-button flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm font-medium rounded-md text-gray-500 hover:bg-white hover:text-gray-900 transition-colors" data-tab="marketing">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                    Marketing
                </button>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="px-4 py-8 sm:px-6 lg:px-8">
        <!-- Overview Tab -->
        <div id="overview" class="tab-content active space-y-8">
            <div class="mx-auto max-w-6xl">
                <div class="bg-gray-50 rounded-lg p-6">
                    <h3 class="text-lg font-semibold mb-4">Book Overview</h3>
                    <div class="space-y-4">
                        <div>
                            <div class="text-sm font-medium text-gray-700 mb-2">Description</div>
                            <div class="text-sm text-gray-600">{description or 'No description available.'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Demographics Tab -->
        <div id="demographics" class="tab-content">
            <div class="mx-auto max-w-6xl space-y-8">
                <div class="border rounded-lg bg-white shadow-none p-6">
                    <h3 class="text-xl font-semibold mb-4">Demographics</h3>
                    <p class="text-gray-600">Demographic information will be displayed here.</p>
                </div>
            </div>
        </div>

        <!-- Classification Tab -->
        <div id="positioning" class="tab-content">
            <div class="mx-auto max-w-6xl space-y-8">
                <div class="border rounded-lg bg-white shadow-none p-6">
                    <h3 class="text-xl font-semibold mb-4">Classification</h3>
                    <p class="text-gray-600">Classification information will be displayed here.</p>
                </div>
            </div>
        </div>

        <!-- Personas Tab -->
        <div id="personas" class="tab-content">
            <div class="mx-auto max-w-6xl space-y-8">
                <div class="border rounded-lg bg-white shadow-none p-6">
                    <h3 class="text-xl font-semibold mb-4">Personas</h3>
                    <p class="text-gray-600">Persona information will be displayed here.</p>
                </div>
            </div>
        </div>

        <!-- Marketing Tab -->
        <div id="marketing" class="tab-content">
            <div class="mx-auto max-w-6xl space-y-8">
                <div class="border rounded-lg bg-white shadow-none p-6">
                    <h3 class="text-xl font-semibold mb-4">Marketing</h3>
                    <p class="text-gray-600">Marketing information will be displayed here.</p>
                </div>
            </div>
        </div>
    </main>

    <!-- Tab Navigation Script -->
    <script>
        // Tab switching functionality
        document.addEventListener('DOMContentLoaded', function() {{
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');
            
            tabButtons.forEach(button => {{
                button.addEventListener('click', function() {{
                    const targetTab = this.getAttribute('data-tab');
                    
                    // Remove active class from all buttons and contents
                    tabButtons.forEach(btn => {{
                        btn.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
                        btn.classList.add('text-gray-500');
                    }});
                    tabContents.forEach(content => {{
                        content.classList.remove('active');
                    }});
                    
                    // Add active class to clicked button and corresponding content
                    this.classList.add('bg-white', 'text-gray-900', 'shadow-sm');
                    this.classList.remove('text-gray-500');
                    document.getElementById(targetTab).classList.add('active');
                }});
            }});
            
            // Initialize Lucide icons
            if (typeof lucide !== 'undefined') {{
                lucide.createIcons();
            }}
        }});
    </script>
</body>
</html>"""
    
    return html

def main():
    """Main function to generate HTML file."""
    if len(sys.argv) < 3:
        print("Usage: python3 generate-portal-html.py <book_data.json> <output.html> [--embed-images]")
        print("\nExample:")
        print("  python3 generate-portal-html.py book-data.json report.html")
        print("  python3 generate-portal-html.py book-data.json report.html --embed-images")
        print("\nThe book_data.json should contain:")
        print("  - title: Book title")
        print("  - author: Author name")
        print("  - subtitle: (optional) Book subtitle")
        print("  - description: (optional) Book description")
        print("  - cover_image: (optional) Path to cover image (relative path)")
        print("\nBy default, images are referenced separately (not embedded).")
        print("Use --embed-images to embed images as base64 in the HTML.")
        print("\nUpload options:")
        print("  1. Upload HTML file only (images should be in book-reports directory)")
        print("  2. Upload ZIP file containing HTML + images")
        sys.exit(1)
    
    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2])
    embed_images = '--embed-images' in sys.argv
    
    if not input_file.exists():
        print(f"Error: Input file '{input_file}' not found.")
        sys.exit(1)
    
    # Load book data
    try:
        with open(input_file, 'r') as f:
            book_data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        sys.exit(1)
    
    # Generate HTML
    print(f"Generating HTML report for: {book_data.get('title', 'Unknown')}")
    html_content = generate_book_report_html(book_data, output_file.parent, embed_images)
    
    # Write output
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"✅ HTML file generated: {output_file}")
    print(f"\n📤 Ready to upload to portal!")
    print(f"\nUpload Options:")
    print(f"  1. Upload HTML file only:")
    print(f"     - Portal will search for images in book-reports directory")
    print(f"     - Images should be in: {Path.home()}/book-reports/ or subdirectories")
    print(f"  2. Upload ZIP file (recommended):")
    print(f"     - Create ZIP containing HTML + all images")
    print(f"     - Portal will extract and find images automatically")
    print(f"\nUpload endpoints:")
    print(f"   - Report: /api/admin/books/[id]/report")
    print(f"   - Landing Page: /api/admin/books/[id]/landing-page")
    print(f"   - Cover: /api/admin/books/[id]/covers")
    print(f"   - Marketing Asset: /api/admin/books/[id]/marketing-assets")

if __name__ == '__main__':
    main()

