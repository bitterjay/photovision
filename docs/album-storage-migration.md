# Album-Based Storage Migration Guide

## Overview

The PhotoVision application now supports two storage modes:
- **Single Mode**: All images stored in one `images.json` file (default)
- **Album Mode**: Images split across multiple JSON files, one per album

## Why Migrate?

As your image collection grows, the single `images.json` file can become large and impact performance. Album-based storage provides:
- Better scalability (no limit on total images)
- Faster save operations (only affected album is rewritten)
- Reduced memory usage (only needed albums loaded)
- Improved concurrent access

## Migration Commands

### Check Current Status
```bash
npm run migrate:status
```

### Test Migration (Dry Run)
```bash
npm run migrate:test
```

### Perform Migration
```bash
npm run migrate:albums
```

### Rollback (if needed)
```bash
npm run migrate:rollback <backup-file-path>
```

## How It Works

1. **Backup**: Creates automatic backup of current data
2. **Split**: Separates images into album-specific files
3. **Index**: Creates search index and image registry for fast lookups
4. **Verify**: Ensures all data migrated correctly

## Storage Structure

After migration:
```
data/
├── albums/
│   ├── {albumKey}.json      # Individual album files
│   └── ...
├── imageRegistry.json       # Maps image keys to albums
├── searchIndex.json         # Enables cross-album search
└── config.json             # Storage configuration
```

## API Compatibility

All existing APIs continue to work identically in both storage modes. The DataManager automatically handles the differences internally.

## Performance Characteristics

### Single Mode
- Fast searches across all images
- Slower saves (entire file rewritten)
- Higher memory usage

### Album Mode
- Efficient saves (per-album)
- Lower memory usage
- Search performance maintained via indices

## Troubleshooting

### Migration Fails
- Check disk space
- Ensure write permissions on data directory
- Review error messages for specific issues

### Rollback Needed
- Use the backup file path provided during migration
- Run: `npm run migrate:rollback /path/to/backup`

### Search Not Working
- Indices may need rebuilding
- Check `searchIndex.json` exists
- Verify album files are properly formatted