#!/usr/bin/env node
/**
 * mcp-cache.js — Phase 2.3: MCP Discovery Cache
 *
 * Cached MCP discovery results to avoid repeated HTTP roundtrips.
 * TTL via PIPELINE_DISCOVERY_CACHE_TTL env var (default 3600s).
 *
 * Usage:
 *   import { McpCache } from './lib/mcp-cache.js';
 *   const cache = new McpCache('.pipeline/mcp-discovery.json');
 *   const abilities = await cache.getOrDiscover(mcp);
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class McpCache {
  constructor(cachePath = '.pipeline/mcp-discovery.json', ttlSeconds = null) {
    this.path = cachePath;
    this.ttl = ttlSeconds ?? parseInt(process.env.PIPELINE_DISCOVERY_CACHE_TTL || '3600', 10);
  }

  /** Read cached data, returns null if expired/missing. */
  get() {
    if (!existsSync(this.path)) return null;
    try {
      const raw = JSON.parse(readFileSync(this.path, 'utf8'));
      if (raw.expires && Date.now() > raw.expires) return null;
      return raw.data ?? raw;
    } catch { return null; }
  }

  /** Write data to cache with TTL. */
  set(data) {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify({
      data,
      expires: Date.now() + this.ttl * 1000,
      cached_at: new Date().toISOString(),
    }, null, 2), 'utf8');
  }

  /** Invalidate cache. */
  clear() { try { writeFileSync(this.path, '{}'); } catch {} }

  /** Discover abilities (with cache). */
  async getOrDiscover(mcp) {
    const cached = this.get();
    if (cached) {
      process.stderr.write(`[mcp-cache] Cache-HIT (${Object.keys(cached).length} entries)\n`);
      return cached;
    }
    process.stderr.write('[mcp-cache] Cache-MISS — discovering...\n');
    const abilities = await mcp.call('novamira/adrians-export-design-system', { what: 'all' });
    this.set(abilities);
    return abilities;
  }
}
