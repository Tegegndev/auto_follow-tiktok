// AutoFollower-with-sleep-and-remove.js
// Drop this into the page console, then instantiate and start:
// const af = new AutoFollower({ maxFollows: 120, debug: true });
// af.start();

class AutoFollower {
  constructor(opts = {}) {
    this.buttonSelector = opts.buttonSelector || 'button[data-e2e="follow-button"]';
    // default delays: min ~ human, max up to 4000ms as requested
    this.clickDelayMin = (opts.clickDelayMin != null) ? opts.clickDelayMin : 900; // ms
    this.clickDelayMax = (opts.clickDelayMax != null) ? opts.clickDelayMax : 4000; // ms (max 4s)
    this.scrollDelay = (opts.scrollDelay != null) ? opts.scrollDelay : 1200; // ms
    this.scrollFraction = (opts.scrollFraction != null) ? opts.scrollFraction : 0.9;
    this.maxFollows = (opts.maxFollows != null) ? opts.maxFollows : 120;
    this.debug = !!opts.debug;

    this.follows = 0;
    this.running = false;
    this.processed = new WeakSet(); // track handled buttons
    this._stopRequested = false;
    // Option: whether to remove the whole user card after follow
    this.removeAfterFollow = (opts.removeAfterFollow != null) ? !!opts.removeAfterFollow : true;
  }

  log(...args) {
    if (this.debug) console.log('[AutoFollower]', ...args);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  randBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Pick a container to remove that likely represents the user card.
  // Strategy: walk up ancestors looking for an element that contains a profile link (href with '/@')
  findRemovableContainer(el) {
    let cur = el;
    while (cur && cur !== document.body) {
      try {
        if (cur.querySelector && cur.querySelector('a[href*="/@"]')) return cur;
      } catch (e) {
        // ignore restricted nodes
      }
      cur = cur.parentElement;
    }
    // Fallbacks
    return el.parentElement || el;
  }

  findCandidates() {
    const all = Array.from(document.querySelectorAll(this.buttonSelector));
    // filter only visible, enabled and not already processed
    return all.filter(btn => {
      try {
        if (!btn.offsetParent) return false; // hidden
      } catch (e) {
        return false;
      }
      if (this.processed.has(btn)) return false;
      return true;
    });
  }

  async clickButtonAndRemove(btn) {
    if (!btn) return false;
    // Prevent double-handling
    this.processed.add(btn);
    try {
      // Basic label check: ensure button looks like "Follow"
      const label = (btn.textContent || '').trim().toLowerCase();

      btn.scrollIntoView({ block: 'center', behavior: 'auto' });
      await this.sleep(100 + Math.random() * 200); // small humanization before click
      if (this._stopRequested) return false;

      btn.click();
      this.log('clicked', btn, 'pre-remove total:', this.follows + 1);

      // Let the page update state / issue its signing/network work briefly
      await this.sleep(250);

      // Optionally remove the whole card/ancestor to avoid duplication
      if (this.removeAfterFollow) {
        try {
          const container = this.findRemovableContainer(btn);
          if (container && container !== document.body) {
            container.remove();
            this.log('removed container for clicked button', container);
          } else {
            // As a last resort, remove the clicked button itself
            btn.remove();
            this.log('removed clicked button itself');
          }
        } catch (err) {
          this.log('error removing container', err);
        }
      }

      this.follows++;
      return true;
    } catch (err) {
      this.log('click error', err);
      return false;
    }
  }

  async maybeScrollIfNeeded() {
    // simple heuristic: scroll down a fraction of viewport
    const h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const delta = Math.round(h * this.scrollFraction);
    window.scrollBy({ top: delta, left: 0, behavior: 'smooth' });
    this.log('scrolled by', delta);
  }

  async runOnce() {
    // find candidates and click sequentially with waits
    const candidates = this.findCandidates();
    this.log('candidates found', candidates.length);

    for (const btn of candidates) {
      if (!this.running) return;
      if (this._stopRequested) {
        this.log('stop requested, breaking');
        this.running = false;
        return;
      }

      if (this.follows >= this.maxFollows) {
        this.log('reached maxFollows');
        this.stop();
        return;
      }

      // Random delay before the click (human-like) with max up to 4s
      const delay = this.randBetween(this.clickDelayMin, this.clickDelayMax);
      await this.sleep(delay);

      // check again before clicking
      if (this._stopRequested || !this.running) return;
      if (this.follows >= this.maxFollows) {
        this.log('reached maxFollows (re-check)');
        this.stop();
        return;
      }

      await this.clickButtonAndRemove(btn);

      // additional randomized pause after handling each candidate (up to 4s)
      const postDelay = this.randBetween(250, this.clickDelayMax);
      await this.sleep(postDelay);
    }

    // If we finished current list, scroll and allow more content to load
    await this.sleep(this.scrollDelay);
    await this.maybeScrollIfNeeded();
  }

  async mainLoop() {
    if (this.running) return;
    this.running = true;
    this._stopRequested = false;
    this.log('starting main loop', {
      buttonSelector: this.buttonSelector,
      clickDelayMin: this.clickDelayMin,
      clickDelayMax: this.clickDelayMax,
      scrollDelay: this.scrollDelay,
      scrollFraction: this.scrollFraction,
      maxFollows: this.maxFollows,
      removeAfterFollow: this.removeAfterFollow
    });

    try {
      while (this.running && !this._stopRequested) {
        // run one pass and allow DOM/network to settle
        await this.runOnce();

        // If still running, small between-pass wait to avoid tight loops
        if (this.running && !this._stopRequested && this.follows < this.maxFollows) {
          await this.sleep(500); // tune as needed
        }

        if (this.follows >= this.maxFollows) {
          this.log('reached maxFollows (loop end)');
          break;
        }
      }
    } catch (err) {
      this.log('mainLoop error', err);
    } finally {
      this.running = false;
      this.log('finished. follows:', this.follows);
    }
  }

  start() {
    if (this.running) {
      this.log('already running');
      return;
    }
    this._stopRequested = false;
    this.mainLoop();
  }

  stop() {
    this._stopRequested = true;
    // running flag will be cleared naturally by loop
  }
}
