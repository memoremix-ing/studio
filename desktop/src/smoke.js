// Compiled only with the opt-in preview-smoke feature, for disposable fixtures.
(async () => {
  if (!document.querySelector('.new-todo') || window.__studioSmokeStarted) return;
  window.__studioSmokeStarted = true;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async condition => {
    for (let i = 0; i < 100; i++) {
      if (condition()) return;
      await delay(100);
    }
    throw new Error('Native preview condition timed out');
  };
  const title = 'Native preview regression';
  const row = () => [...document.querySelectorAll('.todo')]
    .find(item => item.querySelector('label')?.textContent === title);
  const settled = () => row() && !row().matches('.pending, .errored');
  try {
    if (window.__electrobunHostBridge || window.__electrobunInternalBridge)
      throw new Error('Privileged bridge in booth');
    await wait(() => !document.body.innerText.includes('Loading'));
    if (!PERSISTENCE_ONLY) {
      const input = document.querySelector('.new-todo');
      input.value = title;
      input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      await wait(settled);
      row().querySelector('.toggle').click();
    }
    await wait(() => settled() && row().classList.contains('completed'));
    location.hash = '#/active';
    await wait(() => !row());
    location.hash = '#/completed';
    await wait(settled);
    const original = location.origin;
    location.href = 'http://not-the-booth.localhost:49123/';
    await delay(500);
    if (location.origin !== original) throw new Error('Navigation escaped booth');
    location.href = 'views://studio/index.html';
    await delay(500);
    if (location.origin !== original) throw new Error('Navigation reached shell');
    window.__electrobunSendToHost({studioSmoke:true});
  } catch {
    window.__electrobunSendToHost({studioSmoke:false});
  }
})();
