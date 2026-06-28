import { createClient } from '@supabase/supabase-js';

/* ==========================================================================
   Supabase Client
   ========================================================================== */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
  }
}

/* ==========================================================================
   State & Constants
   ========================================================================== */
let pantryList = [];
let currentRecipes = [];
let favoritesList = [];
let historyList = [];
let activeFilters = ["Easy", "Medium", "Hard"];
let tempUploadedAvatar = null;
let currentSupabaseUser = null; // Tracks active Supabase auth user
let customShoppingList = []; // Custom grocery list items added manually/via chatbot
let lastMissingIngredients = []; // Missing ingredients from active recipes
const SUGGESTED_INGREDIENTS = [
  "Chicken", "Chicken Breast", "Chicken Wings", "Cheese", "Cheddar Cheese", "Mozzarella", 
  "Parmesan", "Cream Cheese", "Tomato", "Cherry Tomatoes", "Garlic", "Garlic Powder", 
  "Garlic Cloves", "Onion", "Red Onion", "Spring Onion", "Spinach", "Eggs", "Egg whites", 
  "Milk", "Whole Milk", "Almond Milk", "Potato", "Sweet Potato", "Pasta", "Spaghetti", 
  "Penne", "Rice", "Basmati Rice", "Brown Rice", "Bread", "Whole Wheat Bread", "Butter", 
  "Olive Oil", "Vegetable Oil", "Salt", "Black Pepper", "Flour", "Sugar", "Yogurt", 
  "Greek Yogurt", "Lemon", "Lime", "Ginger", "Beef", "Minced Beef", "Pork", "Bacon", 
  "Fish", "Salmon", "Shrimp", "Avocado", "Mushrooms", "Carrots", "Cucumber", "Bell Pepper", 
  "Red Bell Pepper", "Basil", "Oregano", "Cilantro", "Parsley", "Cumin", "Paprika", 
  "Turmeric", "Coriander", "Cinnamon", "Honey", "Maple Syrup", "Soy Sauce", "Vinegar", 
  "Mayo", "Mustard"
];
const STORAGE_KEY = 'antigravity_pantry_items'; // Guest pantry localStorage key
const API_KEY_STORAGE = 'antigravity_gemini_api_key';
const DEFAULT_API_KEY = import.meta.env.VITE_GROCERY_AGENT_KEY || '';

/* --------------------------------------------------------------------------
   Auth Helpers — powered by Supabase
   -------------------------------------------------------------------------- */

/** Returns the current user as a plain object compatible with the existing UI */
function getCurrentUserObject() {
  if (!currentSupabaseUser) return null;
  const meta = currentSupabaseUser.user_metadata || {};
  return {
    name: meta.full_name || meta.name || currentSupabaseUser.email.split('@')[0],
    email: currentSupabaseUser.email,
    avatar: meta.avatar_url || null,
    preferences: meta.preferences || { vegetarian: false, glutenFree: false, vegan: false, keto: false },
    categories: meta.categories || ''
  };
}

// Local database of recipes for fallback / standard use
const LOCAL_RECIPES = [
  {
    title: "🍅 Tomato & Spinach Pasta",
    prepTime: "10 mins",
    cookTime: "15 mins",
    difficulty: "Easy",
    ingredients: ["Pasta", "Tomato", "Spinach", "Garlic"],
    instructions: [
      "Boil pasta in a pot of salted water according to the instructions on the package until al dente.",
      "Sauté minced garlic in a large skillet with olive oil for 1 minute until fragrant.",
      "Add diced tomatoes and cook for 3 minutes, then add fresh spinach leaves and cook until wilted.",
      "Drain the pasta and toss it directly in the skillet with the tomato and spinach mixture."
    ],
    tips: [
      "Save 1/2 cup of pasta water before draining to thin out the sauce if it gets too dry.",
      "Garnish with freshly grated parmesan cheese and black pepper for extra flavor."
    ]
  },
  {
    title: "🥚 Spinach & Cheese Omelette",
    prepTime: "5 mins",
    cookTime: "5 mins",
    difficulty: "Easy",
    ingredients: ["Eggs", "Spinach", "Cheese"],
    instructions: [
      "Whisk eggs in a bowl with a pinch of salt and pepper until smooth and frothy.",
      "Melt butter in a skillet on medium heat, then pour in the eggs.",
      "Sprinkle shredded cheese and fresh spinach on one half of the omelette as it sets.",
      "Carefully fold the omelette in half and cook for 1 more minute until the cheese melts."
    ],
    tips: [
      "Use low to medium heat to prevent the omelette from browning too quickly or drying out.",
      "Add a pinch of garlic powder to the eggs for an optional savory boost."
    ]
  },
  {
    title: "🍗 Garlic Butter Chicken",
    prepTime: "10 mins",
    cookTime: "20 mins",
    difficulty: "Medium",
    ingredients: ["Chicken", "Garlic"],
    instructions: [
      "Cut the chicken breasts into bite-sized pieces and season with salt and pepper.",
      "Melt butter in a pan over medium-high heat, then add chicken and sear until golden brown.",
      "Lower the heat, add minced garlic and butter, and cook for 5 minutes, basting the chicken.",
      "Let the chicken rest in the garlic butter sauce for 2 minutes before serving."
    ],
    tips: [
      "Sauté garlic on low heat so it browns without burning, which makes it bitter.",
      "Add a splash of lemon juice to cut through the richness of the butter."
    ]
  },
  {
    title: "🍞 Cheesy Garlic Bread",
    prepTime: "5 mins",
    cookTime: "10 mins",
    difficulty: "Easy",
    ingredients: ["Bread", "Cheese", "Garlic"],
    instructions: [
      "Preheat your oven to 400°F (200°C) or prepare a grill pan.",
      "Mix softened butter with minced garlic, and spread it evenly on slices of bread.",
      "Top the bread slices generously with shredded cheese.",
      "Bake or toast for 8-10 minutes until the bread is crispy and the cheese is bubbling."
    ],
    tips: [
      "Use mozzarella for a classic stretchy cheese pull, or cheddar for a sharper taste.",
      "A sprinkle of chopped fresh parsley on top adds a nice color and freshness."
    ]
  },
  {
    title: "🥔 Potato Hash",
    prepTime: "10 mins",
    cookTime: "15 mins",
    difficulty: "Easy",
    ingredients: ["Potato", "Garlic", "Tomato"],
    instructions: [
      "Peel potatoes and cut into small cubes so they cook quickly and evenly.",
      "Heat oil in a skillet, add potatoes, and fry until they start to turn golden and crispy.",
      "Add minced garlic and diced tomatoes into the pan, stirring well to combine.",
      "Season with salt, pepper, and herbs, and cook for 5 more minutes until potatoes are soft inside."
    ],
    tips: [
      "Covering the pan with a lid for the first 5 minutes helps steam the potatoes so they cook faster.",
      "Drizzle with hot sauce or serve alongside eggs for a complete breakfast."
    ]
  },
  {
    title: "🍞 Classic French Toast",
    prepTime: "5 mins",
    cookTime: "10 mins",
    difficulty: "Easy",
    ingredients: ["Bread", "Eggs", "Milk"],
    instructions: [
      "In a wide bowl, whisk eggs, milk, and a pinch of salt until thoroughly combined.",
      "Melt butter in a pan or griddle over medium heat.",
      "Dip each slice of bread into the egg mixture for 5-10 seconds on each side.",
      "Cook bread in the pan for 3-4 minutes per side until golden brown and cooked through."
    ],
    tips: [
      "Thick, day-old bread works best because it absorbs the egg mixture without falling apart.",
      "Add a pinch of cinnamon and vanilla extract to the egg mixture for standard dessert french toast."
    ]
  },
  {
    title: "🥛 Creamy Spinach Chicken",
    prepTime: "10 mins",
    cookTime: "20 mins",
    difficulty: "Medium",
    ingredients: ["Chicken", "Spinach", "Garlic", "Milk", "Cheese"],
    instructions: [
      "Season chicken breasts and cook in a skillet with oil until cooked through, then remove.",
      "In the same skillet, sauté garlic and spinach until spinach is fully wilted.",
      "Pour in milk and add cheese, stirring constantly on low heat until cheese melts into a smooth sauce.",
      "Return the chicken to the skillet, spoon the sauce over it, and simmer for 3 minutes."
    ],
    tips: [
      "Use cream cheese or heavy cream instead of milk if you want a thicker, richer sauce.",
      "Make sure the chicken is cooked to 165°F (74°C) internal temperature."
    ]
  },
  {
    title: "🍅 Tomato Soup & Grilled Cheese",
    prepTime: "15 mins",
    cookTime: "20 mins",
    difficulty: "Medium",
    ingredients: ["Tomato", "Bread", "Cheese", "Garlic"],
    instructions: [
      "Sauté garlic and diced tomatoes in a pot, add 1 cup of water or broth, and simmer for 15 minutes.",
      "Use an immersion blender to purée the tomatoes into a smooth, thick soup.",
      "Butter two slices of bread, place cheese between them, and grill in a pan until golden.",
      "Serve the warm soup in a bowl accompanied by the crispy grilled cheese sandwich."
    ],
    tips: [
      "Drizzle a tablespoon of cream or olive oil into the soup before serving for richness.",
      "Cut the grilled cheese into strips ('dippers') to dunk into the soup."
    ]
  },
  {
    title: "🍝 Chicken Parm Pasta",
    prepTime: "15 mins",
    cookTime: "25 mins",
    difficulty: "Medium",
    ingredients: ["Chicken", "Pasta", "Tomato", "Cheese", "Garlic"],
    instructions: [
      "Cook pasta in salted water. Cook seasoned chicken breast in a skillet until fully done, then slice.",
      "Sauté garlic in a pan, add diced tomatoes, and cook for 5 minutes to create a fresh sauce.",
      "Toss the cooked pasta with the tomato sauce, and layer chicken slices on top.",
      "Top with cheese, cover the pan with a lid, and let it steam for 2 minutes to melt the cheese."
    ],
    tips: [
      "You can bread the chicken with flour, egg, and breadcrumbs before frying for a crunchy texture.",
      "A sprinkle of fresh basil leaves on top elevates the presentation instantly."
    ]
  },
  {
    title: "🥔 Cheesy Mashed Potatoes",
    prepTime: "10 mins",
    cookTime: "15 mins",
    difficulty: "Easy",
    ingredients: ["Potato", "Cheese", "Milk", "Garlic"],
    instructions: [
      "Peel potatoes and cut them into quarters.",
      "Boil in a pot of salted water for 15 minutes until fork-tender, then drain.",
      "Mash the hot potatoes while gradually adding butter, a splash of milk, and minced garlic.",
      "Stir in shredded cheese until it melts completely and the mash is light and creamy."
    ],
    tips: [
      "Warm the milk and melt the butter before adding to the potatoes to keep them light and fluffy.",
      "Use russet or Yukon Gold potatoes for the best mash texture."
    ]
  }
];

const GROCERY_EMOJIS = ['🍅', '🥬', '🍞', '🥕', '🍳', '🧀', '🍗', '🥛', '🍎', '🥩', '🍝', '🥔', '🧅', '🧄'];

/* ==========================================================================
   DOM Element Cache
   ========================================================================== */
const canvas = document.getElementById('antigravity-canvas');
const ingredientForm = document.getElementById('ingredient-form');
const ingredientInput = document.getElementById('ingredient-input');
const tagsContainer = document.getElementById('pantry-tags-container');
const emptyState = document.getElementById('pantry-empty-state');
const generateBtn = document.getElementById('generate-recipes-btn');
const ingredientCountLabel = document.getElementById('ingredient-count');
const clearAllBtn = document.getElementById('clear-all-btn');

const outputContainer = document.getElementById('output-container');
const outputEmptyState = document.getElementById('output-empty-state');
const outputLoadingState = document.getElementById('output-loading-state');
const outputResults = document.getElementById('output-results');
const recipesGrid = document.getElementById('recipes-grid');
const shoppingList = document.getElementById('shopping-list');
const copyShoppingListBtn = document.getElementById('copy-shopping-list-btn');
const exportShoppingListBtn = document.getElementById('export-shopping-list-btn');
const recipesListView = document.getElementById('recipes-list-view');
const recipeDetailView = document.getElementById('recipe-detail-view');
const favoritesGrid = document.getElementById('favorites-grid');
const favoritesEmptyState = document.getElementById('favorites-empty-state');
const historyGrid = document.getElementById('history-grid');
const historyEmptyState = document.getElementById('history-empty-state');

