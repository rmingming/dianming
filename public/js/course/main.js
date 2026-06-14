// ── Main: view switching, utilities, and initialization ──
// Depends on: pickState, stopPick() (from picker.js)

// HTML escape utility
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// View switching
function switchView(view) {
  document.getElementById('listView').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('gridView').style.display = view === 'grid' ? 'block' : 'none';
  document.getElementById('btnListView').classList.toggle('active', view === 'list');
  document.getElementById('btnGridView').classList.toggle('active', view === 'grid');
}

// Clean up picker and selection when switching to list view
(function() {
  const origSwitchView = switchView;
  switchView = function(view) {
    if (view === 'list') {
      if (pickState === 'running') stopPick();
      if (selectionRect) clearSelection();
    }
    origSwitchView(view);
  };
})();

// Space: stop pick; Esc is handled by inline script in template
document.addEventListener('keydown', function(e) {
  if (e.code === 'Space' && typeof pickState !== 'undefined' && pickState === 'running') {
    e.preventDefault();
    stopPick();
  }
});
