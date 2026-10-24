import crypto from 'node:crypto';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { syncError } from '../config/cloudSyncConfig.js';

export const imagePath = hash => `/api/menu/images/${hash}.webp`;
export const imageHash = value => /^\/api\/menu\/images\/([a-f0-9]{64})\.webp$/.exec(value || '')?.[1];
export const bundledImage = value => /^(?:\/customer\/)?assets\/menu-items\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$/.test(value || '');
export async function readBundledImage(value) {
  if(!bundledImage(value))throw syncError('SYNC_INVALID_IMAGE_URL',400);
  const root=await fs.realpath(fileURLToPath(new URL('../../../frontend/assets/menu-items/',import.meta.url)));
  const relative=value.replace(/^(?:\/customer\/)?assets\/menu-items\//,'');
  const file=await fs.realpath(path.resolve(root,relative));
  if(!file.startsWith(root+path.sep))throw syncError('SYNC_INVALID_IMAGE_URL',400);
  if((await fs.stat(file)).size>2*1024*1024)throw syncError('SYNC_IMAGE_TOO_LARGE',400);
  const bytes=await fs.readFile(file),ext=path.extname(file).slice(1).replace('jpg','jpeg');
  return optimizeImage(`data:image/${ext};base64,${bytes.toString('base64')}`);
}
export function safePublicImage(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || net.isIP(url.hostname) ||
        !url.hostname.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname)) throw new Error();
    return url.href;
  } catch { throw syncError('SYNC_INVALID_IMAGE_URL', 400); }
}
export async function optimizeImage(dataUrl) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl || '');
  if (!match || match[2].length > 3 * 1024 * 1024) throw syncError('SYNC_INVALID_IMAGE', 400);
  const input = Buffer.from(match[2], 'base64');
  if (!input.length || input.length > 2 * 1024 * 1024) throw syncError('SYNC_IMAGE_TOO_LARGE', 400);
  try {
    const processor = sharp(input, { limitInputPixels: 16000000, failOn: 'warning' });
    const metadata = await processor.metadata();
    if (!['png','jpeg','webp'].includes(metadata.format) || metadata.format !== match[1] ||
        metadata.width > 6000 || metadata.height > 6000 || metadata.pages > 1) throw new Error();
    const data = await processor.rotate().resize(900,900,{ fit:'inside',withoutEnlargement:true }).webp({ quality:82 }).toBuffer();
    return { data, hash: crypto.createHash('sha256').update(data).digest('hex') };
  } catch { throw syncError('SYNC_INVALID_IMAGE', 400); }
}
export async function saveMenuImage(db, value) {
  if (value == null || value === '') return value;
  if (imageHash(value)) {
    if (!(await db.query('SELECT 1 FROM menu_image_assets WHERE hash=$1',[imageHash(value)])).rowCount) throw syncError('SYNC_IMAGE_MISSING',400);
    return value;
  }
  if (!value.startsWith('data:')&&!bundledImage(value)) return safePublicImage(value);
  const asset = bundledImage(value)?await readBundledImage(value):await optimizeImage(value);
  await db.query('INSERT INTO menu_image_assets(hash,data) VALUES($1,$2) ON CONFLICT DO NOTHING',[asset.hash,asset.data]);
  return imagePath(asset.hash);
}

export async function publishMenuImage(dataUrl, { env = process.env, fetchImpl = fetch, restaurantId, signal } = {}) {
  const { data, hash } = await optimizeImage(dataUrl);
  let base;
  try { base = new URL(env.MENU_IMAGE_STORAGE_URL); } catch { throw syncError('SYNC_IMAGE_STORAGE_CONFIG',503); }
  const key = env.MENU_IMAGE_STORAGE_SERVICE_KEY;
  const bucket = env.MENU_IMAGE_STORAGE_BUCKET || 'menu-images';
  if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co') || base.username || base.password ||
      base.port || base.pathname !== '/' || base.search || base.hash || !key || !/^[a-z0-9-]{1,63}$/.test(bucket)) throw syncError('SYNC_IMAGE_STORAGE_CONFIG',503);
  const object = `${bucket}/${restaurantId}/${hash}.webp`;
  const publicUrl = `${base.origin}/storage/v1/object/public/${object}`;
  const timeout = signal || AbortSignal.timeout(15000);
  const response = await fetchImpl(`${base.origin}/storage/v1/object/${object}`, { method:'POST',redirect:'error',signal:timeout,
    headers:{ Authorization:`Bearer ${key}`,apikey:key,'Content-Type':'image/webp','x-upsert':'true','Cache-Control':'max-age=31536000, immutable' },body:data });
  if (!response.ok) throw syncError('SYNC_IMAGE_UPLOAD_FAILED',503);
  // A storage ACK alone does not prove public access (e.g. a private bucket).
  const check = await fetchImpl(publicUrl,{ method:'HEAD',redirect:'error',signal:timeout });
  if (!check.ok || !check.headers.get('content-type')?.startsWith('image/')) throw syncError('SYNC_IMAGE_NOT_PUBLIC',503);
  return publicUrl;
}