const apiKeyBtn = document.getElementById('api-key-btn');
const apiModal = document.getElementById('api-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const clearApiKeyBtn = document.getElementById('clear-api-key-btn');

/* ==========================================================================
   Initialization
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  runSplashScreenAnimation();
  initBackgroundParticles();

  // Restore existing Supabase session (handles page refresh without re-login)
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        currentSupabaseUser = session.user;
        await loadUserData();
      } else {
        loadPantryFromStorage(); // Load guest pantry from localStorage
      }
    } catch (err) {
      console.warn('Session restoration skipped:', err.message);
      loadPantryFromStorage();
    }
  } else {
    loadPantryFromStorage();
  }

  updateAuthUI();
  renderFavoritesGrid();
  renderHistoryGrid();
  initAntigravityFloaters();
  registerEventListeners();

  // Listen for auth state changes (sign-in, sign-out, token refresh)
  if (supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        currentSupabaseUser = session.user;
        await loadUserData();
        updateAuthUI();
        renderFavoritesGrid();
        renderHistoryGrid();
      } else {
        currentSupabaseUser = null;
        pantryList = [];
        favoritesList = [];
        historyList = [];
        loadPantryFromStorage();
        updateAuthUI();
        renderFavoritesGrid();
        renderHistoryGrid();
      }
    });
  }
});

/* ==========================================================================
   Antigravity Grocery Floating Engine
   ========================================================================== */
function initAntigravityFloaters() {
  // Spawn an initial cluster of floaters
  for (let i = 0; i < 8; i++) {
    createFloater(Math.random() * 100, Math.random() * -100);
  }
  
  // Continuously spawn floating groceries
  setInterval(() => {
    // Keep a maximum active count on screen to conserve CPU
    if (document.querySelectorAll('.floating-item').length < 15) {
      createFloater(Math.random() * 100, 0);
    }
  }, 2200);
}

function createFloater(leftPercent, startYOffsetPx = 0) {
  const floater = document.createElement('div');
  floater.className = 'floating-item';
  
  // Pick random emoji
  const emoji = GROCERY_EMOJIS[Math.floor(Math.random() * GROCERY_EMOJIS.length)];
  floater.textContent = emoji;
  
  // Randomize characteristics
  const size = 1.2 + Math.random() * 1.5; // size multiplier
  const duration = 10 + Math.random() * 12; // speed in seconds
  const delay = Math.random() * 2;
  const initialRotation = Math.random() * 360;
  
  floater.style.left = `${leftPercent}%`;
  floater.style.fontSize = `${size}rem`;
  floater.style.animationDuration = `${duration}s`;
  floater.style.animationDelay = `${delay}s`;
  floater.style.transform = `rotate(${initialRotation}deg)`;
  
  if (startYOffsetPx !== 0) {
    floater.style.transform += ` translateY(${startYOffsetPx}px)`;
  }
  
  canvas.appendChild(floater);
  
  // Clean up element after animation finishes
  setTimeout(() => {
    floater.remove();
  }, (duration + delay) * 1000);
}

/* ==========================================================================
   Event Handling & Operations
   ========================================================================== */
function registerEventListeners() {
  // Form submission
  ingredientForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = ingredientInput.value;
    addIngredient(val);
    ingredientInput.value = '';
    // Hide autocomplete on submit
    const suggContainer = document.getElementById('autocomplete-suggestions');
    if (suggContainer) {
      suggContainer.innerHTML = '';
      suggContainer.classList.add('hidden');
    }
  });

  // Autocomplete Suggestions Interaction
  const suggestionsContainer = document.getElementById('autocomplete-suggestions');
  let selectedSuggestionIndex = -1;
  let currentSuggestions = [];

  if (ingredientInput && suggestionsContainer) {
    // 1) input typing listener
    ingredientInput.addEventListener('input', () => {
      const query = ingredientInput.value.trim().toLowerCase();
      selectedSuggestionIndex = -1;
      
      if (query.length === 0) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.classList.add('hidden');
        currentSuggestions = [];
        return;
      }
      
      // Filter matching ingredients and ignore duplicates in pantry
      const queryWords = query.split(/\s+/).filter(Boolean);
      currentSuggestions = SUGGESTED_INGREDIENTS.filter(item => {
        const itemNameLower = item.toLowerCase();
        const matchesAny = queryWords.some(word => itemNameLower.includes(word));
        return matchesAny && !pantryList.some(p => p.toLowerCase() === item.toLowerCase());
      }).slice(0, 5); // Limit to top 5 suggestions
      
      if (currentSuggestions.length === 0) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.classList.add('hidden');
        return;
      }
      
      // Render elements
      suggestionsContainer.innerHTML = currentSuggestions.map((item, idx) => `
        <div class="suggestion-item" data-val="${item}" data-idx="${idx}">${item}</div>
      `).join('');
      suggestionsContainer.classList.remove('hidden');
    });

    // 2) keydown navigation listener
    ingredientInput.addEventListener('keydown', (e) => {
      if (suggestionsContainer.classList.contains('hidden')) return;
      
      const items = suggestionsContainer.querySelectorAll('.suggestion-item');
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex = (selectedSuggestionIndex + 1) % currentSuggestions.length;
        updateSelectedSuggestion(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex = (selectedSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
        updateSelectedSuggestion(items);
      } else if (e.key === 'Enter') {
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < currentSuggestions.length) {
          e.preventDefault();
          addIngredient(currentSuggestions[selectedSuggestionIndex]);
          ingredientInput.value = '';
          suggestionsContainer.innerHTML = '';
          suggestionsContainer.classList.add('hidden');
          currentSuggestions = [];
          selectedSuggestionIndex = -1;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.classList.add('hidden');
        currentSuggestions = [];
        selectedSuggestionIndex = -1;
      }
    });

    function updateSelectedSuggestion(elements) {
      elements.forEach((el, idx) => {
        if (idx === selectedSuggestionIndex) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });
    }

    // 3) Click item selection
    suggestionsContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        const val = item.getAttribute('data-val');
        addIngredient(val);
        ingredientInput.value = '';
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.classList.add('hidden');
        currentSuggestions = [];
        selectedSuggestionIndex = -1;
        ingredientInput.focus();
      }
    });

    // 4) Click away listener
    document.addEventListener('click', (e) => {
      if (!ingredientForm.contains(e.target)) {
        suggestionsContainer.innerHTML = '';
        suggestionsContainer.classList.add('hidden');
        currentSuggestions = [];
        selectedSuggestionIndex = -1;
      }
    });
  }

  // Quick Add click handler
  document.querySelectorAll('.quick-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const ingredient = btn.getAttribute('data-val');
      addIngredient(ingredient);
      
      // Micro-animation click effect on quick tag
      btn.style.transform = 'scale(0.92)';
      setTimeout(() => btn.style.transform = '', 150);
    });
  });

  // Clear All
  clearAllBtn.addEventListener('click', () => {
    pantryList = [];
    savePantryToStorage();
    renderPantryTags();
    resetResults();
  });

  // Suggest Recipes
  generateBtn.addEventListener('click', generateRecipes);

  // Settings Modal controls
  apiKeyBtn.addEventListener('click', () => {
    apiKeyInput.value = localStorage.getItem(API_KEY_STORAGE) || '';
    apiModal.classList.remove('hidden');
  });

  closeModalBtn.addEventListener('click', () => {
    apiModal.classList.add('hidden');
  });

  apiModal.addEventListener('click', (e) => {
    if (e.target === apiModal) {
      apiModal.classList.add('hidden');
    }
  });

  saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem(API_KEY_STORAGE, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
    apiModal.classList.add('hidden');
  });

  clearApiKeyBtn.addEventListener('click', () => {
    localStorage.removeItem(API_KEY_STORAGE);
    apiKeyInput.value = '';
    apiModal.classList.add('hidden');
  });

  // Copy Shopping List
  copyShoppingListBtn.addEventListener('click', copyShoppingListToClipboard);

  // Export Shopping List
  exportShoppingListBtn.addEventListener('click', exportShoppingList);

  // Tabs Switching Event Listeners
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPaneId = btn.getAttribute('data-pane');
      
      // Toggle button active classes
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Toggle pane hidden classes
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));
      document.getElementById(targetPaneId).classList.remove('hidden');
      
      // Close detail view if open when toggling tabs
      recipeDetailView.classList.add('hidden');
      
      // Refresh views accordingly
      if (targetPaneId === 'favorites-pane') {
        renderFavoritesGrid();
      } else if (targetPaneId === 'history-pane') {
        renderHistoryGrid();
      } else {
        // If switching back to recipes, ensure view list is shown
        recipesListView.classList.remove('hidden');
      }
    });
  });

  // Difficulty Toggle Filters Event Listeners
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const difficulty = btn.getAttribute('data-diff');
      
      // Toggle class active
      btn.classList.toggle('active');
      
      // Update active filters array
      if (btn.classList.contains('active')) {
        if (!activeFilters.includes(difficulty)) {
          activeFilters.push(difficulty);
        }
      } else {
        activeFilters = activeFilters.filter(d => d !== difficulty);
      }
      
      // Squeeze click effect
      btn.style.transform = 'scale(0.96)';
      setTimeout(() => btn.style.transform = '', 100);
      
      // Refresh recommended recipes based on updated active filters
      if (!outputResults.classList.contains('hidden')) {
        generateRecipesSilently();
      }
    });
  });
  
  // Integrated AI Chatbot Panel Event Listeners
  const panelChatForm = document.getElementById('panel-chat-form');
  const panelChatInput = document.getElementById('panel-chat-input');
  const panelChatMessages = document.getElementById('panel-chat-messages');
  const robotAvatarContainer = document.querySelector('.robot-avatar-container');
  const agentChatbotBtn = document.getElementById('agent-chatbot-btn');
  const closeChatbotBtn = document.getElementById('close-chatbot-btn');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const chatbotOverlay = document.getElementById('chatbot-overlay');

  if (agentChatbotBtn && chatbotOverlay) {
    agentChatbotBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chatbotOverlay.classList.toggle('active');
      if (chatbotOverlay.classList.contains('active')) {
        panelChatInput.focus();
      }
    });
  }

  if (closeChatbotBtn && chatbotOverlay) {
    closeChatbotBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chatbotOverlay.classList.remove('active');
    });
  }

  if (clearChatBtn && panelChatMessages) {
    clearChatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panelChatMessages.innerHTML = `
        <!-- Initial bot greeting -->
        <div class="chat-message bot">
          <div class="chat-avatar bot-avatar">🤖</div>
          <div class="message-content">
            <p>👋 Hello! I am <strong>WhizBot</strong>, your KitchenWhiz AI Companion.</p>
            <p>Ask me how to use the app, manage ingredients, copy recipes, check items, or link your keys!</p>
            <p>Try querying: <em>"How do I add garlic?"</em> or <em>"How to copy the shopping list?"</em></p>
          </div>
        </div>
      `;
    });
  }

  // Close chatbot when clicking outside
  document.addEventListener('click', (e) => {
    if (chatbotOverlay && chatbotOverlay.classList.contains('active')) {
      if (!chatbotOverlay.contains(e.target) && e.target !== agentChatbotBtn && !agentChatbotBtn.contains(e.target)) {
        chatbotOverlay.classList.remove('active');
      }
    }
  });

  // settings modal & list addition link catcher inside chat bubbles
  if (panelChatMessages) {
    panelChatMessages.addEventListener('click', (e) => {
      // 1. Settings modal trigger
      if (e.target.classList.contains('chat-settings-trigger') || e.target.id === 'chat-settings-link') {
        e.preventDefault();
        apiKeyInput.value = localStorage.getItem(API_KEY_STORAGE) || '';
        apiModal.classList.remove('hidden');
        return;
      }

      // 2. Intercept any button click inside chat bubbles
      const btn = e.target.closest('button');
      if (!btn) return;

      const btnText = btn.textContent.toLowerCase();
      const btnClass = btn.className.toLowerCase();

      // Check if it matches grocery or pantry patterns (class or text search)
      const isGrocery = btnText.includes('grocery') || btnText.includes('shopping') || btnClass.includes('grocery') || btnClass.includes('shopping') || btnClass.includes('list-btn');
      const isPantry = btnText.includes('pantry') || btnClass.includes('pantry') || btnClass.includes('add-pantry');

      if (isGrocery || isPantry) {
        e.preventDefault();
        
        // ── Item Extraction Strategy ──
        let items = [];

        // Strategy A: data-attributes
        const itemsAttr = btn.getAttribute('data-items') || btn.getAttribute('data-item') || btn.getAttribute('data-val');
        if (itemsAttr) {
          items = itemsAttr.split(',').map(i => i.trim()).filter(Boolean);
        }

        // Strategy B: If no attributes, parse from parent bubble content (strong or double-asterisk words)
        if (items.length === 0) {
          const bubble = btn.closest('.message-content');
          if (bubble) {
            // Find bold elements <strong> (markdown parsed **items**)
            const boldEls = bubble.querySelectorAll('strong');
            if (boldEls.length > 0) {
              items = Array.from(boldEls)
                .map(el => el.textContent.trim())
                .filter(txt => {
                  const t = txt.toLowerCase();
                  return t && 
                         t !== 'whizbot' && 
                         t !== 'pantry' && 
                         t !== 'grocery list' && 
                         t !== 'grocery' && 
                         t !== 'shopping list' &&
                         !t.includes('step') &&
                         !t.includes('click') &&
                         !t.includes('add');
                });
            }
            // Fallback: parse raw double asterisks from text directly
            if (items.length === 0) {
              const textContent = bubble.textContent;
              const matches = [...textContent.matchAll(/\*\*([^*]+)\*\*/g)].map(m => m[1].trim());
              items = matches.filter(txt => {
                const t = txt.toLowerCase();
                return t && t !== 'whizbot' && t !== 'pantry' && t !== 'grocery list' && t !== 'grocery';
              });
            }
          }
        }

        // Strategy C: Fallback to parsing from button text
        if (items.length === 0) {
          const cleanText = btn.textContent
            .replace(/add/i, '')
            .replace(/to/i, '')
            .replace(/grocery/i, '')
            .replace(/list/i, '')
            .replace(/pantry/i, '')
            .replace(/and/i, ',')
            .replace(/🛒/g, '')
            .replace(/🥑/g, '');
          items = cleanText.split(',').map(i => i.trim()).filter(Boolean);
        }

        if (items.length === 0) {
          showToast("⚠️ Could not detect any items to add.");
          return;
        }

        // ── Apply additions ──
        if (isGrocery) {
          items.forEach(item => {
            const exists = customShoppingList.some(x => x.name.toLowerCase() === item.toLowerCase());
            if (!exists) {
              customShoppingList.push({ name: item, checked: false });
            }
          });
          
          saveGroceryListToStorage();
          renderShoppingList();

          const shoppingSection = document.querySelector('.shopping-section');
          if (shoppingSection) {
            outputResults.classList.remove('hidden');
            outputEmptyState.classList.add('hidden');
            shoppingSection.scrollIntoView({ behavior: 'smooth' });
            shoppingSection.classList.add('highlight-glow');
            setTimeout(() => shoppingSection.classList.remove('highlight-glow'), 1500);
          }
          showToast(`🛒 Added ${items.join(', ')} to your Grocery List!`);
        } else if (isPantry) {
          items.forEach(item => {
            addIngredient(item);
          });
          showToast(`🥑 Added ${items.join(', ')} to your Pantry!`);
        }
      }
    });
  }

  // submit handler
  if (panelChatForm) {
    panelChatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = panelChatInput.value.trim();
      if (!query) return;

      // Append user bubble
      appendChatMessage('user', `<p>${query}</p>`);
      panelChatInput.value = '';

      // Animate robot avatar when responding
      if (robotAvatarContainer) {
        robotAvatarContainer.classList.add('speaking');
      }

      // Typing feedback bubble (bouncing dots indicator)
      const typingBubble = appendChatMessage('bot', `
        <div class="typing-container">
          <span class="typing-text">WhizBot is thinking</span>
          <div class="typing-loader"><span></span><span></span><span></span></div>
        </div>
      `);
      
      // Get response (queries API if key configured, else rule matcher)
      const botResponse = await generateAIChatResponse(query);
      
      // Remove typing indicator, append response
      typingBubble.remove();
      appendChatMessage('bot', botResponse);

      // Stop robot avatar speaking animation
      if (robotAvatarContainer) {
        robotAvatarContainer.classList.remove('speaking');
      }
    });
  }

  // --- AUTH FLOW EVENT LISTENERS ---
  const signinBtn = document.getElementById('signin-btn');
  const authModal = document.getElementById('auth-modal');
  const closeAuthBtn = document.getElementById('close-auth-btn');
  const authTabLogin = document.getElementById('auth-tab-login');
  const authTabSignup = document.getElementById('auth-tab-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authTitle = document.getElementById('auth-title');
  const authFormSlider = document.getElementById('auth-form-slider');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const signupErrorMsg = document.getElementById('signup-error-msg');

  function showAuthError(elementId, text) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
      errorEl.textContent = text;
      errorEl.classList.add('visible');
    }
  }

  function closeAuthModalSmoothly() {
    if (authModal) {
      authModal.classList.add('hidden');
      if (loginForm) loginForm.reset();
      if (signupForm) signupForm.reset();
      if (loginErrorMsg) {
        loginErrorMsg.textContent = '';
        loginErrorMsg.classList.remove('visible');
      }
      if (signupErrorMsg) {
        signupErrorMsg.textContent = '';
        signupErrorMsg.classList.remove('visible');
      }
      document.querySelectorAll('.password-toggle-btn').forEach(btn => {
        btn.textContent = '👁️';
      });
      document.querySelectorAll('.password-group input').forEach(input => {
        input.type = 'password';
      });
      if (authFormSlider) {
        authFormSlider.style.transform = 'translateX(0%)';
      }
      if (authTabLogin) authTabLogin.classList.add('active');
      if (authTabSignup) authTabSignup.classList.remove('active');
    }
  }

  if (signinBtn) {
    signinBtn.addEventListener('click', () => {
      if (!supabase) {
        showToast('⚠️ Authentication database is not configured in Vercel settings.');
        return;
      }
      if (authModal) authModal.classList.remove('hidden');
    });
  }

  if (closeAuthBtn) {
    closeAuthBtn.addEventListener('click', closeAuthModalSmoothly);
  }

  // Toggle between Login and Signup tabs via sliding slider
  if (authTabLogin && authTabSignup && authFormSlider && authTitle) {
    authTabLogin.addEventListener('click', () => {
      authTabLogin.classList.add('active');
      authTabSignup.classList.remove('active');
      authFormSlider.style.transform = 'translateX(0%)';
      authTitle.textContent = '🔐 KitchenWhiz Login';
      if (loginErrorMsg) {
        loginErrorMsg.textContent = '';
        loginErrorMsg.classList.remove('visible');
      }
      if (signupErrorMsg) {
        signupErrorMsg.textContent = '';
        signupErrorMsg.classList.remove('visible');
      }
    });

    authTabSignup.addEventListener('click', () => {
      authTabSignup.classList.add('active');
      authTabLogin.classList.remove('active');
      authFormSlider.style.transform = 'translateX(-50%)';
      authTitle.textContent = '📝 KitchenWhiz Sign Up';
      if (loginErrorMsg) {
        loginErrorMsg.textContent = '';
        loginErrorMsg.classList.remove('visible');
      }
      if (signupErrorMsg) {
        signupErrorMsg.textContent = '';
        signupErrorMsg.classList.remove('visible');
      }
    });
  }

  // Password fields show/hide button logic
  document.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pInput = btn.closest('.password-group').querySelector('input');
      if (pInput) {
        if (pInput.type === 'password') {
          pInput.type = 'text';
          btn.textContent = '🙈';
        } else {
          pInput.type = 'password';
          btn.textContent = '👁️';
        }
      }
    });
  });

  // Login submission with inline errors — Supabase Auth
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value.trim();
      const submitBtn = loginForm.querySelector('[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing in...'; }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Login'; }

      if (error) {
        showAuthError('login-error-msg', `❌ ${error.message}`);
      } else {
        closeAuthModalSmoothly(); // onAuthStateChange will update UI & load data
      }
    });
  }

  // Signup submission with inline errors — Supabase Auth
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value.trim();
      const submitBtn = signupForm.querySelector('[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating account...'; }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            preferences: { vegetarian: false, glutenFree: false, vegan: false, keto: false },
            categories: ''
          }
        }
      });
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Account'; }

      if (error) {
        showAuthError('signup-error-msg', `❌ ${error.message}`);
      } else {
        showAuthError('signup-error-msg', '✅ Account created! Check your email to confirm, then log in.');
        setTimeout(closeAuthModalSmoothly, 3500);
      }
    });
  }

  // Social logins — Supabase OAuth
  document.querySelectorAll('.social-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const isGoogle = btn.classList.contains('google-btn');
      if (isGoogle) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin }
        });
        if (error) {
          const toast = document.getElementById('confirm-toast');
          if (toast) {
            toast.textContent = `❌ Google Sign-In failed: ${error.message}`;
            toast.classList.remove('hidden');
            toast.classList.add('visible');
            setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.classList.add('hidden'), 350); }, 3000);
          }
        }
      } else {
        // Apple Sign-In requires Apple Developer account configuration
        const toast = document.getElementById('confirm-toast');
        if (toast) {
          toast.textContent = '🍎 Apple Sign-In requires additional setup. Please use email/password.';
          toast.classList.remove('hidden');
          toast.classList.add('visible');
          setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.classList.add('hidden'), 350); }, 3500);
        }
      }
    });
  });

  // --- PROFILE DROPDOWN EVENT LISTENERS ---
  const profileAvatar = document.getElementById('profile-avatar');
  const profileDropdown = document.getElementById('profile-dropdown');
  const dropdownProfileBtn = document.getElementById('dropdown-profile-btn');
  const dropdownListBtn = document.getElementById('dropdown-list-btn');
  const dropdownFavsBtn = document.getElementById('dropdown-favs-btn');
  const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');

  if (profileAvatar && profileDropdown) {
    profileAvatar.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('hidden');
    });
  }

  // Close profile dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (profileDropdown && !profileDropdown.classList.contains('hidden')) {
      if (!profileDropdown.contains(e.target) && e.target !== profileAvatar && !profileAvatar.contains(e.target)) {
        profileDropdown.classList.add('hidden');
      }
    }
  });

  // Profile modal elements
  const profileModal = document.getElementById('profile-modal');
  const closeProfileModalBtn = document.getElementById('close-profile-modal-btn');
  const saveProfileBtn = document.getElementById('save-profile-btn');
  
  // Inline edit name elements
  const editNameBtn = document.getElementById('edit-name-btn');
  const saveNameBtn = document.getElementById('save-name-btn');
  const cancelNameBtn = document.getElementById('cancel-name-btn');
  const editNameInput = document.getElementById('edit-name-input');
  
  // Inline edit email elements
  const editEmailBtn = document.getElementById('edit-email-btn');
  const saveEmailBtn = document.getElementById('save-email-btn');
  const cancelEmailBtn = document.getElementById('cancel-email-btn');
  const editEmailInput = document.getElementById('edit-email-input');

  // Avatar upload
  const profileAvatarTrigger = document.getElementById('profile-avatar-trigger');
  const avatarUploadInput = document.getElementById('avatar-upload-input');
  const profileModalImg = document.getElementById('profile-modal-img');

  // Password collapsible
  const changePwdToggleBtn = document.getElementById('change-pwd-toggle-btn');
  const changePwdContent = document.getElementById('change-pwd-content');
  const updatePwdBtn = document.getElementById('update-pwd-btn');

  // Toast feedback
  function showToast(message) {
    const toast = document.getElementById('confirm-toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.remove('hidden');
      toast.classList.add('visible');
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.classList.add('hidden'), 350);
      }, 2500);
    }
  }

  // Name inline edit toggle
  if (editNameBtn && editNameInput) {
    editNameBtn.addEventListener('click', () => {
      const nameVal = document.getElementById('profile-modal-name').textContent;
      editNameInput.value = nameVal;
      document.querySelector('#profile-name-group .view-mode').classList.add('hidden');
      document.querySelector('#profile-name-group .edit-mode').classList.remove('hidden');
      editNameInput.focus();
    });
  }

  if (saveNameBtn && editNameInput) {
    saveNameBtn.addEventListener('click', () => {
      const newVal = editNameInput.value.trim();
      if (newVal) {
        document.getElementById('profile-modal-name').textContent = newVal;
      }
      document.querySelector('#profile-name-group .view-mode').classList.remove('hidden');
      document.querySelector('#profile-name-group .edit-mode').classList.add('hidden');
    });
  }

  if (cancelNameBtn) {
    cancelNameBtn.addEventListener('click', () => {
      document.querySelector('#profile-name-group .view-mode').classList.remove('hidden');
      document.querySelector('#profile-name-group .edit-mode').classList.add('hidden');
    });
  }

  // Email inline edit toggle
  if (editEmailBtn && editEmailInput) {
    editEmailBtn.addEventListener('click', () => {
      const emailVal = document.getElementById('profile-modal-email').textContent;
      editEmailInput.value = emailVal;
      document.querySelector('#profile-email-group .view-mode').classList.add('hidden');
      document.querySelector('#profile-email-group .edit-mode').classList.remove('hidden');
      editEmailInput.focus();
    });
  }

  if (saveEmailBtn && editEmailInput) {
    saveEmailBtn.addEventListener('click', () => {
      const newVal = editEmailInput.value.trim();
      if (newVal) {
        document.getElementById('profile-modal-email').textContent = newVal;
      }
      document.querySelector('#profile-email-group .view-mode').classList.remove('hidden');
      document.querySelector('#profile-email-group .edit-mode').classList.add('hidden');
    });
  }

  if (cancelEmailBtn) {
    cancelEmailBtn.addEventListener('click', () => {
      document.querySelector('#profile-email-group .view-mode').classList.remove('hidden');
      document.querySelector('#profile-email-group .edit-mode').classList.add('hidden');
    });
  }

  // Avatar click triggers upload input
  if (profileAvatarTrigger && avatarUploadInput) {
    profileAvatarTrigger.addEventListener('click', () => {
      avatarUploadInput.click();
    });
  }

  // Handle avatar upload conversion to Base64
  if (avatarUploadInput) {
    avatarUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          tempUploadedAvatar = event.target.result;
          if (profileModalImg) profileModalImg.src = tempUploadedAvatar;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Password collapsible toggler
  if (changePwdToggleBtn && changePwdContent) {
    changePwdToggleBtn.addEventListener('click', () => {
      changePwdContent.classList.toggle('hidden');
      changePwdToggleBtn.classList.toggle('active');
    });
  }

  // Update password click — via Supabase Auth
  if (updatePwdBtn) {
    updatePwdBtn.addEventListener('click', async () => {
      const oldPwd = document.getElementById('profile-old-pwd').value.trim();
      const newPwd = document.getElementById('profile-new-pwd').value.trim();

      if (!currentSupabaseUser) {
        alert('❌ You must be logged in to change your password.');
        return;
      }
      if (newPwd.length < 6) {
        alert('❌ New password must be at least 6 characters.');
        return;
      }

      // Verify current password by attempting a silent re-sign-in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: currentSupabaseUser.email,
        password: oldPwd
      });
      if (verifyError) {
        alert('❌ Incorrect current password.');
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPwd });
      if (updateError) {
        alert(`❌ ${updateError.message}`);
        return;
      }

      showToast('🔐 Password updated successfully!');
      document.getElementById('profile-old-pwd').value = '';
      document.getElementById('profile-new-pwd').value = '';
      if (changePwdContent) changePwdContent.classList.add('hidden');
    });
  }

  if (dropdownProfileBtn && profileModal) {
    dropdownProfileBtn.addEventListener('click', () => {
      if (profileDropdown) profileDropdown.classList.add('hidden');
      profileModal.classList.remove('hidden');

      // Reset inline edits view
      document.querySelector('#profile-name-group .view-mode').classList.remove('hidden');
      document.querySelector('#profile-name-group .edit-mode').classList.add('hidden');
      document.querySelector('#profile-email-group .view-mode').classList.remove('hidden');
      document.querySelector('#profile-email-group .edit-mode').classList.add('hidden');
      
      // Close password pane
      if (changePwdContent) changePwdContent.classList.add('hidden');
      tempUploadedAvatar = null;

      // Populate user info inside modal
      const user = getCurrentUserObject();
      if (user) {
        document.getElementById('profile-modal-name').textContent = user.name || 'User';
        document.getElementById('profile-modal-email').textContent = user.email || '';
        
        // Load custom avatar Base64 or fallback to dicebear
        if (profileModalImg) {
          profileModalImg.src = user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || 'mona'}`;
        }
        
        document.getElementById('stat-pantry').textContent = pantryList.length;
        document.getElementById('stat-favorites').textContent = favoritesList.length;
        document.getElementById('stat-history').textContent = historyList.length;

        // Populate checkboxes
        const prefs = user.preferences || {};
        document.getElementById('pref-vegetarian').checked = !!prefs.vegetarian;
        document.getElementById('pref-gluten-free').checked = !!prefs.glutenFree;
        document.getElementById('pref-vegan').checked = !!prefs.vegan;
        document.getElementById('pref-keto').checked = !!prefs.keto;

        // Populate categories
        const catInput = document.getElementById('profile-categories');
        if (catInput) {
          catInput.value = user.categories || '';
        }
      }
    });
  }

  if (closeProfileModalBtn && profileModal) {
    closeProfileModalBtn.addEventListener('click', () => {
      profileModal.classList.add('hidden');
    });
  }

  if (saveProfileBtn && profileModal) {
    saveProfileBtn.addEventListener('click', async () => {
      if (!currentSupabaseUser) {
        profileModal.classList.add('hidden');
        return;
      }

      const newName = document.getElementById('profile-modal-name').textContent.trim();
      const preferences = {
        vegetarian: document.getElementById('pref-vegetarian').checked,
        glutenFree: document.getElementById('pref-gluten-free').checked,
        vegan: document.getElementById('pref-vegan').checked,
        keto: document.getElementById('pref-keto').checked
      };
      const catInput = document.getElementById('profile-categories');
      const categories = catInput ? catInput.value.trim() : '';

      const updatedMeta = { full_name: newName, preferences, categories };
      if (tempUploadedAvatar) updatedMeta.avatar_url = tempUploadedAvatar;

      const { data, error } = await supabase.auth.updateUser({ data: updatedMeta });
      if (error) {
        alert(`❌ Could not save profile: ${error.message}`);
        return;
      }

      currentSupabaseUser = data.user; // keep local reference in sync
      updateAuthUI();
      generateLocalRecipes(); // Refresh recommendations under new preferences
      showToast('✅ Profile changes saved successfully!');
      profileModal.classList.add('hidden');
    });
  }

  // Open Grocery List Modal
  if (dropdownListBtn) {
    dropdownListBtn.addEventListener('click', () => {
      if (profileDropdown) profileDropdown.classList.add('hidden');
      
      const emailEl = document.getElementById('grocery-modal-user-email');
      if (emailEl) {
        emailEl.textContent = currentSupabaseUser ? currentSupabaseUser.email : 'guest@kitchenwhiz.com';
      }
      
      renderModalGroceryList();
      const modal = document.getElementById('grocery-list-modal');
      if (modal) {
        modal.classList.remove('hidden');
      }
    });
  }

  // Bind Grocery Modal Event Listeners
  const groceryModal = document.getElementById('grocery-list-modal');
  const closeGrocModalBtn = document.getElementById('close-grocery-modal-btn');
  const closeGrocFooterBtn = document.getElementById('grocery-modal-close-footer-btn');
  const grocAddBtn = document.getElementById('grocery-modal-add-btn');
  const grocAddInput = document.getElementById('grocery-modal-add-input');
  const grocClearBtn = document.getElementById('grocery-modal-clear-btn');

  if (closeGrocModalBtn) {
    closeGrocModalBtn.addEventListener('click', () => {
      groceryModal.classList.add('hidden');
    });
  }
  if (closeGrocFooterBtn) {
    closeGrocFooterBtn.addEventListener('click', () => {
      groceryModal.classList.add('hidden');
    });
  }
  
  if (groceryModal) {
    groceryModal.addEventListener('click', (e) => {
      if (e.target === groceryModal) {
        groceryModal.classList.add('hidden');
      }
    });
  }

  if (grocAddBtn && grocAddInput) {
    const handleAdd = () => {
      const val = grocAddInput.value.trim();
      if (!val) return;
      
      const exists = customShoppingList.some(x => x.name.toLowerCase() === val.toLowerCase());
      if (!exists) {
        customShoppingList.push({ name: val, checked: false });
        saveGroceryListToStorage();
        renderModalGroceryList();
        renderShoppingList();
      } else {
        showToast("⚠️ Item is already in the list!");
      }
      grocAddInput.value = '';
    };

    grocAddBtn.addEventListener('click', handleAdd);
    grocAddInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleAdd();
      }
    });
  }

  const grocCopyBtn = document.getElementById('grocery-modal-copy-btn');
  const grocExportBtn = document.getElementById('grocery-modal-export-btn');

  if (grocClearBtn) {
    grocClearBtn.addEventListener('click', () => {
      customShoppingList = customShoppingList.filter(x => !x.checked);
      lastMissingIngredients = lastMissingIngredients.filter(x => !x.checked);
      saveGroceryListToStorage();
      renderModalGroceryList();
      renderShoppingList();
      showToast("🧹 Cleared checked items from list!");
    });
  }

  if (grocCopyBtn) {
    grocCopyBtn.addEventListener('click', copyModalShoppingList);
  }

  if (grocExportBtn) {
    grocExportBtn.addEventListener('click', exportModalShoppingList);
  }

  // Scroll to Favorites & History section
  if (dropdownFavsBtn) {
    dropdownFavsBtn.addEventListener('click', () => {
      if (profileDropdown) profileDropdown.classList.add('hidden');
      const rightPanel = document.querySelector('.right-panel');
      if (rightPanel) {
        rightPanel.scrollIntoView({ behavior: 'smooth' });
        rightPanel.classList.add('highlight-glow');
        setTimeout(() => rightPanel.classList.remove('highlight-glow'), 2000);
      }
      const favsTab = document.getElementById('tab-btn-favorites');
      if (favsTab) {
        favsTab.click();
      }
    });
  }

  // Logout handling — Supabase Auth
  if (dropdownLogoutBtn) {
    dropdownLogoutBtn.addEventListener('click', async () => {
      if (profileDropdown) profileDropdown.classList.add('hidden');
      await supabase.auth.signOut();
      resetResults(); // onAuthStateChange handles clearing state and updating UI
    });
  }
}

// --- AUTH & PROFILE UI UPDATER ---
function updateAuthUI() {
  const signinBtn = document.getElementById('signin-btn');
  const profileContainer = document.getElementById('profile-container');
  const dropdownUserName = document.getElementById('dropdown-user-name');
  const dropdownUserEmail = document.getElementById('dropdown-user-email');
  const profileImg = document.getElementById('profile-img');

  if (currentSupabaseUser) {
    const user = getCurrentUserObject();
    if (signinBtn) signinBtn.classList.add('hidden');
    if (profileContainer) profileContainer.classList.remove('hidden');
    if (dropdownUserName) dropdownUserName.textContent = user.name || 'User';
    if (dropdownUserEmail) dropdownUserEmail.textContent = currentSupabaseUser.email;
    if (profileImg) {
      profileImg.src = user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name || 'mona'}`;
    }
  } else {
    if (signinBtn) signinBtn.classList.remove('hidden');
    if (profileContainer) profileContainer.classList.add('hidden');
  }
}

/* ==========================================================================
   Pantry & Data Management — Supabase (logged in) + localStorage (guest)
   ========================================================================== */

/** Loads user pantry (localStorage), favorites & history (Supabase) after sign-in */
async function loadUserData() {
  // Pantry stored locally, keyed by Supabase user ID (survives offline)
  const userPantryKey = `kw_pantry_${currentSupabaseUser.id}`;
  try { pantryList = JSON.parse(localStorage.getItem(userPantryKey)) || []; } catch(e) { pantryList = []; }

  // ── Favorites: try Supabase first, fall back to localStorage ──────────────
  const { data: favData, error: favErr } = await supabase
    .from('favorites')
    .select('recipe')
    .eq('user_id', currentSupabaseUser.id)
    .order('created_at', { ascending: false });

  if (!favErr && favData && favData.length > 0) {
    // Got data from Supabase — use it and update the localStorage mirror
    favoritesList = favData.map(row => row.recipe);
    localStorage.setItem(`kw_favorites_${currentSupabaseUser.id}`, JSON.stringify(favoritesList));
  } else {
    // Supabase unavailable or empty — load from localStorage mirror
    const localFavKey = `kw_favorites_${currentSupabaseUser.id}`;
    try { favoritesList = JSON.parse(localStorage.getItem(localFavKey)) || []; } catch(e) { favoritesList = []; }
    if (favErr) console.warn('Supabase favorites unavailable, using local cache:', favErr.message);
  }

  // ── History: try Supabase first, fall back to localStorage ────────────────
  const { data: histData, error: histErr } = await supabase
    .from('history')
    .select('recipe')
    .eq('user_id', currentSupabaseUser.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!histErr && histData && histData.length > 0) {
    // Got data from Supabase — use it and update the localStorage mirror
    historyList = histData.map(row => row.recipe);
    localStorage.setItem(`kw_history_${currentSupabaseUser.id}`, JSON.stringify(historyList));
  } else {
    // Supabase unavailable or empty — load from localStorage mirror
    const localHistKey = `kw_history_${currentSupabaseUser.id}`;
    try { historyList = JSON.parse(localStorage.getItem(localHistKey)) || []; } catch(e) { historyList = []; }
    if (histErr) console.warn('Supabase history unavailable, using local cache:', histErr.message);
  }

  // ── Grocery List: try Supabase first, fall back to localStorage ──
  const { data: grocData, error: grocErr } = await supabase
    .from('grocery_list')
    .select('item, checked')
    .eq('user_id', currentSupabaseUser.id);

  if (!grocErr && grocData && grocData.length > 0) {
    customShoppingList = grocData.map(row => ({ name: row.item, checked: row.checked }));
    localStorage.setItem(`kw_custom_grocery_${currentSupabaseUser.id}`, JSON.stringify(customShoppingList));
  } else {
    const localGrocKey = `kw_custom_grocery_${currentSupabaseUser.id}`;
    try { customShoppingList = JSON.parse(localStorage.getItem(localGrocKey)) || []; } catch(e) { customShoppingList = []; }
    if (grocErr) console.warn('Supabase grocery list unavailable, using local cache:', grocErr.message);
  }

  const localMissingKey = `kw_last_missing_${currentSupabaseUser.id}`;
  try { lastMissingIngredients = JSON.parse(localStorage.getItem(localMissingKey)) || []; } catch(e) { lastMissingIngredients = []; }

  renderPantryTags();
  renderShoppingList();
}

/** Loads guest pantry from localStorage (no account required) */
function loadPantryFromStorage() {
  try { pantryList = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(e) { pantryList = []; }
  favoritesList = [];
  historyList = [];
  try { customShoppingList = JSON.parse(localStorage.getItem('antigravity_custom_grocery')) || []; } catch(e) { customShoppingList = []; }
  try { lastMissingIngredients = JSON.parse(localStorage.getItem('antigravity_last_missing')) || []; } catch(e) { lastMissingIngredients = []; }
  renderPantryTags();
  renderShoppingList();
}

function savePantryToStorage() {
  if (currentSupabaseUser) {
    // Keyed by user ID so different users on same device don't share pantry
    const userPantryKey = `kw_pantry_${currentSupabaseUser.id}`;
    localStorage.setItem(userPantryKey, JSON.stringify(pantryList));
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pantryList));
  }
}

