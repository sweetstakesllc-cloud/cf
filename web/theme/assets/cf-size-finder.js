/* Deliberately conservative, uncalibrated size ranges, not a trained AI model.
 * Actual flat garment comparisons take precedence. No storage or network calls. */
(() => {
  'use strict';
  const sizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  const number = v => v != null && String(v).trim() !== '' && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
  const letter = v => {
    const m = String(v || '').toUpperCase().match(/\b(XXXS|XXS|XS|XXXL|XXL|XL|3XL|2XL|S|M|L)\b/);
    return m ? ({XXXL:'3XL', '2XL':'XXL'}[m[1]] || m[1]) : null;
  };
  const kind = p => {
    const text = `${p.category} ${p.title}`.toLowerCase();
    if (/\b(baby|toddler|kids|children|junior|boys|girls)\b/.test(text)) return 'child';
    if (/\b(trousers|pants|jeans|shorts|joggers|skirts?|leggings|bottoms|trunks)\b/.test(text)) return 'bottom';
    if (/\b(dress(?:es)?|jumpsuits?|rompers?|suits?|tracksuits?|swimwear|underwear|bras?|bikinis?|bodysuits?|lingerie)\b/.test(text)) return 'special';
    return 'top';
  };
  function recommend(p, input) {
    const h = number(input.height), w = number(input.weight);
    if (!h || !w || h < 120 || h > 230 || w < 30 || w > 250) return {heading:'Check your measurements', detail:'Enter height in cm (120–230) and weight in kg (30–250).', facts:[]};
    const category = kind(p), variants = p.variants || [], optionIndex = (p.options || []).findIndex(v => /^(size|storlek|taille|größe)$/i.test(v));
    const listed = [...new Set(variants.map(v => optionIndex < 0 ? '' : v.options[optionIndex]).filter(Boolean))];
    const single = listed.length <= 1;
    const fitNote = single ? `${p.title} ${p.description}`.match(/\bfits?\s+(?:like\s+)?(?:an?\s+)?(XXS|XS|XXXL|XXL|XL|3XL|2XL|S|M|L)\b/i)?.[1]?.toUpperCase() : null;
    const available = [...new Set(variants.filter(v => v.available).map(v => optionIndex < 0 ? '' : v.options[optionIndex]).filter(Boolean))];
    const facts = [];
    if (listed.length) facts.push(`Listed size${listed.length > 1 ? 's' : ''}: ${listed.join(', ')}.`);
    if (fitNote) facts.push(`The seller describes this piece as “Fits ${fitNote}”. This takes priority over its label for letter-size comparison.`);
    if (!variants.some(v => v.available)) facts.push('This piece is currently sold out.');
    else if (available.length) facts.push(`Currently available: ${available.join(', ')}.`);
    const pit = number(p.pit) || (number(p.chest) ? number(p.chest) / 2 : null), length = number(p.length);
    const validPit = single && pit >= 20 && pit <= 100 ? pit : null;
    const validLength = single && length >= 20 && length <= 180 ? length : null;
    if (category !== 'bottom' && validPit) facts.push(`Listing measurement: ${validPit} cm armpit to armpit${number(p.pit) ? '' : ' (half the listed chest circumference)'}.`);
    if (validLength) facts.push(`Listed length: ${validLength} cm. Check the listing's measurement method when comparing.`);
    const result = (heading, detail, note) => ({heading, detail, facts, note:note || 'Size labels vary by brand and cut. Pre-owned pieces may have shrunk or been altered. This guide has not been calibrated against customer fit outcomes.'});
    if (category === 'child') return result('Check the garment measurements', 'This guide uses adult sizing only. Use the child’s measurements and the listing’s size information.');
    if (category === 'bottom') return result('Compare waist and inside leg', 'Height and weight do not establish a trouser or skirt size. Compare this piece’s waist, rise, hips and inside leg with a similar garment that fits you. Your usual top size does not apply to bottoms.');
    if (category === 'special') return result('Compare the full measurements', 'This garment needs chest, waist and hip measurements to assess fit. Height and weight alone cannot give a useful size recommendation for this cut.');
    const ownPit = number(input.pit), ownLength = number(input.length);
    if (ownPit && validPit) {
      if (ownPit < 20 || ownPit > 100) return result('Check the garment width', 'Enter the flat armpit-to-armpit width in cm, not the full chest circumference.');
      const delta = Math.round((validPit - ownPit) * 10) / 10;
      let detail = Math.abs(delta) <= 2 ? 'This piece is close in chest width to the garment you compared. Shoulders, sleeves, fabric and cut can still change the fit.' : `This piece is ${Math.abs(delta)} cm ${delta > 0 ? 'wider' : 'narrower'} laid flat than your reference garment. Expect ${delta > 0 ? 'more room' : 'less room'} at the chest.`;
      if (ownLength && validLength) {
        const diff = Math.round((validLength - ownLength) * 10) / 10;
        detail += ` It is ${Math.abs(diff)} cm ${diff >= 0 ? 'longer' : 'shorter'}, if measured from the same points.`;
      }
      return result(Math.abs(delta) <= 2 ? 'A close width match' : delta > 0 ? 'A roomier chest fit' : 'A closer chest fit', detail, 'Based on the listing’s measurements and your reference garment, not a body-size prediction. A close width match does not confirm the whole garment will fit.');
    }
    if (h < 145 || h > 205 || w < 45 || w > 130) return result('A measurement comparison will help', 'Your inputs are outside this rough guide’s range. Add the width of a garment you own instead of relying on a height-and-weight size estimate. Your usual label size cannot resolve this.');
    // Broad merchant heuristic: weight normalized to 175 cm. Not inferred body
    // measurements, a brand chart, BMI advice or statistical fit confidence.
    // A self-reported label must never replace the independent estimate.
    const adjusted = w * (175 / h) ** 2;
    const cutoffs = input.reference === 'women' ? [49, 56, 64, 73, 84, 98, 114] : [53, 61, 70, 80, 92, 106, 122];
    let index = cutoffs.findIndex(c => adjusted < c);
    if (index < 0) index = 7;
    const shift = input.fit === 'relaxed' ? 1 : input.fit === 'close' ? -1 : 0;
    const center = Math.max(0, Math.min(7, index + shift));
    const range = [...new Set([sizes[Math.max(0, center - 1)], sizes[center], sizes[Math.min(7, center + 1)]])];
    let detail = `A broad starting range from your ${h} cm height, ${w} kg weight, chosen sizing reference and fit preference. This is not a measurement of your body or confirmation that this particular piece will fit.`;
    if (sizes.includes(input.usual)) {
      facts.push(range.includes(input.usual)
        ? `Your usual ${input.usual} is consistent with this rough range. It was used only as a cross-check, not to choose the result.`
        : `Your usual ${input.usual} differs from this rough range. That disagreement is a reason to compare garment measurements, not to automatically change your size.`);
    }
    if (validPit) facts.push(`For an item-specific comparison, enter the flat chest width of a similar garment you own above. This piece measures ${validPit} cm; height and weight alone cannot establish the width you need.`);
    const candidates = single && fitNote ? [letter(fitNote)] : available.map(letter).filter(Boolean);
    if (candidates.length) detail += candidates.some(v => range.includes(v)) ? ' This listing has a size within that range; that alone does not confirm fit.' : ' This listing’s size is outside that starting range. Check the measurements carefully.';
    else detail += ' This listing has no comparable available letter size. Numeric sizes are not converted without a brand chart.';
    if (single && /oversized|slim fit|runs small|runs large/i.test(`${listed.join(' ')} ${p.description}`)) facts.push('The listing includes a cut or fit note. Compare the actual measurements; no automatic brand-size correction was applied.');
    if (!single) facts.push('This listing has several sizes. Product-level measurements and fit notes are not assigned to individual variants.');
    if (!validPit) facts.push('No usable chest-width measurement is available for this size. Ask us for measurements before buying if unsure.');
    return result(`Rough starting range: ${range.length > 1 ? range[0] + '–' + range.at(-1) : range[0]}`, detail);
  }
  // Also used by the focused arithmetic and catalog regression checks.
  if (typeof module !== 'undefined' && module.exports) module.exports = {recommend, kind, letter};
  if (typeof customElements === 'undefined' || customElements.get('cf-size-finder')) return;
  customElements.define('cf-size-finder', class extends HTMLElement {
    connectedCallback() {
      if (this.ready) return;
      this.ready = true;
      const dialog = this.querySelector('dialog'), open = this.querySelector('.cf-size__open'), form = this.querySelector('form'), output = this.querySelector('.cf-size__result');
      const p = {...this.dataset, options:JSON.parse(this.dataset.options), variants:JSON.parse(this.dataset.variants)};
      open.hidden = false;
      open.addEventListener('click', () => { dialog.showModal(); });
      this.querySelector('.cf-size__close').addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', e => { if (e.target === dialog) {const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();} });
      dialog.addEventListener('close', () => open.focus());
      if (kind(p) === 'bottom') {this.querySelectorAll('[data-top-measure]').forEach(e => e.hidden = true); this.querySelector('[data-bottom-note]').hidden = false;}
      form.addEventListener('input', () => {output.hidden = true;});
      form.addEventListener('submit', e => {
        e.preventDefault();
        const result = recommend(p, Object.fromEntries(new FormData(form)));
        output.replaceChildren();
        const append = (tag, text, parent = output) => {const el = document.createElement(tag); el.textContent = text; parent.append(el); return el;};
        append('h3', result.heading); append('p', result.detail);
        if (result.facts.length) {const ul = append('ul', ''); result.facts.forEach(f => append('li', f, ul));}
        if (result.note) append('small', result.note);
        output.hidden = false; output.focus();
      });
    }
  });
})();
