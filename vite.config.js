import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    // Safely inject process.env.GROCERY_AGENT_KEY from OS environment variables
    'import.meta.env.VITE_GROCERY_AGENT_KEY': JSON.stringify(process.env.GROCERY_AGENT_KEY || '')
  }
});