async function saveFavoritesToStorage() {
  if (!currentSupabaseUser) return; // Guests cannot persist favorites

  // 1) Always write to localStorage first — this NEVER fails
  const localFavKey = `kw_favorites_${currentSupabaseUser.id}`;
  localStorage.setItem(localFavKey, JSON.stringify(favoritesList));

  // 2) Try to sync to Supabase (requires tables + RLS to be set up)
  try {
    const { error: delErr } = await supabase
      .from('favorites').delete().eq('user_id', currentSupabaseUser.id);
    if (delErr) throw delErr;
    if (favoritesList.length > 0) {
      const rows = favoritesList.map(recipe => ({ user_id: currentSupabaseUser.id, recipe }));
      const { error: insErr } = await supabase.from('favorites').insert(rows);
      if (insErr) throw insErr;
    }
  } catch (err) {
    // Supabase sync failed — localStorage copy is still intact
    console.warn('Supabase favorites sync failed (local cache is safe):', err.message);
  }
}

async function saveHistoryToStorage() {
  if (!currentSupabaseUser) return; // Guests do not persist history

  // 1) Always write to localStorage first — this NEVER fails
  const localHistKey = `kw_history_${currentSupabaseUser.id}`;
  localStorage.setItem(localHistKey, JSON.stringify(historyList));

  // 2) Try to sync to Supabase (requires tables + RLS to be set up)
  try {
    const { error: delErr } = await supabase
      .from('history').delete().eq('user_id', currentSupabaseUser.id);
    if (delErr) throw delErr;
    if (historyList.length > 0) {
      const rows = historyList.map(recipe => ({ user_id: currentSupabaseUser.id, recipe }));
      const { error: insErr } = await supabase.from('history').insert(rows);
      if (insErr) throw insErr;
    }
  } catch (err) {
    // Supabase sync failed — localStorage copy is still intact
    console.warn('Supabase history sync failed (local cache is safe):', err.message);
  }
}

