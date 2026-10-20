// Fixture-only native GUI regression: cancel first, then permanently delete.
(async () => {
  const button = [...document.querySelectorAll('.app-item')]
    .find(item => item.querySelector('strong')?.textContent === 'Native preview fixture');
  if (!button || button.disabled || window.__studioDeleteSmokeStarted) return;
  window.__studioDeleteSmokeStarted = true;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async condition => {
    for (let i = 0; i < 100; i++) {
      if (condition()) return;
      await delay(100);
    }
    throw new Error('Native deletion condition timed out');
  };
  const $ = id => document.getElementById(id);
  try {
    button.click();
    await wait(() => !$('booth').hidden && !$('delete-app').disabled);
    $('delete-app').click();
    await wait(() => $('delete-dialog').open);
    if ($('delete-name').textContent !== 'Native preview fixture') throw new Error('Wrong target');
    if (document.activeElement.value !== 'cancel') throw new Error('Unsafe default focus');
    $('delete-dialog').querySelector('[value=cancel]').click();
    await wait(() => !$('delete-dialog').open);
    if ($('count').textContent !== '2') throw new Error('Cancel changed catalog');
    window.__electrobunSendToHost({studioSmokeCancel:true});
    await delay(100);
    $('delete-app').click();
    await wait(() => $('delete-dialog').open);
    $('delete-dialog').querySelector('[value=delete]').click();
    await wait(() => $('message').textContent === 'Performer deleted.');
    if ($('count').textContent !== '1' || !$('booth').hidden || $('welcome').hidden)
      throw new Error('Deletion did not refresh the workbench');
    if (!$('apps').textContent.includes('Native preview keeper')) throw new Error('Other booth removed');
    window.__electrobunSendToHost({studioSmoke:true});
  } catch {
    window.__electrobunSendToHost({studioSmoke:false});
  }
})();
