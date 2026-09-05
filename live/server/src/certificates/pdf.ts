import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CertificateGenerator, CertificateRenderInput } from './types.js';

const RENDER_SCRIPT = fileURLToPath(new URL('../../scripts/render_certificate.py', import.meta.url));

function runPython(pythonBin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Certificate renderer exited ${code}: ${stderr.trim()}`));
    });
  });
}

async function downloadImages(urls: string[], directory: string): Promise<string[]> {
  const paths: string[] = [];
  for (const [index, url] of urls.slice(0, 3).entries()) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const extension = response.headers.get('content-type')?.includes('png') ? '.png' : '.jpg';
      const destination = path.join(directory, `image-${index + 1}${extension}`);
      await writeFile(destination, Buffer.from(await response.arrayBuffer()));
      paths.push(destination);
    } catch {
      // A missing image should not prevent the customer from receiving a certificate.
    }
  }
  return paths;
}

export class PythonCertificateGenerator implements CertificateGenerator {
  constructor(
    private readonly storageDirectory: string,
    private readonly pythonBin = 'python',
  ) {}

  async render(input: CertificateRenderInput): Promise<string> {
    await mkdir(this.storageDirectory, { recursive: true });
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'cf-certificate-'));
    try {
      const imagePaths = await downloadImages(input.imageUrls, tempDirectory);
      const payloadPath = path.join(tempDirectory, 'certificate.json');
      const outputFilename = `${input.token}.pdf`;
      const outputPath = path.join(this.storageDirectory, outputFilename);
      await writeFile(payloadPath, JSON.stringify({
        certificateNumber: input.certificateNumber,
        productTitle: input.productTitle,
        brand: input.brand,
        sku: input.sku,
        orderName: input.orderName,
        issuedDate: input.issuedAt.toISOString().slice(0, 10),
        imagePaths,
        authenticationPartner: input.authenticationPartner,
        authenticationReportNumber: input.authenticationReportNumber,
        verificationUrl: input.verificationUrl,
      }), 'utf8');
      await runPython(this.pythonBin, [RENDER_SCRIPT, payloadPath, outputPath]);
      await readFile(outputPath); // Fail now rather than storing a broken path.
      return outputFilename;
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
