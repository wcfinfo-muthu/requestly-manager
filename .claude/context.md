
# Project Context

Chrome Extension (Manifest v3) similar to Requestly.

## Features
- Redirect requests
- Replace request/response body
- Modify headers
- Mock/overwrite API responses
- Rule-based execution engine

## Architecture
- Background Service Worker
- Content Script (optional)
- Options Page (UI)
- Rules Engine (core logic)

## Data Flow
1. User creates rule in UI
2. Rule stored in chrome.storage
3. Background loads & caches rules
4. On request → rules evaluated → action applied
