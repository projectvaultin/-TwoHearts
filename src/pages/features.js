import { requireSession, currentUser } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { FEATURE_REGISTRY, FEATURE_CATEGORIES, FEATURE_STATS } from '../lib/feature-registry.js';
import { esc, toast, toggleDarkMode } from '../lib/ui.js';

await requireSession();
const user = await currentUser();
const state = {
  query: '',
  category: 'All',
  favorites: new Set(JSON.parse(localStorage.getItem('th_feature_favorites') || '[]')),
  availableOnly: false,
  custom: []
};

const $ = (s) => document.querySelector(s);
const grid = $('#featureGrid');
const categorySelect = $('#categoryFilter');
const searchInput = $('#featureSearch');
const countEl = $('#featureCount');

function persistFavorites() {
  localStorage.setItem('th_feature_favorites', JSON.stringify([...state.favorites]));
}

function filtered() {
  const q = state.query.toLowerCase();
  const registry = [...FEATURE_REGISTRY, ...state.custom];
  return registry.filter(f => {
    const matchesCategory = state.category === 'All' || f.category === state.category;
    const matchesAvailability = !state.availableOnly || f.status === 'available';
    const matchesQuery = !q || `${f.title} ${f.category} ${f.id}`.toLowerCase().includes(q);
    return matchesCategory && matchesAvailability && matchesQuery;
  });
}

function render() {
  const list = filtered();
  countEl.textContent = `${list.length} shown · ${FEATURE_STATS.available} available · ${FEATURE_STATS.foundation} foundation`;
  grid.innerHTML = list.map(f => {
    const fav = state.favorites.has(f.id);
    const disabled = f.status !== 'available';
    const href = disabled ? '#' : f.href;
    return `<article class="feature-hub-card ${disabled ? 'is-foundation' : ''}">
      <div class="feature-hub-icon">${f.icon}</div>
      <div class="feature-hub-body">
        <div class="feature-hub-top">
          <span class="feature-hub-category">${esc(f.category)}</span>
          <button class="feature-fav ${fav ? 'active' : ''}" data-fav="${esc(f.id)}" aria-label="Favorite ${esc(f.title)}">${fav ? '★' : '☆'}</button>
        </div>
        <h3>${esc(f.title)}</h3>
        <p>${disabled ? 'Foundation module reserved for the next implementation wave.' : 'Available in the current TwoHearts build.'}</p>
        <a class="button ${disabled ? 'light' : 'accent'} feature-open" href="${href}" ${disabled ? 'data-foundation="1"' : ''}>
          ${disabled ? 'Foundation' : 'Open'}
        </a>
      </div>
    </article>`;
  }).join('') || `<div class="panel section"><p class="status">No features match your search.</p></div>`;

  grid.querySelectorAll('[data-fav]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.fav;
      state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
      persistFavorites();
      savePreferences();
      render();
    };
  });
  grid.querySelectorAll('[data-foundation]').forEach(a => {
    a.onclick = (e) => { e.preventDefault(); toast('This module is in the scalable feature foundation.', 'info'); };
  });
}

function populateCategories() {
  categorySelect.innerHTML = `<option>All</option>` + FEATURE_CATEGORIES.map(c => `<option>${esc(c)}</option>`).join('');
}

async function syncPreferences() {
  if (!user) return;
  const { data } = await supabase.from('user_feature_settings')
    .select('favorite_feature_ids,custom_features').eq('user_id', user.id).maybeSingle();
  if (data?.favorite_feature_ids?.length) {
    state.favorites = new Set(data.favorite_feature_ids);
    persistFavorites();
  }
  if (Array.isArray(data?.custom_features)) state.custom = data.custom_features;
  render();
}

let saveTimer;
async function savePreferences() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!user) return;
    const { error } = await supabase.from('user_feature_settings').upsert({
      user_id: user.id,
      favorite_feature_ids: [...state.favorites],
      custom_features: state.custom,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) console.warn('Feature preferences not synced:', error.message);
  }, 350);
}

categorySelect.onchange = () => { state.category = categorySelect.value; render(); };
searchInput.oninput = () => { state.query = searchInput.value; render(); };
$('#availableOnly').onchange = e => { state.availableOnly = e.target.checked; render(); };
$('#themeToggle').onclick = toggleDarkMode;
$('#createFeature').onclick = async () => {
  const title = prompt('Custom module name:');
  if (!title?.trim()) return;
  const category = prompt('Category:', 'Custom')?.trim() || 'Custom';
  const id = `custom-${Date.now()}`;
  state.custom.push({ id, category, title: title.trim(), icon: '✨', href: '#', status: 'foundation', custom: true });
  await savePreferences();
  render();
  toast('Custom module added to your Feature Center.', 'success');
};
$('#clearFavorites').onclick = () => { state.favorites.clear(); persistFavorites(); savePreferences(); render(); };

populateCategories();
render();
syncPreferences();
