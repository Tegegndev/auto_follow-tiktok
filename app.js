// AutoFollower and AutoUnfollower script
// Drop this into the page console, then instantiate and start one of the classes.
//
// To follow users:
// const af = new AutoFollower({ maxFollows: 120, debug: true });
// af.start();
//
// To unfollow users:
// const au = new AutoUnfollower({ maxFollows: 120, debug: true });
// au.start();

class AutoBot {
  constructor(opts = {}) {
    // default delays: min ~ human, max up to 4000ms as requested
    this.clickDelayMin = (opts.clickDelayMin != null) ? opts.clickDelayMin : 900; // ms
    this.clickDelayMax = (opts.clickDelayMax != null) ? opts.clickDelayMax : 4000; // ms (max 4s)
    this.scrollDelay = (opts.scrollDelay != null) ? opts.scrollDelay : 1200; // ms
    this.scrollFraction = (opts.scrollFraction != null) ? opts.scrollFraction : 0.9;
    this.maxFollows = (opts.maxFollows != null) ? opts.maxFollows : 120;
    this.debug = !!opts.debug;
    this.logPrefix = opts.logPrefix || '[AutoBot]';

    this.follows = 0;
    this.running = false;
    this.processed = new WeakSet(); // track handled buttons
    this._stopRequested = false;
  }

  log(...args) {
    if (this.debug) console.log(this.logPrefix, ...args);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  randBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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

  async maybeScrollIfNeeded() {
    // simple heuristic: scroll down a fraction of viewport
    const h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const delta = Math.round(h * this.scrollFraction);
    window.scrollBy({ top: delta, left: 0, behavior: 'smooth' });
    this.log('scrolled by', delta);
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

  async runOnce() {
    throw new Error("Subclasses must implement runOnce()");
  }
}


class AutoFollower extends AutoBot {
  constructor(opts = {}) {
    super(opts);
    this.logPrefix = '[AutoFollower]';
    this.buttonSelector = opts.buttonSelector || 'button[data-e2e="follow-button"]';
    // Option: whether to remove the whole user card after follow
    this.removeAfterFollow = (opts.removeAfterFollow != null) ? !!opts.removeAfterFollow : true;
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
}

class AutoUnfollower extends AutoBot {
  constructor(opts = {}) {
    super(opts);
    this.logPrefix = '[AutoUnfollower]';
    // This selector targets the "Following" or "Friends" button, which you click to start an unfollow.
    // It may need to be adjusted based on TikTok's UI.
    this.buttonSelector = opts.buttonSelector || 'button[data-e2e="following-button"]';

    // This selector is for the final "Unfollow" button inside the confirmation pop-up.
    // This is a guess and may need to be updated.
    this.confirmButtonSelector = opts.confirmButtonSelector || 'button[data-e2e="confirm-unfollow-button"]';
  }

  async clickButtonAndConfirm(btn) {
    if (!btn) return false;
    this.processed.add(btn);

    try {
      btn.scrollIntoView({ block: 'center', behavior: 'auto' });
      await this.sleep(100 + Math.random() * 200);
      if (this._stopRequested) return false;

      // 1. Click the "Following" button to open the confirmation dialog.
      btn.click();
      this.log('Clicked initial button:', btn);

      // Wait for the confirmation dialog to appear.
      await this.sleep(750 + Math.random() * 300);
      if (this._stopRequested) return false;

      // 2. Find and click the final "Unfollow" button in the dialog.
      // Note: This searches the whole document. If multiple dialogs could appear,
      // this might need to be scoped to a specific modal.
      const confirmButton = document.querySelector(this.confirmButtonSelector);
      if (confirmButton) {
        confirmButton.click();
        this.log('Clicked confirmation button.');
        this.follows++; // Use 'follows' counter from the base class.
        return true;
      } else {
        this.log('Could not find confirmation button with selector:', this.confirmButtonSelector);
        return false;
      }
    } catch (err) {
      this.log('Error during unfollow click process:', err);
      return false;
    }
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

      // Random delay before the click
      const delay = this.randBetween(this.clickDelayMin, this.clickDelayMax);
      await this.sleep(delay);

      // check again before clicking
      if (this._stopRequested || !this.running) return;
      if (this.follows >= this.maxFollows) {
        this.log('reached maxFollows (re-check)');
        this.stop();
        return;
      }

      await this.clickButtonAndConfirm(btn);

      // additional randomized pause after handling each candidate
      const postDelay = this.randBetween(250, this.clickDelayMax);
      await this.sleep(postDelay);
    }

    // If we finished current list, scroll and allow more content to load
    await this.sleep(this.scrollDelay);
    await this.maybeScrollIfNeeded();
  }
}
