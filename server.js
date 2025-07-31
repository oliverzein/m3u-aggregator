const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({ 
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/octet-stream' || 
            file.originalname.endsWith('.m3u') || 
            file.originalname.endsWith('.m3u8')) {
            cb(null, true);
        } else {
            cb(new Error('Only M3U files are allowed'));
        }
    }
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// M3U Parser
class M3UParser {
    static parse(content) {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        const channels = [];
        let currentChannel = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('#EXTINF:')) {
                if (currentChannel) {
                    channels.push(currentChannel);
                }

                const extinfMatch = line.match(/^#EXTINF:(-?\d+)(.*)$/);
                if (extinfMatch) {
                    const duration = parseInt(extinfMatch[1]);
                    const info = extinfMatch[2].trim();
                    
                    const titleMatch = info.match(/,(.+)$/);
                    const title = titleMatch ? titleMatch[1].trim() : '';
                    
                    const attributes = {};
                    const attrMatches = info.matchAll(/(\w+-?\w*)=["']([^"']*)["']/g);
                    for (const match of attrMatches) {
                        attributes[match[1]] = match[2];
                    }

                    currentChannel = {
                        title,
                        duration,
                        attributes,
                        url: ''
                    };
                }
            } else if (line && !line.startsWith('#') && currentChannel) {
                currentChannel.url = line;
            }
        }

        if (currentChannel && currentChannel.url) {
            channels.push(currentChannel);
        }

        return channels.map(channel => ({
            title: channel.title,
            group: channel.attributes['group-title'] || '',
            url: channel.url,
            attributes: channel.attributes
        }));
    }
}

// Rule Set Engine
class RuleSet {
    constructor(id, name, rules = []) {
        this.id = id;
        this.name = name;
        this.rules = rules;
    }

    static evaluateRuleSet(channel, ruleSet) {
        if (!ruleSet.rules || ruleSet.rules.length === 0) return true;
        
        const validRules = ruleSet.rules.filter(r => r.pattern && r.pattern.trim());
        if (validRules.length === 0) return true;
        
        // AND logic within rule set - all rules must match
        return validRules.every(rule => FilterEngine.applyRule(channel, rule));
    }
}

class FilterEngine {
    static regexCache = new Map();

    static getCachedRegex(pattern, caseSensitive) {
        const key = `${pattern}_${caseSensitive}`;
        if (!this.regexCache.has(key)) {
            try {
                const flags = caseSensitive ? 'g' : 'gi';
                this.regexCache.set(key, new RegExp(pattern, flags));
            } catch (error) {
                console.error('Invalid regex pattern:', pattern, error);
                return null;
            }
        }
        return this.regexCache.get(key);
    }

    static applyRule(channel, rule) {
        const { field, pattern, matchType, caseSensitive } = rule;
        
        if (!pattern || pattern.trim() === '') {
            return true;
        }

        const regex = this.getCachedRegex(pattern, caseSensitive);
        if (!regex) {
            return false;
        }
        
        let targetText = '';
        
        switch (field) {
            case 'title':
                targetText = channel.title || '';
                break;
            case 'group':
                targetText = channel.attributes['group-title'] || '';
                break;
            case 'url':
                targetText = channel.url || '';
                break;
            case 'attributes':
                targetText = JSON.stringify(channel.attributes);
                break;
            case 'all':
            default:
                targetText = `${channel.title} ${channel.group} ${channel.url} ${JSON.stringify(channel.attributes)}`;
                break;
        }

        const matches = regex.test(targetText);
        return matchType === 'include' ? matches : !matches;
    }

    static applyFilters(channels, ruleSets = []) {
        if (!channels || !Array.isArray(channels)) return [];
        
        // Handle rule sets only - OR logic between rule sets
        if (ruleSets && ruleSets.length > 0) {
            return channels.filter(channel => {
                // OR logic between rule sets - any set matches
                return ruleSets.some(ruleSet => RuleSet.evaluateRuleSet(channel, ruleSet));
            });
        }
        
        // No filters, return all channels
        return channels;
    }
}

// API Routes

// Upload M3U file
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const content = fs.readFileSync(filePath, 'utf8');
        const channels = M3UParser.parse(content);

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            channels,
            count: channels.length
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Apply filters
app.post('/api/filter', (req, res) => {
    try {
        const { channels, ruleSets } = req.body;
        
        if (!channels || !Array.isArray(channels)) {
            return res.status(400).json({ success: false, error: 'Invalid channels data' });
        }

        const startTime = Date.now();
        const filteredChannels = FilterEngine.applyFilters(channels, ruleSets);
        const duration = Date.now() - startTime;

        res.json({
            success: true,
            filteredChannels,
            originalCount: channels.length,
            filteredCount: filteredChannels.length,
            duration
        });
    } catch (error) {
        console.error('Filter error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate preview
app.post('/api/preview', (req, res) => {
    try {
        const { channels } = req.body;
        
        if (!channels || !Array.isArray(channels)) {
            return res.status(400).json({ success: false, error: 'Invalid channels data' });
        }

        let content = '#EXTM3U\n';
        
        channels.forEach(channel => {
            const attributes = Object.entries(channel.attributes || {})
                .map(([key, value]) => `${key}="${value}"`)
                .join(' ');
            
            content += `#EXTINF:-1 ${attributes},${channel.title}\n`;
            content += `${channel.url}\n`;
        });

        res.json({
            success: true,
            content
        });
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`M3U Aggregator server running on http://localhost:${PORT}`);
});