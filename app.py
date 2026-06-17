import os
import time
import urllib.request
import feedparser
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Constants
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_DURATION_SEC = 600  # 10 minutes cache

# In-memory cache
cache = {
    "data": None,
    "last_fetched": 0
}

def parse_html_content(content_value):
    """
    Parses the HTML summary of an RSS feed entry and splits it into
    individual update blocks based on <h3> tags.
    """
    soup = BeautifulSoup(content_value, 'html.parser')
    h3_tags = soup.find_all('h3')
    updates = []
    
    if not h3_tags:
        # Fallback if no h3 categories are present
        updates.append({
            'category': 'General',
            'html': content_value,
            'text': soup.get_text(separator=' ').strip()
        })
    else:
        for idx, h3 in enumerate(h3_tags):
            category = h3.get_text().strip()
            sibling_html = []
            sibling_text = []
            next_node = h3.next_sibling
            
            # Collect all sibling elements up to the next h3 tag
            while next_node and next_node.name != 'h3':
                if next_node.name:
                    sibling_html.append(str(next_node))
                    sibling_text.append(next_node.get_text(separator=' ').strip())
                next_node = next_node.next_sibling
            
            html_content = "".join(sibling_html).strip()
            text_content = " ".join([t for t in sibling_text if t]).strip()
            
            updates.append({
                'category': category,
                'html': html_content,
                'text': text_content
            })
            
    return updates

def fetch_and_parse_feed():
    """
    Fetches the BigQuery release notes XML feed and parses it.
    """
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    req = urllib.request.Request(FEED_URL, headers=headers)
    
    with urllib.request.urlopen(req) as response:
        feed_data = response.read()
        feed = feedparser.parse(feed_data)
        
        all_updates = []
        for entry_idx, entry in enumerate(feed.entries):
            date_str = entry.get("title", "")
            updated_str = entry.get("updated", "")
            link_str = entry.get("link", "")
            entry_id = entry.get("id", f"entry-{entry_idx}")
            
            content_list = entry.get("content", [])
            if content_list:
                content_value = content_list[0].get("value", "")
            else:
                content_value = entry.get("summary", "")
                
            updates = parse_html_content(content_value)
            
            for item_idx, update in enumerate(updates):
                all_updates.append({
                    'id': f"{entry_id}-{item_idx}",
                    'date': date_str,
                    'updated': updated_str,
                    'link': link_str,
                    'category': update['category'],
                    'html': update['html'],
                    'text': update['text']
                })
                
        return {
            "title": feed.feed.get("title", "BigQuery Release Notes"),
            "subtitle": feed.feed.get("subtitle", "Google Cloud BigQuery Release Notes Feed"),
            "updates": all_updates,
            "refreshed_at": time.time()
        }

def get_release_notes(force=False):
    """
    Gets release notes, utilizing the cache unless force is True or cache is expired.
    """
    now = time.time()
    if force or not cache["data"] or (now - cache["last_fetched"]) > CACHE_DURATION_SEC:
        try:
            cache["data"] = fetch_and_parse_feed()
            cache["last_fetched"] = now
        except Exception as e:
            # If fetch fails, return cached data if available, otherwise reraise
            if cache["data"]:
                print(f"Error fetching feed: {e}. Using cached data.")
            else:
                raise e
    return cache["data"]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def api_release_notes():
    force_refresh = request.args.get('force', 'false').lower() == 'true'
    try:
        data = get_release_notes(force=force_refresh)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats')
def api_stats():
    try:
        data = get_release_notes()
        updates = data.get("updates", [])
        
        categories = {}
        for u in updates:
            cat = u.get("category", "General")
            categories[cat] = categories.get(cat, 0) + 1
            
        return jsonify({
            'total_updates': len(updates),
            'categories': categories,
            'refreshed_at': data.get("refreshed_at")
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
