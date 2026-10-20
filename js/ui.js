// click a panel title to fold it, the choice is remembered

const OPEN_BY_DEFAULT = ['Channel rack', 'Piano roll'];
(function () {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('root-panels') || '{}'); } catch (err) { /* nothing saved */ }
  document.querySelectorAll('#work .panel').forEach(p => {
    const title = p.querySelector('.title'), name = title.firstChild.textContent.trim();
    p.classList.toggle('collapsed', name in saved ? saved[name] : !OPEN_BY_DEFAULT.includes(name));
    title.addEventListener('click', e => {
      if (e.target !== title && !p.classList.contains('collapsed')) return;   // ignore clicks on the controls
      p.classList.toggle('collapsed');
      saved[name] = p.classList.contains('collapsed');
      try { localStorage.setItem('root-panels', JSON.stringify(saved)); } catch (err) { /* storage blocked */ }
    });
  });
})();