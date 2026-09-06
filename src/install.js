import './install.css';

const GAME_TITLE = 'Dook, Dook, Goose!';
const SHARE_TEXT = 'A very small ferret. A very urgent adventure. Keep dooking.';
let activeController;

function cleanShareURL() {
  const configured = document.querySelector('link[rel="canonical"]')?.getAttribute('href')
    || document.querySelector('meta[property="og:url"]')?.getAttribute('content');
  try {
    const url = new URL(configured || '/', location.origin);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Not a web URL');
    url.search = ''; url.hash = ''; url.username = ''; url.password = '';
    return url.href;
  } catch {
    return `${location.origin}/`;
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Delegates explicit clicks from [data-share-game] and [data-install-game].
 * Call once after the app shell exists. onOpen can synchronously pause play.
 */
export function setupInstallAndShare({onOpen} = {}) {
  if (activeController) return activeController;
  const standalone = window.matchMedia('(display-mode: standalone)');
  let installed = standalone.matches || navigator.standalone === true;
  let installPrompt = null, installBusy = false, shareBusy = false, dialogRoot = null;
  let toastTimer, toastClearTimer;
  const toast = element('div', 'dook-share-toast');
  toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); toast.setAttribute('aria-atomic', 'true');
  document.body.append(toast);

  function announce(text) {
    clearTimeout(toastTimer); clearTimeout(toastClearTimer);
    toast.textContent = text; toast.classList.add('is-visible');
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      toastClearTimer = setTimeout(() => { toast.textContent = ''; }, 250);
    }, 3500);
  }

  function syncInstallControls() {
    document.documentElement.classList.toggle('dook-standalone', standalone.matches || navigator.standalone === true);
    for (const button of document.querySelectorAll('[data-install-game]')) {
      button.hidden = installed;
      button.setAttribute('aria-label', installPrompt ? `Install ${GAME_TITLE}` : `Add ${GAME_TITLE} to your home screen`);
      button.dataset.installReady = installPrompt ? 'true' : 'false';
    }
  }

  const footerActions = element('span', 'dook-footer-actions');
  for (const [attribute, label] of [['data-share-game', 'SHARE ↗'], ['data-install-game', 'ADD TO HOME SCREEN +']]) {
    const button = element('button', 'dook-tool-button', label);
    button.type = 'button'; button.setAttribute(attribute, ''); footerActions.append(button);
  }
  document.querySelector('.site-footer')?.append(footerActions);

  // Title/help markup is re-rendered by the game. Delegated controls retain
  // their behavior, and new install controls inherit the current install state.
  const observer = new MutationObserver(syncInstallControls);
  observer.observe(document.querySelector('#app') || document.body, {childList: true, subtree: true});
  syncInstallControls();

  function closeDialog() {
    if (!dialogRoot) return;
    const {overlay, trigger} = dialogRoot; dialogRoot = null;
    overlay.remove(); document.body.classList.remove('dook-dialog-open');
    requestAnimationFrame(() => { if (!dialogRoot && trigger?.isConnected) trigger.focus({preventScroll: true}); });
  }

  function openDialog(title, description, trigger) {
    closeDialog();
    const overlay = element('div', 'dook-share-overlay');
    const panel = element('section', 'dook-share-dialog');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'dook-share-dialog-title'); panel.tabIndex = -1;
    const close = element('button', 'dook-dialog-close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Close dialog'); close.addEventListener('click', closeDialog);
    const eyebrow = element('div', 'dook-dialog-eyebrow', 'SMALL PAWS. BIG ADVENTURE.');
    const heading = element('h2', '', title); heading.id = 'dook-share-dialog-title';
    panel.append(close, eyebrow, heading, element('p', 'dook-dialog-description', description));
    overlay.append(panel); overlay.addEventListener('click', event => { if (event.target === overlay) closeDialog(); });
    document.body.append(overlay); document.body.classList.add('dook-dialog-open');
    dialogRoot = {overlay, panel, trigger};
    panel.focus({preventScroll: true});
    return panel;
  }

  async function copyToClipboard() {
    try {
      if (!navigator.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(cleanShareURL());
      return true;
    } catch {
      return false;
    }
  }

  function showCopyDialog(trigger) {
    const panel = openDialog('Pass the dook along.', 'Send a friend a very urgent little adventure.', trigger);
    const label = element('label', 'dook-link-label', 'GAME LINK'); label.htmlFor = 'dook-share-url';
    const input = element('input', 'dook-share-url');
    input.id = 'dook-share-url'; input.type = 'url'; input.readOnly = true; input.value = cleanShareURL();
    input.autocomplete = 'off'; input.spellcheck = false;
    const feedback = element('p', 'dook-copy-feedback', 'You can select and copy the link above.');
    feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
    const copy = element('button', 'dook-dialog-button', 'COPY LINK ↗'); copy.type = 'button';
    copy.addEventListener('click', async () => {
      if (await copyToClipboard()) {
        feedback.textContent = 'Link copied. Keep dooking!'; announce('Game link copied. Keep dooking!');
      } else {
        input.focus(); input.select(); input.setSelectionRange(0, input.value.length);
        feedback.textContent = 'Link selected. Use your device’s Copy command, then paste it to a friend.';
      }
    });
    input.addEventListener('click', () => input.select());
    panel.append(label, input, copy, feedback);
  }

  function showInstallInstructions(trigger) {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const mobile = ios || /Android/i.test(navigator.userAgent);
    const panel = openDialog('A home for your ferret.', 'Keep Dook, Dook, Goose! one tap away.', trigger);
    const steps = element('ol', 'dook-install-steps');
    const instructions = ios
      ? ['Tap the Share button in your browser.', 'Choose Add to Home Screen, then tap Add.']
      : mobile
        ? ['Open your browser’s menu.', 'Look for Install app or Add to Home Screen, then follow the browser’s steps.']
        : ['Look in your browser’s address bar or menu.', 'Choose Install app if it is offered, then follow the browser’s steps.'];
    for (const instruction of instructions) steps.append(element('li', '', instruction));
    const note = ios
      ? 'If Add to Home Screen is missing, open the game in Safari. You can also bookmark it.'
      : 'If installation is not offered, bookmark this page to keep the adventure handy.';
    const done = element('button', 'dook-dialog-button', 'GOT IT. KEEP DOOKING.'); done.type = 'button'; done.addEventListener('click', closeDialog);
    panel.append(steps, element('p', 'dook-install-note', note), done);
  }

  async function shareGame(trigger) {
    if (shareBusy) return;
    shareBusy = true;
    try {
      onOpen?.();
      const data = {title: GAME_TITLE, text: SHARE_TEXT, url: cleanShareURL()};
      if (typeof navigator.share === 'function') {
        try {
          // Call before any await so the user's click retains activation.
          await navigator.share(data);
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }
      if (await copyToClipboard()) announce('Game link copied. Keep dooking!');
      else showCopyDialog(trigger);
    } finally {
      shareBusy = false;
    }
  }

  async function installGame(trigger) {
    if (installed || installBusy) return;
    onOpen?.();
    if (!installPrompt) { showInstallInstructions(trigger); return; }
    const prompt = installPrompt; installPrompt = null; installBusy = true; syncInstallControls();
    try {
      // A captured prompt can be consumed once, only after this button click.
      await prompt.prompt();
      if (prompt.userChoice) await prompt.userChoice;
    } catch (error) {
      if (error?.name !== 'AbortError') showInstallInstructions(trigger);
    } finally {
      installBusy = false;
    }
  }

  function click(event) {
    const trigger = event.target instanceof Element ? event.target.closest('[data-share-game], [data-install-game]') : null;
    if (!trigger || trigger.hidden || trigger.disabled) return;
    event.preventDefault();
    if (trigger.hasAttribute('data-share-game')) void shareGame(trigger);
    else void installGame(trigger);
  }

  function dialogKeys(event) {
    if (!dialogRoot) return;
    // Escape/Enter/arrow keys must not also resume or advance the game beneath.
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...dialogRoot.panel.querySelectorAll('button:not([disabled]), input, a[href], [tabindex="0"]')]
      .filter(node => !node.hidden && node.getClientRects().length);
    if (!controls.length) { event.preventDefault(); dialogRoot.panel.focus(); return; }
    const first = controls[0], last = controls.at(-1), focused = document.activeElement;
    if (event.shiftKey && (focused === first || !controls.includes(focused))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (focused === last || !controls.includes(focused))) { event.preventDefault(); first.focus(); }
  }

  function beforeInstall(event) {
    event.preventDefault(); installPrompt = event; syncInstallControls();
  }
  function appInstalled() {
    installed = true; installPrompt = null; syncInstallControls(); closeDialog();
    announce('Dook is installed. Keep dooking!');
  }
  function displayModeChanged(event) {
    if (event.matches || navigator.standalone === true) installed = true;
    syncInstallControls();
  }

  document.addEventListener('click', click);
  document.addEventListener('keydown', dialogKeys, true);
  window.addEventListener('beforeinstallprompt', beforeInstall);
  window.addEventListener('appinstalled', appInstalled);
  standalone.addEventListener?.('change', displayModeChanged);
  // Registration never reloads the page or interrupts an active run. The worker
  // is a production artifact; development stays on Vite's live files.
  const registerWorker = () => {
    if (import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  };
  if (document.readyState === 'complete') registerWorker();
  else window.addEventListener('load', registerWorker, {once: true});

  activeController = {
    shareURL: cleanShareURL,
    destroy() {
      closeDialog(); observer.disconnect(); clearTimeout(toastTimer); clearTimeout(toastClearTimer);
      document.removeEventListener('click', click); document.removeEventListener('keydown', dialogKeys, true);
      window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', appInstalled);
      window.removeEventListener('load', registerWorker); standalone.removeEventListener?.('change', displayModeChanged);
      footerActions.remove(); toast.remove(); activeController = undefined;
      document.documentElement.classList.remove('dook-standalone');
    },
  };
  return activeController;
}
