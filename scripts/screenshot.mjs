#!/usr/bin/env node
/**
 * Take a screenshot of the annotation UI for documentation
 */
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function takeScreenshot() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox'],
    channel: 'chrome'
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  
  const htmlPath = join(__dirname, '../docs/demo-annotation-ui.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  
  // Wait for content to render
  await page.waitForSelector('#mainContent');
  await new Promise(r => setTimeout(r, 500));
  
  const outputPath = join(__dirname, '../docs/screenshot-annotation-ui.png');
  await page.screenshot({ path: outputPath, fullPage: false });
  
  console.log(`Screenshot saved to: ${outputPath}`);
  
  await browser.close();
}

takeScreenshot().catch(console.error);
