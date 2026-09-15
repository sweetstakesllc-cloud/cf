import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PythonCertificateGenerator } from '../src/certificates/pdf.js';

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('continues rendering if an image download times out and bounds the renderer runtime', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cf-pdf-timeout-test-'));
  const fetchMock = vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
  vi.stubGlobal('fetch', fetchMock);
  spawn.mockImplementation((_python, args) => {
    const child = Object.assign(new EventEmitter(), { stderr: Object.assign(new EventEmitter(), { setEncoding() {} }) });
    void writeFile(args[2], '%PDF-TEST').then(() => child.emit('close', 0));
    return child;
  });
  try {
    const filename = await new PythonCertificateGenerator(directory, 'python3').render({
      token: 'test-token', certificateNumber: 'TEST', productTitle: 'TEST ONLY', brand: 'TEST', sku: '',
      orderName: '#TEST', issuedAt: new Date(), imageUrls: ['https://cdn.example.com/stalled.jpg'],
      authenticationPartner: null, authenticationReportNumber: null,
      verificationUrl: 'https://certificates.example.com/certificates/test-token',
    });
    expect(filename).toBe('test-token.pdf');
    expect(fetchMock.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
    expect(spawn.mock.calls[0]![2]).toMatchObject({ timeout: 60000, killSignal: 'SIGKILL' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