async function saveGroceryListToStorage() {
  if (currentSupabaseUser) {
    // 1) Save to local storage first (reliable cache)
    const localGrocKey = `kw_custom_grocery_${currentSupabaseUser.id}`;
    localStorage.setItem(localGrocKey, JSON.stringify(customShoppingList));

    const localMissingKey = `kw_last_missing_${currentSupabaseUser.id}`;
    localStorage.setItem(localMissingKey, JSON.stringify(lastMissingIngredients));

    // 2) Try to sync custom items to Supabase
    try {
      const { error: delErr } = await supabase
        .from('grocery_list')
        .delete()
        .eq('user_id', currentSupabaseUser.id);
      if (delErr) throw delErr;

      if (customShoppingList.length > 0) {
        const rows = customShoppingList.map(item => ({
          user_id: currentSupabaseUser.id,
          item: item.name,
          checked: item.checked
        }));
        const { error: insErr } = await supabase.from('grocery_list').insert(rows);
        if (insErr) throw insErr;
      }
    } catch (err) {
      console.warn('Supabase grocery list sync failed (local cache is safe):', err.message);
    }
  } else {
    // Guest user persistence
    localStorage.setItem('antigravity_custom_grocery', JSON.stringify(customShoppingList));
    localStorage.setItem('antigravity_last_missing', JSON.stringify(lastMissingIngredients));
  }
}

function addIngredient(name) {
  const normalized = name.trim();
  
  // Validation 1: Empty input
  if (normalized.length === 0) {
    showToast("⚠️ Please enter an ingredient name.");
    return;
  }
  
  // Validation 2: Too long
  if (normalized.length > 30) {
    showToast("⚠️ Name too long! Keep under 30 characters.");
    return;
  }

  // Validation 3: Characters check (letters, spaces, hyphens only)
  const regex = /^[a-zA-Z\s\-]+$/;
  if (!regex.test(normalized)) {
    showToast("⚠️ Letters, spaces, and hyphens only.");
    return;
  }

  // Validation 4: Gibberish vowel/consonant checks (blocks things like BJGGYH, sdfg, qwr)
  const lowercase = normalized.toLowerCase();
  const hasVowels = /[aeiouy]/.test(lowercase);
  const consecutiveConsonants = /[^aeiou\s\-]{5,}/; // treats y as consonant for consecutive cluster check
  if (!hasVowels || consecutiveConsonants.test(lowercase)) {
    showToast("⚠️ Entry looks like gibberish. Please enter a real ingredient.");
    return;
  }

  // Validation 5: Duplicate check
  const exists = pantryList.some(item => item.toLowerCase() === normalized.toLowerCase());
  if (exists) {
    showToast(`⚠️ "${normalized}" is already in your pantry.`);
    return;
  }
  
  // Successfully verified! Add to list
  pantryList.push(normalized);
  savePantryToStorage();
  renderPantryTags();
}

function removeIngredient(event, index) {
  // Prevent double trigger if called multiple times quickly
  if (event.stopPropagation) event.stopPropagation();

  const btn = event.currentTarget || event.target;
  const tag = btn.closest('.pantry-tag');
  
  if (tag) {
    tag.classList.add('fade-out');
    
    const handleTransitionEnd = () => {
      pantryList.splice(index, 1);
      savePantryToStorage();
      renderPantryTags();
      
      if (pantryList.length === 0) {
        resetResults();
      } else {
        // If recommended recipes are currently visible, update them in real-time silenty
        if (!outputResults.classList.contains('hidden')) {
          generateRecipesSilently();
        }
      }
      tag.removeEventListener('transitionend', handleTransitionEnd);
    };
    
    tag.addEventListener('transitionend', handleTransitionEnd);
    
    // Fallback if transition event is skipped
    setTimeout(() => {
      if (tag.parentNode) {
        handleTransitionEnd();
      }
    }, 350);
  } else {
    // Normal fallback
    pantryList.splice(index, 1);
    savePantryToStorage();
    renderPantryTags();
    if (pantryList.length === 0) {
      resetResults();
    } else if (!outputResults.classList.contains('hidden')) {
      generateRecipesSilently();
    }
  }
}

// Bind to window so inline onclick handlers in modules work correctly
window.removeIngredient = removeIngredient;

function renderPantryTags() {
  // Clear container leaving empty state
  const tags = document.querySelectorAll('.pantry-tag');
  tags.forEach(t => t.remove());
  
  if (pantryList.length === 0) {
    emptyState.classList.remove('hidden');
    generateBtn.disabled = true;
  } else {
    emptyState.classList.add('hidden');
    generateBtn.disabled = false;
    
    pantryList.forEach((item, index) => {
      const tag = document.createElement('div');
      tag.className = 'pantry-tag';
      // UI rule: Display with a small ❌ delete button
      tag.innerHTML = `
        <span>${item}</span>
        <button class="delete-tag-btn" onclick="removeIngredient(event, ${index})">❌</button>
      `;
      tagsContainer.appendChild(tag);
    });
  }
  
  ingredientCountLabel.textContent = pantryList.length;
}

