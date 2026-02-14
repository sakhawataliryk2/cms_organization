import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to fetch website metadata (title and favicon)
 * Uses public APIs and direct HTML parsing
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Extract domain for favicon
    let domain = '';
    try {
      const urlObj = new URL(normalizedUrl);
      domain = urlObj.hostname.replace(/^www\./, '');
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Fetch website title
    let title = domain;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const html = await response.text();
        // Extract title from HTML
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim().replace(/\s+/g, ' ');
          // Clean up common title suffixes
          title = title.replace(/\s*[-|]\s*.*$/, '').trim();
        } else {
          // Try Open Graph title
          const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
          if (ogTitleMatch && ogTitleMatch[1]) {
            title = ogTitleMatch[1].trim();
          }
        }
      }
    } catch (error: any) {
      // If fetching fails, just use domain as title
      if (error.name !== 'AbortError') {
        console.error('Error fetching website title:', error.message);
      }
    }

    // Generate favicon URL using Google's favicon service
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    return NextResponse.json({
      domain,
      title,
      faviconUrl,
      url: normalizedUrl,
    });
  } catch (error) {
    console.error('Error in website-metadata API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch website metadata' },
      { status: 500 }
    );
  }
}
