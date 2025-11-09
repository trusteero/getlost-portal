/**
 * Extract summary text from report HTML
 * Looks for content in the "Overview" tab section
 */
export function extractSummaryFromReportHtml(htmlContent: string | null | undefined): string | null {
  if (!htmlContent) {
    return null;
  }

  try {
    // First, try to directly find the Classification text in the HTML
    // Pattern: <div class="text-sm font-medium">Classification</div> followed by <div class="text-sm text-gray-600">...</div>
    const directClassificationMatch = htmlContent.match(/<div[^>]*class=["'][^"']*text-sm font-medium[^"']*["'][^>]*>.*?Classification.*?<\/div>\s*<div[^>]*class=["'][^"']*text-sm text-gray-600[^"']*["'][^>]*>(.*?)<\/div>/is);
    
    if (directClassificationMatch && directClassificationMatch[1]) {
      const summaryText = directClassificationMatch[1]
        .replace(/<[^>]+>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      if (summaryText && summaryText.length > 50) {
        return summaryText;
      }
    }
    
    // Try to find the Overview tab content
    // The overview tab typically contains the summary/analysis overview
    // Use a more flexible pattern that captures until the next tab-content div or end of overview section
    const overviewMatch = htmlContent.match(/<div id=["']overview["'][^>]*class=["'][^"']*tab-content[^"']*["'][^>]*>(.*?)(?=<\/div>\s*<!--|<div id=["']|$)/is);
    
    if (overviewMatch && overviewMatch[1]) {
      const overviewContent = overviewMatch[1];
      
      // Try to find the "Classification" section which contains the main summary
      // Pattern: <div class="text-sm font-medium">Classification</div> followed by <div class="text-sm text-gray-600">...</div>
      const classificationMatch = overviewContent.match(/<div[^>]*class=["'][^"']*text-sm font-medium[^"']*["'][^>]*>.*?Classification.*?<\/div>\s*<div[^>]*class=["'][^"']*text-sm text-gray-600[^"']*["'][^>]*>(.*?)<\/div>/is);
      
      if (classificationMatch && classificationMatch[1]) {
        const summaryText = classificationMatch[1]
          .replace(/<[^>]+>/g, ' ') // Remove HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        if (summaryText && summaryText.length > 50) {
          return summaryText;
        }
      }
      
      // Try to find the "Analysis Overview" section which contains the summary
      const analysisOverviewMatch = overviewContent.match(/<div[^>]*>.*?Analysis Overview.*?<\/div>.*?<div[^>]*>.*?<div[^>]*>.*?<div[^>]*class=["'][^"']*text-[^"']*["'][^>]*>(.*?)<\/div>/is);
      
      if (analysisOverviewMatch && analysisOverviewMatch[1]) {
        const summaryText = analysisOverviewMatch[1]
          .replace(/<[^>]+>/g, ' ') // Remove HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        if (summaryText && summaryText.length > 50) {
          return summaryText;
        }
      }
      
      // Fallback: Extract all text from overview section and find the Classification paragraph
      const textContent = overviewContent
        .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove scripts
        .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove styles
        .replace(/<[^>]+>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Look for the Classification paragraph (it's usually a long paragraph after "Classification")
      const classificationIndex = textContent.toLowerCase().indexOf('classification');
      if (classificationIndex !== -1) {
        // Find the next substantial paragraph after "Classification"
        const afterClassification = textContent.substring(classificationIndex + 'classification'.length);
        // Split by common paragraph markers and take the first substantial one
        const sentences = afterClassification.split(/\.\s+/).filter(s => s.length > 50);
        if (sentences.length > 0) {
          // Take sentences until we have a good summary (200-800 chars)
          let summary = '';
          for (const sentence of sentences) {
            if (summary.length + sentence.length > 800) break;
            summary += (summary ? '. ' : '') + sentence;
            if (summary.length > 200) break; // We have enough
          }
          if (summary.length > 50) {
            return summary.trim() + (summary.trim().endsWith('.') ? '' : '.');
          }
        }
      }
      
      // Alternative: Look for "Classification" in the HTML and extract the following div content
      const classificationHtmlMatch = overviewContent.match(/<div[^>]*>.*?Classification.*?<\/div>\s*<div[^>]*class=["'][^"']*text-[^"']*[^"']*["'][^>]*>(.*?)<\/div>/is);
      if (classificationHtmlMatch && classificationHtmlMatch[1]) {
        const summaryText = classificationHtmlMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (summaryText && summaryText.length > 50) {
          return summaryText;
        }
      }
      
      // Take first meaningful paragraph (at least 100 chars)
      const paragraphs = textContent.split(/\s{2,}/).filter(p => p.length > 100);
      if (paragraphs.length > 0 && paragraphs[0]) {
        return paragraphs[0];
      }
      
      // Last resort: return first 500 chars of overview content
      if (textContent.length > 100) {
        return textContent.substring(0, 500).trim() + (textContent.length > 500 ? '...' : '');
      }
    }
    
    // Alternative: Look for common summary patterns
    const summaryPatterns = [
      /<div[^>]*class=["'][^"']*summary[^"']*["'][^>]*>(.*?)<\/div>/is,
      /<p[^>]*class=["'][^"']*summary[^"']*["'][^>]*>(.*?)<\/p>/is,
      /<section[^>]*class=["'][^"']*summary[^"']*["'][^>]*>(.*?)<\/section>/is,
    ];
    
    for (const pattern of summaryPatterns) {
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        const summaryText = match[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (summaryText && summaryText.length > 50) {
          return summaryText;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting summary from report HTML:", error);
    return null;
  }
}

