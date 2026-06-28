# 🍳 KitchenWhiz - Smart Grocery Planner & AI Recipe Assistant

KitchenWhiz is a premium, dark-themed smart grocery planner and conversational AI recipe assistant. It combines local-first browser state with Supabase cloud databases and Groq/Gemini API engines to provide a seamless, interactive, and responsive cooking experience.

---

## 🌟 Key Features

### 🎬 1. Premium Splash Screen
*   Launches with a soft raspberry fade-in transitioning into a lime-green logo background.
*   Includes a click-to-skip trigger to instantly proceed to the dashboard.

### 🥕 2. Smart Pantry Inventory
*   **Gibberish Filtering:** Blocks invalid entries, duplicate tags, empty submissions, and keyboard-smash inputs.
*   **Smooth Slide-Outs:** Refactored deletion logic using pure CSS transitions (`max-width`, `margins`, and `scale`), allowing neighboring tag chips to slide smoothly into place without layout snaps.

### 🔍 3. Token-Lenient Autocomplete Suggestions
*   Matches from a dictionary of 75+ common kitchen ingredients.
*   **Token-Based Leniency:** Matches keywords out-of-order (e.g. typing `green ch` or `ch green` matches `Green Chili` successfully).
*   **Auto-Hiding:** Excludes ingredients already present in your pantry.
*   Supports full keyboard navigation (`ArrowUp` / `ArrowDown`, `Enter` to select, and `Escape` to close).

### 🍳 4. AI Recipes & Detail Side Panel Drawer
*   Recipes slide out in a modern 1/3-width right drawer (collapses to a bottom sheet on mobile devices).
*   **Macro Nutrition Cards:** Displays protein, fat, calories, and carbohydrate estimates.
*   **Serving scaling:** Features inline `-` / `+` controllers that dynamically scale ingredient quantities in real-time.
*   **CORS Safe Fallback:** Direct browser calls to Groq API are often blocked by CORS. The app catches this error gracefully and falls back to a rules-based local recipe matcher.

### 🛒 5. Syncing Grocery List Modal
*   **Ticked Box Styling:** Ticking an item highlights the card in glowing lime green and keeps the text clean (no line-through / strikethrough).
*   **Database Sync:** Automatically backs up custom grocery items and checkbox states to a Supabase table.
*   **Quick Tools:** Features `📋 Copy` and `📥 Export` buttons in the footer to copy unchecked items to your clipboard or download them as a `shopping-list.txt` file.

### 🤖 6. WhizBot Chatbot Overlay
*   Includes online indicators, sender avatars, typing animations, and clear conversation triggers.
*   **Button Parsing:** Chatbot response action buttons parse bold keywords to let you add items directly to your pantry or grocery list.

---

## 🏗️ Tech Stack

*   **Frontend:** HTML5, Vanilla CSS3 (HSL variables, glassmorphism, responsive grid layouts), JavaScript ES6 Modules.
*   **Build System:** Vite JS.
*   **Database & Authentication:** Supabase (PostgreSQL, Row Level Security policies).
*   **AI Engine:** Groq API / Gemini API completions.

---

## 🚀 Installation & Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Monasri29-hub/KitchenWitz.git
cd KitchenWitz
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Groq API Configuration (used for Recipes and Chatbot)
VITE_GROCERY_AGENT_KEY=your_groq_api_key
```

### 4. Initialize Database Tables
Run the following SQL script in your **Supabase SQL Editor**:

```sql
-- 1. Favorites Table
create table public.favorites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  recipe jsonb not null,
  created_at timestamptz default now()
);
alter table public.favorites enable row level security;
create policy "Users manage own favorites" on public.favorites for all using (auth.uid() = user_id);

-- 2. History Table
create table public.history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  recipe jsonb not null,
  created_at timestamptz default now()
);
alter table public.history enable row level security;
create policy "Users manage own history" on public.history for all using (auth.uid() = user_id);

-- 3. Grocery List Table
create table public.grocery_list (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  item text not null,
  checked boolean default false,
  created_at timestamptz default now()
);
alter table public.grocery_list enable row level security;
create policy "Users manage own grocery list" on public.grocery_list for all using (auth.uid() = user_id);
```

### 5. Launch Development Server
```bash
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

### 6. Build & Deploy to Vercel
KitchenWhiz is configured for instant deployment on Vercel using serverless backend support:
*   **CORS-Free Serverless Proxy:** The `/api/suggest-recipes` and `/api/chatbot` endpoints automatically build into Vercel Serverless Functions. They securely fetch completions from the Groq/Gemini APIs without leaking keys to the client browser.
*   **Setting Env Variables:** Ensure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_GROCERY_AGENT_KEY` are configured in your Vercel Project Settings under **Environment Variables** (scoped to Production/Preview).
*   **CI/CD Deployment:** Simply push commits to your linked GitHub repository's `main` branch to trigger an automatic redeploy on Vercel.

---

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for more information.

---

## ✍️ Author
*   **Monasri Kundeti** - [@Monasri29-hub](https://github.com/Monasri29-hub)