/* ==========================================================================
   Recipe Matcher & AI Generation
   ========================================================================== */
function resetResults() {
  customShoppingList = [];
  lastMissingIngredients = [];
  outputResults.classList.add('hidden');
  outputEmptyState.classList.remove('hidden');
  outputLoadingState.classList.add('hidden');
  recipesListView.classList.remove('hidden');
  recipeDetailView.classList.add('hidden');
}

async function generateRecipes() {
  if (pantryList.length === 0) return;
  
  outputEmptyState.classList.add('hidden');
  outputResults.classList.add('hidden');
  outputLoadingState.classList.remove('hidden');
  
  const apiKey = localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY;
  
  // Artificial slight delay for the visual culinary animation experience
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  if (apiKey) {
    try {
      await generateAIRecipes(apiKey);
    } catch (error) {
      console.error("AI Generation failed, falling back to local matcher", error);
      // Give the user clear visual feedback about why it failed (e.g. CORS block, network error, or invalid key)
      if (apiKey.startsWith('gsk_')) {
        showToast("⚠️ Groq API failed (CORS block). Falling back to local recipes.");
      } else {
        showToast("⚠️ AI Generation failed. Falling back to local recipes.");
      }
      await generateLocalRecipes();
    }
  } else {
    await generateLocalRecipes();
  }
}

// Silent updates (runs dynamic matching in background without clearing panel)
async function generateRecipesSilently() {
  if (pantryList.length === 0) return;
  const apiKey = localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY;
  
  if (apiKey) {
    try {
      await generateAIRecipes(apiKey);
    } catch (error) {
      console.error("Silent AI generation failed, falling back to local", error);
      await generateLocalRecipes();
    }
  } else {
    await generateLocalRecipes();
  }
}

/* ==========================================================================
   Recipe Synthesizer (Ensures at least 1 recipe has ONLY owned ingredients)
   ========================================================================== */
function synthesizePerfectMatchRecipe(ownedIngredients, targetDifficulty = "Easy") {
  // Normalize ingredients
  const ingredients = ownedIngredients.map(i => i.trim());
  const lowerIngredients = ingredients.map(i => i.toLowerCase());
  
  let title = "🥣 Custom Pantry Medley";
  let steps = [
    "Prep your available ingredients by washing and cutting them into uniform pieces.",
    "Heat a skillet with a tablespoon of oil or butter over medium heat.",
    "Sauté the ingredients in the pan, cooking firmer ingredients first, then softer ones.",
    "Season with salt, black pepper, and any dried herbs or spices you have on hand."
  ];
  let tips = [
    "Keep ingredient sizes uniform so they cook at the same rate.",
    "Drizzle with a bit of olive oil or soy sauce just before serving to add moisture."
  ];
  let prep = "5 mins";
  let cook = "10 mins";
  let diff = targetDifficulty;

  // Check for curd and millets combinations
  const hasCurd = lowerIngredients.includes("curd") || lowerIngredients.some(i => i.includes("curd") || i.includes("yogurt"));
  const hasMillets = lowerIngredients.includes("millets") || lowerIngredients.some(i => i.includes("millet"));
  const hasTomato = lowerIngredients.includes("tomato") || lowerIngredients.some(i => i.includes("tomato"));
  const hasEggs = lowerIngredients.includes("eggs") || lowerIngredients.some(i => i.includes("egg"));
  const hasBread = lowerIngredients.includes("bread") || lowerIngredients.some(i => i.includes("bread"));
  const hasCheese = lowerIngredients.includes("cheese") || lowerIngredients.some(i => i.includes("cheese"));
  const hasChicken = lowerIngredients.includes("chicken") || lowerIngredients.some(i => i.includes("chicken"));
  const hasPotato = lowerIngredients.includes("potato") || lowerIngredients.some(i => i.includes("potato"));
  const hasGarlic = lowerIngredients.includes("garlic") || lowerIngredients.some(i => i.includes("garlic"));

  if (hasCurd && hasMillets) {
    title = "🥣 Creamy Curd Millets";
    prep = "10 mins";
    cook = "20 mins";
    steps = [
      "Wash the millets thoroughly and pressure cook or boil with 3 times water until soft.",
      "Let the cooked millets cool down completely to room temperature.",
      "Fold in fresh curd (yogurt) and a pinch of salt until well mixed and creamy.",
      "If you have mustard seeds or curry leaves, temper them in hot oil and pour over the curd millets."
    ];
    tips = [
      "Make sure the millets are cool before adding curd, otherwise the curd will sour or curdle.",
      "Add a splash of milk if the mixture gets too thick."
    ];
  } else if (hasMillets) {
    title = "🌾 Savory Millet Porridge";
    prep = "5 mins";
    cook = "15 mins";
    steps = [
      "Dry roast the millets in a pot for 2 minutes until fragrant.",
      "Add 3 cups of water and bring to a boil, then reduce heat and simmer until the millets are tender.",
      "Stir in salt, pepper, and any available veggies or herbs.",
      "Simmer until it reaches a porridge-like consistency and serve warm."
    ];
    tips = [
      "Roasting the millets beforehand adds a delicious nutty flavor to the porridge.",
      "For a sweeter version, cook in milk and top with honey or sugar."
    ];
  } else if (hasCurd) {
    title = "🍨 Fresh Herb Curd Salad / Raita";
    prep = "5 mins";
    cook = "0 mins";
    steps = [
      "Whisk curd in a bowl until smooth and creamy.",
      "Finely chop any available vegetables (like onion, tomato, or potato) and stir them into the curd.",
      "Add a pinch of salt, roasted cumin powder, and chili powder if available.",
      "Chill in the fridge for 10 minutes before serving."
    ];
    tips = [
      "Serve as a cooling side dish alongside spicy dishes, or use it as a healthy dip.",
      "Garnish with coriander or mint leaves if you have them on hand."
    ];
  } else if (hasEggs && hasTomato) {
    title = "🍳 Scrambled Eggs with Tomatoes";
    prep = "5 mins";
    cook = "8 mins";
    steps = [
      "Whisk eggs in a bowl with salt and pepper.",
      "Sauté diced tomatoes in oil in a skillet until soft and juicy.",
      "Pour in the whisked eggs and gently scramble them together with the tomatoes.",
      "Remove from heat when eggs are just set but still moist."
    ];
    tips = [
      "Squeeze out excess liquid from tomatoes to prevent the scramble from becoming watery.",
      "Pairs wonderfully with a slice of toasted bread."
    ];
  } else if (hasBread && hasCheese) {
    title = "🥪 Golden Cheese Toastie";
    prep = "3 mins";
    cook = "5 mins";
    steps = [
      "Place cheese slices or grated cheese between two slices of bread.",
      "Butter the outer sides of the bread slices.",
      "Place in a hot pan over medium heat and toast until golden brown on the bottom.",
      "Flip and toast the other side until cheese is completely melted."
    ];
    tips = [
      "Cover the pan with a lid while grilling to trap heat and ensure cheese melts thoroughly.",
      "Add a thin slice of tomato inside if available for extra moisture."
    ];
  } else if (hasChicken && hasGarlic) {
    title = "🍗 Pan-seared Garlic Chicken";
    prep = "5 mins";
    cook = "15 mins";
    steps = [
      "Slice chicken into strips and mince garlic.",
      "Sauté minced garlic in a pan with butter or oil until fragrant.",
      "Add chicken and sear until cooked through and golden on both sides.",
      "Season with salt, pepper, and serve hot."
    ];
    tips = [
      "Be careful not to burn the garlic; sauté it on medium-low heat before adding the chicken.",
      "Deglaze the pan with a spoonful of water or lemon juice to glaze the chicken."
    ];
  } else if (ingredients.length === 1) {
    const ing = ingredients[0];
    title = `🍽️ Crispy Roasted ${ing}`;
    steps = [
      `Wash and cut the ${ing} into small, uniform pieces.`,
      "Toss with a little oil, salt, and pepper in a bowl.",
      "Spread on a baking tray or heat in a skillet.",
      `Roast or pan-fry until the ${ing} is crispy, browned, and tender.`
    ];
    tips = [
      "Preheat the oven or pan to ensure a nice crispy crunch.",
      "Great as a simple snack or a side dish."
    ];
  } else if (ingredients.length > 1) {
    const mainIngs = ingredients.slice(0, 2).join(" & ");
    title = `🍲 Sautéed ${mainIngs} Medley`;
    steps = [
      `Chop the ${ingredients.join(", ")} into bite-sized pieces.`,
      "Heat oil in a frying pan over medium-high heat.",
      `Sauté the items in the pan, cooking firmer ingredients first.`,
      "Season with salt, pepper, and serve hot."
    ];
  }

  // Adjust timing and complexity steps based on requested difficulty
  if (diff === "Medium") {
    prep = "12 mins";
    cook = "22 mins";
    steps.push("Allow to simmer on medium heat for an extra 5 minutes to intensify flavors.");
  } else if (diff === "Hard") {
    prep = "20 mins";
    cook = "40 mins";
    steps.unshift("Gently marinate ingredients in a light touch of oil, salt, and pepper for 10 minutes.");
    steps.push("Finish with a pan reduction or reduction glaze on high heat for premium texture.");
    tips.push("High heat reduction requires close observation—do not leave the stove!");
  }

  // Create ingredients list structures
  const ingredientsInfo = ingredients.map(ing => ({ name: ing, owned: true }));

  return {
    title: title,
    prepTime: prep,
    cookTime: cook,
    difficulty: diff,
    ingredients: ingredientsInfo,
    instructions: steps,
    tips: tips,
    perfectMatch: true,
    missing: []
  };
}

function isRecipeVegetarian(recipe) {
  const meatKeywords = ['chicken', 'beef', 'pork', 'bacon', 'shrimp', 'fish', 'meat', 'salmon', 'turkey', 'ham', 'lamb', 'sausage'];
  return !recipe.ingredients.some(ing => 
    meatKeywords.some(keyword => ing.toLowerCase().includes(keyword))
  ) && !recipe.title.toLowerCase().includes('chicken') && !recipe.title.toLowerCase().includes('beef') && !recipe.title.toLowerCase().includes('pork') && !recipe.title.toLowerCase().includes('bacon');
}

function isRecipeGlutenFree(recipe) {
  const glutenKeywords = ['pasta', 'bread', 'flour', 'wheat', 'noodle', 'soy sauce', 'semolina', 'barley', 'rye'];
  return !recipe.ingredients.some(ing => 
    glutenKeywords.some(keyword => ing.toLowerCase().includes(keyword))
  ) && !recipe.title.toLowerCase().includes('pasta') && !recipe.title.toLowerCase().includes('bread');
}

function isRecipeVegan(recipe) {
  const nonVeganKeywords = ['chicken', 'beef', 'pork', 'bacon', 'shrimp', 'fish', 'meat', 'salmon', 'turkey', 'ham', 'lamb', 'sausage', 'egg', 'cheese', 'butter', 'cream', 'milk', 'honey', 'yogurt'];
  return !recipe.ingredients.some(ing => 
    nonVeganKeywords.some(keyword => ing.toLowerCase().includes(keyword))
  ) && !recipe.title.toLowerCase().includes('cheese') && !recipe.title.toLowerCase().includes('omelette') && !recipe.title.toLowerCase().includes('chicken') && !recipe.title.toLowerCase().includes('beef') && !recipe.title.toLowerCase().includes('pork');
}

function isRecipeKeto(recipe) {
  const nonKetoKeywords = ['pasta', 'bread', 'flour', 'wheat', 'noodle', 'sugar', 'rice', 'potato', 'honey', 'corn', 'bean'];
  return !recipe.ingredients.some(ing => 
    nonKetoKeywords.some(keyword => ing.toLowerCase().includes(keyword))
  ) && !recipe.title.toLowerCase().includes('pasta') && !recipe.title.toLowerCase().includes('bread') && !recipe.title.toLowerCase().includes('rice');
}

/* Local Matching Engine (Text scoring & Ranking) */
async function generateLocalRecipes() {
  const matches = [];
  const currentUser = getCurrentUserObject();
  const isVegetarianFilter = currentUser?.preferences?.vegetarian;
  const isGlutenFreeFilter = currentUser?.preferences?.glutenFree;
  const isVeganFilter = currentUser?.preferences?.vegan;
  const isKetoFilter = currentUser?.preferences?.keto;

  let filteredRecipes = LOCAL_RECIPES;
  if (isVegetarianFilter) {
    filteredRecipes = filteredRecipes.filter(r => isRecipeVegetarian(r));
  }
  if (isGlutenFreeFilter) {
    filteredRecipes = filteredRecipes.filter(r => isRecipeGlutenFree(r));
  }
  if (isVeganFilter) {
    filteredRecipes = filteredRecipes.filter(r => isRecipeVegan(r));
  }
  if (isKetoFilter) {
    filteredRecipes = filteredRecipes.filter(r => isRecipeKeto(r));
  }
  
  filteredRecipes.forEach(recipe => {
    let matchCount = 0;
    const recipeIngredientsInfo = recipe.ingredients.map(ing => {
      const isOwned = pantryList.some(owned => 
        owned.toLowerCase().includes(ing.toLowerCase()) || 
        ing.toLowerCase().includes(owned.toLowerCase())
      );
      
      if (isOwned) matchCount++;
      return { name: ing, owned: isOwned };
    });
    
    const missing = recipeIngredientsInfo.filter(i => !i.owned).map(i => i.name);
    
    matches.push({
      title: recipe.title,
      perfectMatch: matchCount === recipe.ingredients.length,
      matchPercentage: (matchCount / recipe.ingredients.length) * 100,
      matchCount: matchCount,
      ingredients: recipeIngredientsInfo,
      instructions: recipe.instructions,
      tips: recipe.tips,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      difficulty: recipe.difficulty,
      missing: missing
    });
  });
  
  // Sort: highest matches first
  matches.sort((a, b) => b.matchCount - a.matchCount || b.matchPercentage - a.matchPercentage);
  
  // Filter matches by active difficulty filters
  const filtered = matches.filter(m => activeFilters.includes(m.difficulty));
  
  // Rule: At least 1 recipe must use ONLY current ingredients (perfectMatch).
  const hasPerfectMatch = filtered.some(f => f.perfectMatch);
  
  let topRecipes = [];
  if (!hasPerfectMatch && pantryList.length > 0) {
    const synthDiff = activeFilters[0] || "Easy";
    const synthesized = synthesizePerfectMatchRecipe(pantryList, synthDiff);
    topRecipes = [synthesized, ...filtered.slice(0, 2)];
  } else {
    topRecipes = filtered.slice(0, 3);
  }
  
  currentRecipes = topRecipes;
  await addToHistory(topRecipes);
  
  // Aggregate shopping list of missing ingredients
  const uniqueMissing = new Set();
  topRecipes.forEach(rec => {
    rec.missing.forEach(m => uniqueMissing.add(m));
  });
  
  renderResults(topRecipes, Array.from(uniqueMissing));
}

