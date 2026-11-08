import { defineConfig } from 'vite';

// Relative file paths: Folio serves the build at /play/<name>/app/ or /lab/<name>/app/, not at the root of a site.
export default defineConfig({ base: './' });
