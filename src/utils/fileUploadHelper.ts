import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';

/**
 * Upload fixtures, generated at runtime rather than committed.
 *
 * Question Q-12 asks whether the lab supplies document fixtures. Until it is
 * answered the suite generates its own, including the deliberately invalid ones
 * needed for R-DOC-01 and R-DOC-02. Generating them also keeps a multi-megabyte
 * oversized file out of the repository.
 */

const GENERATED_DIR = path.resolve(__dirname, '../../test-data/generated');

function ensureDir(): string {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  return GENERATED_DIR;
}

export interface Fixture {
  path: string;
  name: string;
  mimeType: string;
  buffer: Buffer;
}

function write(name: string, buffer: Buffer, mimeType: string): Fixture {
  const dir = ensureDir();
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, buffer);
  return { path: filePath, name, mimeType, buffer };
}

/** Minimal but structurally valid single-page PDF. */
export function validPdf(name = 'kyc-valid.pdf'): Fixture {
  const pdf =
    '%PDF-1.4\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n';
  return write(name, Buffer.from(pdf, 'latin1'), 'application/pdf');
}

/** Smallest valid PNG — a single transparent pixel. */
export function validPng(name = 'kyc-valid.png'): Fixture {
  const b64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  return write(name, Buffer.from(b64, 'base64'), 'image/png');
}

/** Minimal JPEG header — enough for a type check to accept or reject. */
export function validJpg(name = 'kyc-valid.jpg'): Fixture {
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  return write(name, jpeg, 'image/jpeg');
}

/** An obviously unsupported type — must be rejected (R-DOC-01). */
export function unsupportedType(name = 'malicious.exe'): Fixture {
  return write(name, Buffer.from('MZ\x90\x00 not a document', 'latin1'), 'application/octet-stream');
}

/**
 * A disallowed payload renamed to a permitted extension.
 * If this is accepted, validation is extension-only and content is never inspected —
 * a more serious finding than a plain unsupported-type failure.
 */
export function spoofedExtension(name = 'not-really-a.pdf'): Fixture {
  return write(name, Buffer.from('MZ\x90\x00 this is an executable', 'latin1'), 'application/pdf');
}

/** A file larger than the configured limit — must be rejected (R-DOC-02). */
export function oversizedFile(name = 'oversized.pdf'): Fixture {
  const bytes = Math.ceil((env.rules.maxUploadMb + 1) * 1024 * 1024);
  const buffer = Buffer.alloc(bytes, 0x41);
  buffer.write('%PDF-1.4\n', 0, 'latin1');
  return write(name, buffer, 'application/pdf');
}

/** A zero-byte file — an edge case some validators miss entirely. */
export function emptyFile(name = 'empty.pdf'): Fixture {
  return write(name, Buffer.alloc(0), 'application/pdf');
}

/** Removes everything this helper generated. Called from global teardown. */
export function cleanupGenerated(): void {
  fs.rmSync(GENERATED_DIR, { recursive: true, force: true });
}