/* Gemini/Groq API Generation Engine */
async function generateAIRecipes(apiKey) {
  const isGroq = apiKey.startsWith('gsk_');

  const prompt = `Act as a professional chef assistant. Given the following user ingredients in their kitchen: ${pantryList.join(', ')}.
Generate exactly 2 to 3 recipe ideas that use some of these ingredients.

You MUST follow these rules:
1. ONLY suggest recipes that have difficulty levels matching one of these selected: [${activeFilters.join(', ')}].
2. At least 1 recommended recipe must use ONLY the user's current ingredients (no extra/missing ingredients).
3. The other recipes can combine the user's current ingredients with common pantry items (these will be marked as missing ingredients).
4. If unusual ingredients are added (e.g. curd, millets, etc.), you must generate creative and appropriate recipes centered around them.

For each recipe, provide:
1. Recipe Title (with an appropriate emoji)
2. Preparation time (e.g. "10 mins")
3. Cooking time (e.g. "15 mins")
4. Difficulty level (MUST be one of: [${activeFilters.join(', ')}])
5. Servings (MUST be an integer, e.g. 2)
6. Nutrition estimation: calories (integer), protein (g string), carbs (g string), fat (g string).
7. Equipment needed: list of tools/utensils (e.g. ["skillet", "chef's knife"]).
8. Ingredients list, specifying name, amount (number), unit (string like "g", "ml", "tbsp", "pcs", "slices"), and if they are already in the user's pantry (owned = true) or if they are missing (owned = false).
9. Step-by-step instructions in numbered format (as a JSON array of steps).
10. Tips (as a JSON array of 1-2 helpful cooking tips).

Format the response as a valid JSON object matching this structure:
{
  "recipes": [
    {
      "title": "Recipe Name with Emoji",
      "perfectMatch": true/false,
      "prepTime": "10 mins",
      "cookTime": "15 mins",
      "difficulty": "Easy",
      "servings": 2,
      "nutrition": {
        "calories": 420,
        "protein": "18g",
        "carbs": "56g",
        "fat": "12g"
      },
      "equipment": ["non-stick pan", "spatula"],
      "ingredients": [
        { "name": "Ingredient Name", "amount": 100, "unit": "g", "owned": true }
      ],
      "instructions": [
        "Step 1...",
        "Step 2..."
      ],
      "tips": [
        "Tip 1...",
        "Tip 2..."
      ]
    }
  ],
  "shoppingList": ["Missing Ingredient 1", "Missing Ingredient 2"]
}
Ensure your output is strictly valid JSON only. Do not wrap the JSON output in markdown formatting blocks. Just reply with the raw JSON string.`;

  let responseData;
  
  if (isGroq) {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Groq API error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    const contentText = data.choices[0].message.content.trim();
    responseData = parseResponseJSON(contentText);
  } else {
    // Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text.trim();
    responseData = parseResponseJSON(text);
  }
  
  currentRecipes = responseData.recipes;
  await addToHistory(responseData.recipes);
  renderResults(responseData.recipes, responseData.shoppingList);
}

// Clean markdown wrapper blocks if the model ignores the instruction
function parseResponseJSON(rawText) {
  let text = rawText;
  if (text.startsWith('```')) {
    text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  }
  return JSON.parse(text);
}

/* Render Output Cards & List */
function renderResults(recipes, missingList) {
  recipesGrid.innerHTML = '';
  
  // Render Recipe Cards
  recipes.forEach((recipe, idx) => {
    const card = createRecipeCard(recipe, `rec-${idx}`);
    recipesGrid.appendChild(card);
  });
  
  // Save most recent recipe missing list & render combined list
  lastMissingIngredients = (missingList || []).map(name => ({ name, checked: false }));
  saveGroceryListToStorage();
  renderShoppingList();
  
  // Transition views
  outputLoadingState.classList.add('hidden');
  outputResults.classList.remove('hidden');
  
  // Ensure default list view is shown and detail is hidden
  recipesListView.classList.remove('hidden');
  recipeDetailView.classList.add('hidden');
}

/* Helper to render combined recipe missing list + manual custom items */
function renderShoppingList() {
  shoppingList.innerHTML = '';
  
  // Deduplicate combined list by item name (case-insensitive)
  const seen = new Set();
  const combinedList = [];
  
  [...lastMissingIngredients, ...customShoppingList].forEach(item => {
    if (!item || !item.name) return;
    const lowerName = item.name.toLowerCase();
    if (!seen.has(lowerName)) {
      seen.add(lowerName);
      combinedList.push(item);
    }
  });

  if (combinedList.length === 0) {
    shoppingList.innerHTML = `
      <div class="empty-tag-state" style="padding: 1rem 0;">
        <span class="empty-emoji">🎉</span>
        <p>Your grocery list is empty!</p>
      </div>
    `;
  } else {
    combinedList.forEach((item, index) => {
      const li = document.createElement('li');
      if (item.checked) {
        li.className = 'checked';
      }
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `shop-item-${index}`;
      checkbox.checked = !!item.checked;
      
      checkbox.addEventListener('change', () => {
        const isChecked = checkbox.checked;
        li.classList.toggle('checked', isChecked);
        
        // Update check state in memory lists
        customShoppingList = customShoppingList.map(x => {
          if (x.name.toLowerCase() === item.name.toLowerCase()) {
            return { ...x, checked: isChecked };
          }
          return x;
        });
        
        lastMissingIngredients = lastMissingIngredients.map(x => {
          if (x.name.toLowerCase() === item.name.toLowerCase()) {
            return { ...x, checked: isChecked };
          }
          return x;
        });
        
        saveGroceryListToStorage();
      });
      
      const label = document.createElement('label');
      label.htmlFor = `shop-item-${index}`;
      label.textContent = item.name;
      
      const container = document.createElement('div');
      container.className = 'shopping-item';
      container.appendChild(checkbox);
      container.appendChild(label);
      
      li.appendChild(container);
      shoppingList.appendChild(li);
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Recipe Side Panel — slides in from the right (~1/3 screen width)
   ═══════════════════════════════════════════════════════════════════ */
let _sidePanelRecipe = null; // track which recipe is open

/* ── Enricher to guarantee Servings, Nutrition, Equipment & Amounts are fully populated ── */
function enrichRecipe(recipe) {
  // 1. Servings
  if (!recipe.servings) {
    recipe.servings = 2;
  }

  // 2. Nutrition
  if (!recipe.nutrition || typeof recipe.nutrition !== 'object') {
    const title = (recipe.title || '').toLowerCase();
    let cal = 420; let pro = 16; let carb = 54; let fat = 12;
    if (title.includes('chicken') || title.includes('meat') || title.includes('beef')) {
      cal = 520; pro = 32; carb = 12; fat = 18;
    } else if (title.includes('pasta') || title.includes('bread') || title.includes('rice')) {
      cal = 610; pro = 11; carb = 88; fat = 8;
    } else if (title.includes('omelette') || title.includes('egg')) {
      cal = 310; pro = 17; carb = 4; fat = 15;
    } else if (title.includes('salad') || title.includes('spinach')) {
      cal = 240; pro = 6; carb = 12; fat = 9;
    }
    recipe.nutrition = { calories: cal, protein: `${pro}g`, carbs: `${carb}g`, fat: `${fat}g` };
  }

  // 3. Equipment
  if (!recipe.equipment || !Array.isArray(recipe.equipment) || recipe.equipment.length === 0) {
    const equip = new Set();
    const instStr = (recipe.instructions || []).join(' ').toLowerCase();
    if (instStr.includes('boil') || instStr.includes('pot') || instStr.includes('water')) equip.add('Pot');
    if (instStr.includes('sauté') || instStr.includes('skillet') || instStr.includes('fry') || instStr.includes('pan')) equip.add('Skillet');
    if (instStr.includes('whisk') || instStr.includes('bowl')) equip.add('Mixing Bowl');
    if (instStr.includes('whisk')) equip.add('Whisk');
    if (instStr.includes('chop') || instStr.includes('mince') || instStr.includes('cut') || instStr.includes('slice') || instStr.includes('garlic')) {
      equip.add('Chef\'s Knife');
      equip.add('Cutting Board');
    }
    if (instStr.includes('bake') || instStr.includes('oven')) equip.add('Oven');
    if (equip.size === 0) {
      recipe.equipment = ['Skillet', 'Chef\'s Knife', 'Spatula'];
    } else {
      recipe.equipment = Array.from(equip);
    }
  }

  // 4. Ingredients structures (amounts & units)
  if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
    recipe.ingredients = recipe.ingredients.map(ing => {
      let name = typeof ing === 'string' ? ing : ing.name;
      let owned = typeof ing === 'object' && ing.owned !== undefined ? ing.owned : false;
      let amount = typeof ing === 'object' && ing.amount !== undefined ? ing.amount : null;
      let unit = typeof ing === 'object' && ing.unit !== undefined ? ing.unit : null;

      if (!amount || !unit) {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('chicken') || lowerName.includes('beef') || lowerName.includes('shrimp')) {
          amount = 250; unit = 'g';
        } else if (lowerName.includes('pasta') || lowerName.includes('rice') || lowerName.includes('noodle')) {
          amount = 150; unit = 'g';
        } else if (lowerName.includes('spinach') || lowerName.includes('vegetables') || lowerName.includes('tomato')) {
          amount = 100; unit = 'g';
        } else if (lowerName.includes('garlic')) {
          amount = 3; unit = 'cloves';
        } else if (lowerName.includes('egg')) {
          amount = 3; unit = 'pcs';
        } else if (lowerName.includes('cheese') || lowerName.includes('butter')) {
          amount = 50; unit = 'g';
        } else if (lowerName.includes('oil') || lowerName.includes('sauce') || lowerName.includes('water')) {
          amount = 2; unit = 'tbsp';
        } else if (lowerName.includes('bread')) {
          amount = 4; unit = 'slices';
        } else {
          amount = 100; unit = 'g';
        }
      }
      return { name, owned, amount, unit };
    });
  }
  return recipe;
}

function openRecipePanel(recipe) {
  // Enrich recipe fields first
  recipe = enrichRecipe(recipe);
  _sidePanelRecipe = recipe;

  const panel     = document.getElementById('recipe-side-panel');
  const backdrop  = panel.querySelector('.side-panel-backdrop');
  const drawer    = panel.querySelector('.side-panel-drawer');

  // Populate title & badge
  document.getElementById('side-panel-title').textContent = recipe.title;
  const badge = document.getElementById('side-panel-badge');
  badge.textContent  = recipe.perfectMatch ? '✨ Perfect Match' : '🛒 Needs Items';
  badge.className    = `side-panel-chip ${recipe.perfectMatch ? 'chip-perfect' : 'chip-partial'}`;

  // Meta row (prep, cook, difficulty)
  document.getElementById('sp-prep').textContent = recipe.prepTime  || '10 mins';
  document.getElementById('sp-cook').textContent = recipe.cookTime  || '15 mins';
  const diffEl = document.getElementById('sp-diff');
  diffEl.textContent = recipe.difficulty || 'Easy';
  diffEl.className   = `spanel-meta-pill sp-diff diff-${(recipe.difficulty || 'Easy').toLowerCase()}`;

  // Favourite button state
  const favBtn = document.getElementById('side-panel-fav-btn');
  const isFav = favoritesList.some(f => f.title.toLowerCase() === recipe.title.toLowerCase());
  favBtn.classList.toggle('active', isFav);

  // Nutrition Card Values
  document.getElementById('sp-nut-cal').textContent = recipe.nutrition.calories || '450';
  document.getElementById('sp-nut-pro').textContent = recipe.nutrition.protein || '20g';
  document.getElementById('sp-nut-carb').textContent = recipe.nutrition.carbs || '55g';
  document.getElementById('sp-nut-fat').textContent = recipe.nutrition.fat || '12g';

  // Kitchen Equipment pills
  const eqList = document.getElementById('sp-equipment');
  eqList.innerHTML = recipe.equipment.map(eq => `<span class="sp-eq-pill">&#x1F6E0;&#xFE0F; ${eq}</span>`).join('');

  // ── Servings Scaling ──────────────────────────────────────────────
  let currentServings = recipe.servings || 2;
  const servingsVal = document.getElementById('sp-servings-val');
  servingsVal.textContent = currentServings;

  const decBtn = document.getElementById('sp-servings-dec');
  const incBtn = document.getElementById('sp-servings-inc');

  // Strip older listeners
  const newDec = decBtn.cloneNode(true);
  const newInc = incBtn.cloneNode(true);
  decBtn.parentNode.replaceChild(newDec, decBtn);
  incBtn.parentNode.replaceChild(newInc, incBtn);

  newDec.addEventListener('click', () => {
    if (currentServings > 1) {
      currentServings--;
      servingsVal.textContent = currentServings;
      renderPanelIngredients(currentServings);
    }
  });

  newInc.addEventListener('click', () => {
    if (currentServings < 12) {
      currentServings++;
      servingsVal.textContent = currentServings;
      renderPanelIngredients(currentServings);
    }
  });

  // ── Ingredients render helper (takes serving scaling into account) ─
  const ingList = document.getElementById('sp-ingredients');
  function renderPanelIngredients(servings) {
    const factor = servings / recipe.servings;
    
    ingList.innerHTML = recipe.ingredients.map((ing, idx) => {
      // Multiply the quantity by the scaling factor
      const scaledAmount = Math.round(ing.amount * factor * 10) / 10;
      return `
        <li class="sp-ing-item ${ing.owned ? 'owned' : 'missing'}" id="sp-ing-li-${idx}">
          <label class="sp-ing-label">
            <input type="checkbox" class="sp-ing-cb" data-idx="${idx}" ${ing.owned ? 'checked' : ''}>
            <span class="sp-ing-check-icon">${ing.owned ? '✅' : '⬜'}</span>
            <span class="sp-ing-quantity"><strong style="color: #ffffff;">${scaledAmount}</strong> ${ing.unit}</span>
            <span class="sp-ing-name">${ing.name}</span>
            <span class="sp-ing-status">${ing.owned ? 'Have it' : 'Need it'}</span>
          </label>
        </li>
      `;
    }).join('');

    // Rebind checkbox strike-through style on check/uncheck
    ingList.querySelectorAll('.sp-ing-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const li = cb.closest('li');
        const icon = li.querySelector('.sp-ing-check-icon');
        const status = li.querySelector('.sp-ing-status');
        if (cb.checked) {
          li.classList.add('owned'); li.classList.remove('missing');
          icon.textContent = '✅'; status.textContent = 'Have it';
        } else {
          li.classList.remove('owned'); li.classList.add('missing');
          icon.textContent = '⬜'; status.textContent = 'Need it';
        }
      });
    });
  }

  // Initial render of scaled ingredients list
  renderPanelIngredients(currentServings);

  // ── Steps ─────────────────────────────────────────────────────────
  const stepEmojis = ['🍳','🥣','🔥','🍽️','🥗','🥘','🔪','⏳'];
  document.getElementById('sp-steps').innerHTML = recipe.instructions.map((step, idx) => `
    <div class="sp-step-item">
      <div class="sp-step-number">${idx + 1}</div>
      <div class="sp-step-body">
        <span class="sp-step-emoji">${stepEmojis[idx % stepEmojis.length]}</span>
        <span class="sp-step-text">${step}</span>
      </div>
    </div>
  `).join('');

  // ── Tips ──────────────────────────────────────────────────────────
  const tipsArr = Array.isArray(recipe.tips) ? recipe.tips : (recipe.tips ? [recipe.tips] : ['Always preheat your pan for the best caramelisation.']);
  document.getElementById('sp-tips').innerHTML = tipsArr.map(tip => `
    <li class="sp-tip-item"><span class="sp-tip-dot">💡</span>${tip}</li>
  `).join('');

  // ── Show panel ────────────────────────────────────────────────────
  panel.classList.remove('hidden');
  requestAnimationFrame(() => {
    panel.classList.add('open');
    document.body.classList.add('panel-open');
  });

  // Reset scroll
  drawer.querySelector('.side-panel-scroll').scrollTop = 0;
}

