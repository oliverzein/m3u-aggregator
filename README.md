# M3U Aggregator

A modern web application for filtering and managing M3U IPTV playlists using Rule Sets filtering.

## Features

- **Rule Sets Filtering**: Create multiple rule sets with AND/OR logic
- **Web Interface**: Clean, modern UI for managing playlists and rules
- **Real-time Filtering**: Apply filters and see results instantly
- **Preview Generation**: Generate filtered M3U files for download
- **Drag & Drop**: Easy file upload with drag and drop support

## Rule Sets Logic

- **AND Logic**: All rules within a rule set must match
- **OR Logic**: Any rule set can match (between different sets)
- **Flexible Rules**: Filter by title, group, URL, or custom attributes
- **Case Sensitivity**: Configurable case sensitivity for each rule

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Server**:
   ```bash
   npm start
   ```

3. **Open in Browser**:
   Navigate to `http://localhost:3000`

## Usage

1. **Upload M3U File**: Drag and drop or select your M3U playlist file
2. **Create Rule Sets**: Add rule sets with filtering rules
3. **Apply Filters**: Click "Apply Rule Sets" to filter channels
4. **Preview Results**: View filtered channels before downloading
5. **Download**: Generate and download the filtered M3U file

## API Endpoints

- `POST /api/upload` - Upload and parse M3U file
- `POST /api/filter` - Apply rule sets filtering
- `POST /api/preview` - Generate filtered M3U content

## Development

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev
```

## License

MIT License - see LICENSE file for details.