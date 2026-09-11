(() => {
  if (customElements.get('cf-condition-guide')) return;
  customElements.define('cf-condition-guide', class extends HTMLElement {
    connectedCallback() {
      if (this.ready) return;
      this.ready = true;
      const open = this.querySelector('.cf-condition__open'), dialog = this.querySelector('dialog');
      open.hidden = false;
      this.querySelector('[data-condition-fallback]').hidden = true;
      open.addEventListener('click', () => dialog.showModal());
      this.querySelector('.cf-condition__close').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => open.focus());
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      });
    }
  });
})();