function closeRecipePanel() {
  const panel = document.getElementById('recipe-side-panel');
  panel.classList.remove('open');
  document.body.classList.remove('panel-open');
  panel.addEventListener('transitionend', () => {
    panel.classList.add('hidden');
  }, { once: true });
  _sidePanelRecipe = null;
}

// Wire up close button + backdrop
document.addEventListener('DOMContentLoaded', () => {
  const panel    = document.getElementById('recipe-side-panel');
  const closeBtn = document.getElementById('side-panel-close');
  const backdrop = panel?.querySelector('.side-panel-backdrop');
  const favBtn   = document.getElementById('side-panel-fav-btn');

  if (closeBtn) closeBtn.addEventListener('click', closeRecipePanel);
  if (backdrop) backdrop.addEventListener('click', closeRecipePanel);

  // Escape key closes panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRecipePanel();
  });

  // Favourite toggle from side panel
  if (favBtn) {
    favBtn.addEventListener('click', async () => {
      if (!_sidePanelRecipe) return;
      await toggleFavorite(null, _sidePanelRecipe.title);
      const isFav = favoritesList.some(f => f.title.toLowerCase() === _sidePanelRecipe.title.toLowerCase());
      favBtn.classList.toggle('active', isFav);
    });
  }
});

// Legacy compat alias
function showRecipeDetail(recipe) { openRecipePanel(recipe); }
window.showRecipeDetail = showRecipeDetail;

/* Copy Unchecked Items to Clipboard */
function copyShoppingListToClipboard() {
  const items = [];
  document.querySelectorAll('#shopping-list li').forEach(li => {
    const checkbox = li.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.checked) {
      const label = li.querySelector('label');
      items.push(`- [ ] ${label.textContent}`);
    }
  });
  
  if (items.length === 0) {
    const originalText = copyShoppingListBtn.innerHTML;
    copyShoppingListBtn.innerHTML = '⚠️ Nothing to copy!';
    setTimeout(() => {
      copyShoppingListBtn.innerHTML = originalText;
    }, 2000);
    return;
  }
  
  const text = `KitchenWhiz - Unpurchased Items:\n${items.join('\n')}`;
  
  navigator.clipboard.writeText(text).then(() => {
    const originalText = copyShoppingListBtn.innerHTML;
    copyShoppingListBtn.innerHTML = '✓ Copied!';
    setTimeout(() => {
      copyShoppingListBtn.innerHTML = originalText;
    }, 2000);
  });
}

/* Export Unchecked Items as txt File */
function exportShoppingList() {
  const items = [];
  document.querySelectorAll('#shopping-list li').forEach(li => {
    const checkbox = li.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.checked) {
      const label = li.querySelector('label');
      items.push(`- [ ] ${label.textContent}`);
    }
  });
  
  if (items.length === 0) {
    const originalText = exportShoppingListBtn.innerHTML;
    exportShoppingListBtn.innerHTML = '⚠️ Empty!';
    setTimeout(() => {
      exportShoppingListBtn.innerHTML = originalText;
    }, 2000);
    return;
  }
  
  const text = `KitchenWhiz - Pending Shopping Items:\n${items.join('\n')}`;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'shopping-list.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  const originalText = exportShoppingListBtn.innerHTML;
  exportShoppingListBtn.innerHTML = '✓ Exported!';
  setTimeout(() => {
    exportShoppingListBtn.innerHTML = originalText;
  }, 2000);
}

/* ==========================================================================
   History Tracker (Keeps last 5 unique suggested recipes)
   ========================================================================== */
async function addToHistory(recipes) {
  if (!recipes || recipes.length === 0) return;
  
  recipes.forEach(recipe => {
    // Avoid duplicates by title
    const existsIndex = historyList.findIndex(h => h.title.toLowerCase() === recipe.title.toLowerCase());
    if (existsIndex > -1) {
      historyList.splice(existsIndex, 1);
    }
    // Add to top of history
    historyList.unshift(recipe);
  });
  
  // Keep only last 5 unique items
  if (historyList.length > 5) {
    historyList = historyList.slice(0, 5);
  }
  
  await saveHistoryToStorage();
}

function renderHistoryGrid() {
  historyGrid.innerHTML = '';
  
  if (historyList.length === 0) {
    historyEmptyState.classList.remove('hidden');
  } else {
    historyEmptyState.classList.add('hidden');
    
    historyList.forEach((recipe, idx) => {
      const card = createRecipeCard(recipe, `hist-${idx}`);
      historyGrid.appendChild(card);
    });
  }
}

/* ==========================================================================
   Favorites Manager
   ========================================================================== */
async function toggleFavorite(event, recipeTitle) {
  if (event) event.stopPropagation();

  // Guests must be signed in to save favorites
  if (!currentSupabaseUser) {
    const toast = document.getElementById('confirm-toast');
    if (toast) {
      toast.textContent = '🔒 Sign in to save favorites!';
      toast.classList.remove('hidden');
      toast.classList.add('visible');
      setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.classList.add('hidden'), 350); }, 2500);
    }
    return;
  }
  
  const favIdx = favoritesList.findIndex(f => f.title.toLowerCase() === recipeTitle.toLowerCase());
  
  if (favIdx > -1) {
    // Remove from favorites
    favoritesList.splice(favIdx, 1);
  } else {
    // Add to favorites. Find recipe object in current list or history
    let recipeObj = currentRecipes.find(r => r.title.toLowerCase() === recipeTitle.toLowerCase()) ||
                    historyList.find(h => h.title.toLowerCase() === recipeTitle.toLowerCase());
                    
    if (!recipeObj) {
      // Find in local recipes
      const foundLocal = LOCAL_RECIPES.find(l => l.title.toLowerCase() === recipeTitle.toLowerCase());
      if (foundLocal) {
        recipeObj = {
          ...foundLocal,
          perfectMatch: false,
          ingredients: foundLocal.ingredients.map(i => ({ name: i, owned: pantryList.includes(i) })),
          missing: foundLocal.ingredients.filter(i => !pantryList.includes(i))
        };
      }
    }
    
    if (recipeObj) {
      favoritesList.push(recipeObj);
    }
  }
  
  await saveFavoritesToStorage();
  
  // Re-render grids to update states instantly
  if (!outputResults.classList.contains('hidden')) {
    renderRecommendedGridOnly();
  }
  renderFavoritesGrid();
  renderHistoryGrid();
}

window.toggleFavorite = toggleFavorite;

function renderFavoritesGrid() {
  favoritesGrid.innerHTML = '';
  
  if (favoritesList.length === 0) {
    favoritesEmptyState.classList.remove('hidden');
  } else {
    favoritesEmptyState.classList.add('hidden');
    
    favoritesList.forEach((recipe, idx) => {
      const card = createRecipeCard(recipe, `fav-${idx}`);
      favoritesGrid.appendChild(card);
    });
  }
}

function renderRecommendedGridOnly() {
  recipesGrid.innerHTML = '';
  currentRecipes.forEach((recipe, idx) => {
    const card = createRecipeCard(recipe, `rec-${idx}`);
    recipesGrid.appendChild(card);
  });
}

/* Shared Card Creator — opens side panel on "View Full Recipe" click */
function createRecipeCard(recipe, uniqueId) {
  const card = document.createElement('div');
  const isFavorite = favoritesList.some(f => f.title.toLowerCase() === recipe.title.toLowerCase());
  
  card.className = `recipe-card ${recipe.perfectMatch ? 'perfect-match' : ''}`;
  card.setAttribute('data-id', uniqueId);
  
  const tagsHtml = recipe.ingredients.map(ing => `
    <span class="recipe-ing-tag ${ing.owned ? 'has' : 'missing'}">
      ${ing.owned ? '✅' : '❌'} ${ing.name}
    </span>
  `).join('');
  
  card.innerHTML = `
    <div class="recipe-card-main">
      <div class="recipe-header">
        <h4 class="recipe-title">${recipe.title}</h4>
        <span class="match-badge">${recipe.perfectMatch ? 'Perfect Match' : 'Ingredients Needed'}</span>
      </div>
      <div class="recipe-ingredients">
        <h4>🛒 Ingredients</h4>
        <div class="recipe-ingredients-list">${tagsHtml}</div>
      </div>
      <div class="recipe-card-meta">
        <span>⏱ ${recipe.prepTime || '10 mins'} prep</span>
        <span>🔥 ${recipe.cookTime || '15 mins'} cook</span>
        <span class="difficulty-badge badge-${(recipe.difficulty || 'Easy').toLowerCase()}">${recipe.difficulty || 'Easy'}</span>
      </div>
      <div class="card-actions-row">
        <button class="view-steps-btn">📖 View Full Recipe</button>
        <button class="favorite-btn ${isFavorite ? 'active' : ''}" title="Toggle Favorite">⭐</button>
      </div>
    </div>
  `;
  
  // "View Full Recipe" → open side panel
  const viewBtn = card.querySelector('.view-steps-btn');
  if (viewBtn) {
    viewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRecipePanel(recipe);
    });
  }
  
  // Favourite toggle
  const favBtn = card.querySelector('.favorite-btn');
  if (favBtn) {
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(e, recipe.title);
      favBtn.classList.toggle('active');
    });
  }

  // Clicking the card body (not buttons) also opens the panel
  card.addEventListener('click', (e) => {
    if (!e.target.closest('button')) {
      openRecipePanel(recipe);
    }
  });
  
  return card;
}

/* ==========================================================================
   Splash Screen Timeline Animation
   ========================================================================== */
function runSplashScreenAnimation() {
  const splashScreen = document.getElementById('splash-screen');
  if (!splashScreen) return;

  const bgImage = splashScreen.querySelector('.splash-bg-image');
  const bgLime = splashScreen.querySelector('.splash-bg-lime');
  const content = splashScreen.querySelector('.splash-content');
  const logo = document.getElementById('splash-logo');
  
  // Track timeline timeouts so we can cancel them if user decides to skip
  const timeouts = [];
  
  // Phase 1: Fade-in background image (soft motion starts)
  timeouts.push(setTimeout(() => {
    if (bgImage) bgImage.classList.add('active');
  }, 100));
  
  // Phase 2: Gentle transition to solid lime green background
  timeouts.push(setTimeout(() => {
    if (bgLime) bgLime.classList.add('active');
  }, 1800));
  
  // Phase 3: Text slides in gracefully from bottom
  timeouts.push(setTimeout(() => {
    if (content) content.classList.add('active');
  }, 2400));
  
  // Phase 4: Subtle glow on logo
  timeouts.push(setTimeout(() => {
    if (logo) logo.classList.add('glow');
  }, 3400));
  
  // Phase 5: Fade out splash screen and transition body background
  timeouts.push(setTimeout(() => {
    splashScreen.classList.add('fade-out');
    document.body.classList.add('splash-complete');
  }, 5000));
  
  // Phase 6: Hide element completely to restore normal pointer interaction
  timeouts.push(setTimeout(() => {
    splashScreen.style.display = 'none';
  }, 5850));

  // User click skips animation timeline immediately with a smooth fade-out exit
  splashScreen.addEventListener('click', () => {
    // Clear all pending timeouts
    timeouts.forEach(t => clearTimeout(t));
    
    // Set all elements to active states immediately
    if (bgImage) bgImage.classList.add('active');
    if (bgLime) bgLime.classList.add('active');
    if (content) content.classList.add('active');
    if (logo) logo.classList.add('glow');
    
    // Initiate fade-out transition and body transition
    splashScreen.classList.add('fade-out');
    document.body.classList.add('splash-complete');
    
    // Remove from layout after fade duration
    setTimeout(() => {
      splashScreen.style.display = 'none';
    }, 850);
  });
}

/* ==========================================================================
   Background Particles Floating Canvas
   ========================================================================== */
function initBackgroundParticles() {
  const container = document.getElementById('app-particles');
  if (!container) return;
  
  container.innerHTML = '';
  const particleCount = 20;
  
  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'app-particle';
    
    // 35% chance to render a floating raspberry, 65% chance for a soft green particle
    const isRaspberry = Math.random() > 0.65;
    
    let size;
    if (isRaspberry) {
      size = Math.random() * 30 + 20; // larger 20px - 50px raspberries
      p.style.backgroundImage = "url('/raspberry_single.jpg')";
      p.style.backgroundSize = "cover";
      p.style.backgroundPosition = "center";
      p.style.mixBlendMode = "screen"; // screen filters out black background of the image
      p.style.backgroundColor = "transparent";
      p.style.borderRadius = "50%";
      p.style.filter = `brightness(0.6) contrast(1.1) ${Math.random() > 0.5 ? 'blur(0.5px)' : ''}`;
    } else {
      size = Math.random() * 8 + 4; // 4px to 12px small green dots
      p.style.backgroundColor = "rgba(132, 204, 22, 0.08)";
    }
    
    const left = Math.random() * 100; // 0% to 100%
    const duration = Math.random() * 20 + 20; // 20s to 40s (slow, elegant, calming drift)
    const delay = Math.random() * -40; // pre-warmed delays so they start in motion
    const xOffset = Math.random() * 80 - 40; // horizontal drift
    
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${left}%`;
    p.style.setProperty('--float-duration', `${duration}s`);
    p.style.setProperty('--float-delay', `${delay}s`);
    p.style.setProperty('--float-x', `${xOffset}px`);
    p.style.animationDelay = `${delay}s`;
    
    container.appendChild(p);
  }
}

/* ==========================================================================
   Floating AI Chat Assistant Integration
   ========================================================================== */
function appendChatMessage(sender, htmlContent) {
  const container = document.getElementById('panel-chat-messages');
  if (!container) return null;
  
  const msg = document.createElement('div');
  msg.className = `chat-message ${sender}`;
  
  let avatarHtml = '';
  if (sender === 'user') {
    const userObj = getCurrentUserObject();
    const avatarUrl = userObj?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userObj?.name || 'User'}`;
    avatarHtml = `<div class="chat-avatar"><img src="${avatarUrl}" alt="User"></div>`;
  } else {
    avatarHtml = `<div class="chat-avatar bot-avatar">&#x1F916;</div>`;
  }
  
  msg.innerHTML = `
    ${sender === 'bot' ? avatarHtml : ''}
    <div class="message-content">${htmlContent}</div>
    ${sender === 'user' ? avatarHtml : ''}
  `;
  
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
  return msg;
}

async function generateAIChatResponse(userQuery) {
  // Pull from local settings modal OR from environment variable (gsk_...)
  const apiKey = localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY;
  if (!apiKey) return getLocalBotResponse(userQuery);
  
  const currentUser = getCurrentUserObject();
  const welcomeText = currentUser 
    ? `The user is logged in as ${currentUser.name} (${currentUser.email}). Personalize responses by referencing their name occasionally.`
    : `The user is currently browsing as a guest.`;
  
  const systemPrompt = `You are WhizBot, the official friendly AI assistant for KitchenWhiz, a smart grocery planner app.
Your task is to answer the user's question. Keep your answers concise, engaging, and directly related to the KitchenWhiz app (ingredients, pantry, 3D flip recipe cards, shopping list checkbox/copy/export, favorites, history, settings, splash screen, user accounts, profile details).
${welcomeText}
Format your response using clean HTML paragraph tags (<p>), bold text (<strong>), and short lists (<ul>/<li>) only. Do NOT use markdown code blocks or triple backticks. Keep responses under 3 short paragraphs.
Current Pantry Ingredients in the app: ${pantryList.join(', ') || 'None'}.
Current Favorites count: ${favoritesList.length}.

If the user asks to add items to their shopping/grocery list, or add ingredients to their pantry, you MUST include a clickable button in your HTML response.
Format the button EXACTLY like this:
- To add to Grocery List: <button class="add-to-shopping-list-btn" data-items="item1, item2" style="background:#84cc16; color:#0f172a; border:none; padding:0.4rem 0.8rem; border-radius:8px; font-weight:700; cursor:pointer; margin-top:0.4rem; font-size:0.8rem;">🛒 Add to Grocery List</button>
- To add to Pantry: <button class="add-to-pantry-btn" data-items="item1, item2" style="background:#3b82f6; color:#ffffff; border:none; padding:0.4rem 0.8rem; border-radius:8px; font-weight:700; cursor:pointer; margin-top:0.4rem; font-size:0.8rem;">🥑 Add to Pantry</button>
Make sure to replace "item1, item2" with the actual comma-separated ingredient names.

User Query: ${userQuery}`;

  const isGroq = apiKey.startsWith('gsk_');
  
  try {
    if (isGroq) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: systemPrompt }],
          temperature: 0.7,
          max_tokens: 250
        })
      });
      if (!response.ok) throw new Error('Groq API Error');
      const data = await response.json();
      return data.choices[0].message.content;
    } else {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { maxOutputTokens: 250, temperature: 0.7 }
        })
      });
      if (!response.ok) throw new Error('Gemini API Error');
      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    }
  } catch (err) {
    console.error('AI assistant API error:', err);
    return getLocalBotResponse(userQuery) + `<p style="color:#ef4444; font-size: 0.78rem; margin-top:0.4rem;">⚠️ (Fallback answer: WhizBot encountered an error querying the API key. Please check your credentials in settings.)</p>`;
  }
}

function getLocalBotResponse(query) {
  const q = query.toLowerCase();
  const currentUser = getCurrentUserObject();
  const namePrefix = currentUser ? `<strong>${currentUser.name}</strong>, ` : '';
  
  if (q.includes('profile') || q.includes('account') || q.includes('who am i') || q.includes('logged') || q.includes('auth') || q.includes('login') || q.includes('signup') || q.includes('logout') || q.includes('sign in')) {
    if (currentUser) {
      return `
        <p>👤 <strong>My Profile & Account Status:</strong></p>
        <p>You are currently logged in as <strong>${currentUser.name}</strong> (${currentUser.email}).</p>
        <ul>
          <li><strong>Pantry Items:</strong> ${pantryList.length} items</li>
          <li><strong>Favorites saved:</strong> ${favoritesList.length} recipes</li>
          <li><strong>Preferences:</strong> Vegetarian: ${currentUser.preferences?.vegetarian ? 'Yes 🥬' : 'No'}, Gluten-Free: ${currentUser.preferences?.glutenFree ? 'Yes 🌾' : 'No'}</li>
        </ul>
        <p>To view full details or change dietary preferences, open the 👤 Profile dropdown in the nav bar and select <strong>My Profile</strong>.</p>
      `;
    } else {
      return `
        <p>🔒 <strong>Authentication Options:</strong></p>
        <p>You are currently browsing as a Guest.</p>
        <p>Click on the 👤 <strong>Sign In</strong> button in the navigation bar to login or create a secure personal profile account to sync your pantry and recipes!</p>
      `;
    }
  }
  
  if (q.includes('ingredient') || q.includes('pantry') || q.includes('fridge') || q.includes('add') || q.includes('remove') || q.includes('delete')) {
    return `
      <p>🥕 ${namePrefix}<strong>Step-by-Step Pantry Management:</strong></p>
      <ul>
        <li><strong>Step 1 (Add):</strong> Type an ingredient in the pantry search box (e.g., <em>"Chicken"</em>) and click <strong>+ Add</strong>, or simply click a quick tag like <strong>🍅 Tomato</strong>.</li>
        <li><strong>Step 2 (Observe):</strong> Adding ingredients dynamically matches possible recipes (e.g., adding <em>Tomato</em> and <em>Cheese</em> matches <em>"Caprese Salad"</em>).</li>
        <li><strong>Step 3 (Remove):</strong> Click the ❌ icon on the ingredient chip to delete it, or click <strong>Clear All</strong> to clear your entire inventory instantly.</li>
      </ul>
    `;
  }
  
  if (q.includes('recipe') || q.includes('suggest') || q.includes('make') || q.includes('cook') || q.includes('step') || q.includes('instruction')) {
    return `
      <p>🍳 ${namePrefix}<strong>Step-by-Step Cooking Guide:</strong></p>
      <ul>
        <li><strong>Step 1:</strong> Add your ingredients to the pantry. Perfect matches display a bright green indicator.</li>
        <li><strong>Step 2:</strong> Click on any recipe card (e.g., <em>"Tomato & Cheese Pasta"</em>) or click its <strong>View Steps ➔</strong> link.</li>
        <li><strong>Step 3:</strong> The card flips in 3D to reveal detailed instructions, estimated prep time, and expert culinary tips.</li>
      </ul>
    `;
  }
  
  if (q.includes('shopping') || q.includes('list') || q.includes('missing') || q.includes('export') || q.includes('copy')) {
    return `
      <p>🛒 ${namePrefix}<strong>Step-by-Step Shopping Checklist:</strong></p>
      <ul>
        <li><strong>Step 1:</strong> Recipe ideas display missing items under the **Missing Ingredients** checklist. E.g. if you lack <em>"Basil"</em> for Caprese, it shows up there.</li>
        <li><strong>Step 2:</strong> Toggle the checkboxes as you pick up items at the supermarket (checked items fade out with a cool neon strikeout).</li>
        <li><strong>Step 3:</strong> Click <strong>📋 Copy</strong> to copy unchecked items to your clipboard, or <strong>📥 Export</strong> to download a clean text checklist file.</li>
      </ul>
    `;
  }
  
  if (q.includes('favorite') || q.includes('star') || q.includes('history') || q.includes('save') || q.includes('last')) {
    return `
      <p>⭐ ${namePrefix}<strong>Step-by-Step Favorites & History:</strong></p>
      <ul>
        <li><strong>Step 1:</strong> Click the 🌟 star icon on any recipe card to save it. For instance, starring <em>"Spaghetti Carbonara"</em> marks it.</li>
        <li><strong>Step 2:</strong> Switch to the <strong>⭐ Favorites</strong> tab at the top of the output panel to view all your saved recipes.</li>
        <li><strong>Step 3:</strong> Toggle the <strong>📜 History</strong> tab to view your last 5 unique recipe suggestions.</li>
      </ul>
    `;
  }
  
  if (q.includes('setting') || q.includes('api') || q.includes('key') || q.includes('advanced')) {
    return `
      <p>🔑 ${namePrefix}<strong>Step-by-Step API Setup:</strong></p>
      <ul>
        <li><strong>Step 1:</strong> Click <a href="#" class="chat-settings-trigger chat-link">AI Settings 🔑</a> at the top right header bar (or click this link).</li>
        <li><strong>Step 2:</strong> Enter your Gemini API Key in the field (e.g., <em>AIzaSy...</em>). Keys are stored locally in your browser and are safe.</li>
        <li><strong>Step 3:</strong> Click <strong>Save Settings</strong> to activate advanced AI generation.</li>
      </ul>
    `;
  }

  if (q.includes('splash') || q.includes('raspberr')) {
    return `
      <p>🍓 ${namePrefix}<strong>Step-by-Step Splash Screen:</strong></p>
      <ul>
        <li><strong>Step 1:</strong> The splash screen displays fresh raspberries transitioning into a lime-green logo when the app loads.</li>
        <li><strong>Step 2:</strong> Click anywhere on the screen at any point to skip the animation and proceed directly to your pantry dashboard.</li>
      </ul>
    `;
  }
  
  return `
    <p>🤖 I'm here to help guide you through <strong>KitchenWhiz</strong>!</p>
    <p>Ask me about:</p>
    <ul>
      <li>🥕 Adding/removing ingredients</li>
      <li>🍳 3D Flipping recipe cards to read steps</li>
      <li>🛒 Copying/exporting the shopping list</li>
      <li>⭐ Saving favorites or viewing history</li>
      <li>👤 Profile and authentication settings</li>
    </ul>
    <p>Or, click <a href="#" class="chat-settings-trigger chat-link">AI Settings 🔑</a> to configure your API key for advanced AI recipe suggestions.</p>
  `;
}

/* Helper to render the grocery list inside the pop-up modal overlay */
function renderModalGroceryList() {
  const container = document.getElementById('grocery-modal-list-items');
  if (!container) return;
  container.innerHTML = '';

  const seen = new Set();
  const combinedList = [];
  
  [...lastMissingIngredients, ...customShoppingList].forEach(item => {
    if (!item || !item.name) return;
    const lowerName = item.name.toLowerCase();
    if (!seen.has(lowerName)) {
      seen.add(lowerName);
      combinedList.push(item);
    }
  });

  if (combinedList.length === 0) {
    container.innerHTML = `
      <div class="empty-tag-state" style="padding: 1.5rem 0; text-align:center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
        <span class="empty-emoji" style="font-size: 1.8rem;">🎉</span>
        <p style="color:var(--text-muted); font-size:0.82rem; margin: 0;">Your grocery list is empty!</p>
      </div>
    `;
  } else {
    combinedList.forEach((item, index) => {
      const li = document.createElement('li');
      if (item.checked) {
        li.className = 'checked';
      }

      const checkLabel = document.createElement('label');
      checkLabel.style.display = 'flex';
      checkLabel.style.alignItems = 'center';
      checkLabel.style.gap = '0.75rem';
      checkLabel.style.cursor = 'pointer';
      checkLabel.style.flex = '1';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!item.checked;
      cb.addEventListener('change', () => {
        const isChecked = cb.checked;
        li.classList.toggle('checked', isChecked);
        
        // Update states
        customShoppingList = customShoppingList.map(x => {
          if (x.name.toLowerCase() === item.name.toLowerCase()) {
            return { ...x, checked: isChecked };
          }
          return x;
        });
        
        lastMissingIngredients = lastMissingIngredients.map(x => {
          if (x.name.toLowerCase() === item.name.toLowerCase()) {
            return { ...x, checked: isChecked };
          }
          return x;
        });
        
        saveGroceryListToStorage();
        renderShoppingList(); // update main page list
      });

      const spanName = document.createElement('span');
      spanName.textContent = item.name;
      spanName.style.fontSize = '0.85rem';
      spanName.style.color = '#ffffff';

      checkLabel.appendChild(cb);
      checkLabel.appendChild(spanName);
      li.appendChild(checkLabel);
      container.appendChild(li);
    });
  }
}

/* Copy unchecked items from the grocery list modal */
function copyModalShoppingList() {
  const items = [];
  const seen = new Set();
  
  [...lastMissingIngredients, ...customShoppingList].forEach(item => {
    if (item && item.name && !item.checked) {
      const lower = item.name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        items.push(`- [ ] ${item.name}`);
      }
    }
  });

  const btn = document.getElementById('grocery-modal-copy-btn');
  if (items.length === 0) {
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '⚠️ Empty!';
      setTimeout(() => btn.innerHTML = originalText, 2000);
    }
    return;
  }

  const text = `KitchenWhiz - Unpurchased Items:\n${items.join('\n')}`;
  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '✓ Copied!';
      setTimeout(() => btn.innerHTML = originalText, 2000);
    }
  });
}

/* Export unchecked items from the grocery list modal as txt file */
function exportModalShoppingList() {
  const items = [];
  const seen = new Set();
  
  [...lastMissingIngredients, ...customShoppingList].forEach(item => {
    if (item && item.name && !item.checked) {
      const lower = item.name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        items.push(`- [ ] ${item.name}`);
      }
    }
  });

  const btn = document.getElementById('grocery-modal-export-btn');
  if (items.length === 0) {
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '⚠️ Empty!';
      setTimeout(() => btn.innerHTML = originalText, 2000);
    }
    return;
  }

  const text = `KitchenWhiz - Pending Shopping Items:\n${items.join('\n')}`;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'shopping-list.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (btn) {
    const originalText = btn.innerHTML;
    btn.innerHTML = '✓ Exported!';
    setTimeout(() => btn.innerHTML = originalText, 2000);
  }
}