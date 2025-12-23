// Keep checkbox visuals in sync across tab switches.
// VS Code may restore the Markdown preview webview from a cached DOM snapshot.
//
// Instead of reloading or aggressive DOM rewriting, we:
// - optimistically update the visual state at click time
// - persist last-known states in sessionStorage
// - rehydrate when the preview becomes visible again
(function () {
	const STORAGE_KEY = 'mjskMarkdownCheckboxes.state.v1';

	function loadStateMap() {
		try {
			const raw = sessionStorage.getItem(STORAGE_KEY);
			if (!raw) {
				return {};
			}
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' ? parsed : {};
		} catch {
			return {};
		}
	}

	function saveStateMap(obj) {
		try {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
		} catch {
			// ignore
		}
	}

	function parseArgsFromHref(href) {
		try {
			const url = new URL(href);
			const raw = url.searchParams.get('args');
			if (!raw) {
				return undefined;
			}
			return JSON.parse(decodeURIComponent(raw));
		} catch {
			return undefined;
		}
	}

	function applyStateToSpan(span, stateChar) {
		if (!span) {
			return;
		}
		const normalized = String(stateChar || ' ').toLowerCase();
		span.classList.remove('is-unchecked', 'is-checked', 'is-wip', 'is-cancelled');
		if (normalized === 'x') {
			span.classList.add('is-checked');
			span.setAttribute('aria-checked', 'true');
			return;
		}
		if (normalized === '~') {
			span.classList.add('is-wip');
			span.setAttribute('aria-checked', 'mixed');
			return;
		}
		if (normalized === '-') {
			span.classList.add('is-cancelled');
			span.setAttribute('aria-checked', 'mixed');
			return;
		}
		span.classList.add('is-unchecked');
		span.setAttribute('aria-checked', 'false');
	}

	function getIndexKey(args) {
		const idx = args && typeof args.indexGlobal === 'number' ? args.indexGlobal : undefined;
		return typeof idx === 'number' && Number.isFinite(idx) ? String(idx) : undefined;
	}

	function computeNextFromArgs(currentChar, args) {
		const extended = !!(args && args.extended);
		const cycle = args && Array.isArray(args.cycle) ? args.cycle.filter(s => typeof s === 'string') : [];
		const normalized = String(currentChar || ' ').toLowerCase();
		const charToName = (c) => {
			if (c === 'x') return 'checked';
			if (c === '~') return 'wip';
			if (c === '-') return 'cancelled';
			return 'unchecked';
		};
		const nameToChar = (n) => {
			switch (n) {
				case 'checked':
					return 'x';
				case 'wip':
					return '~';
				case 'cancelled':
					return '-';
				case 'unchecked':
				default:
					return ' ';
			}
		};

		let effectiveCycle = cycle;
		if (!extended) {
			effectiveCycle = effectiveCycle.filter(s => s === 'unchecked' || s === 'checked');
		}
		if (effectiveCycle.length >= 2) {
			const currentName = charToName(normalized);
			const idx = effectiveCycle.indexOf(currentName);
			const nextName = effectiveCycle[(idx === -1 ? 0 : (idx + 1) % effectiveCycle.length)];
			return nameToChar(nextName);
		}

		// Default
		if (normalized === ' ') return 'x';
		if (normalized === 'x') return ' ';
		if (normalized === '~') return 'x';
		if (normalized === '-') return ' ';
		return 'x';
	}

	function storeLastState(args, stateChar) {
		const key = getIndexKey(args);
		if (!key) {
			return;
		}
		const map = loadStateMap();
		map[key] = { state: String(stateChar), t: Date.now() };
		saveStateMap(map);
	}

	function getLastState(args) {
		const key = getIndexKey(args);
		if (!key) {
			return undefined;
		}
		const map = loadStateMap();
		const entry = map && map[key];
		if (!entry || typeof entry !== 'object') {
			return undefined;
		}
		return typeof entry.state === 'string' ? entry.state : undefined;
	}

	function updateHrefArgs(a, args) {
		try {
			const url = new URL(a.href);
			url.searchParams.set('args', encodeURIComponent(JSON.stringify(args)));
			a.href = url.toString();
		} catch {
			// ignore
		}
	}

	function rehydrateFromSession() {
		const links = document.querySelectorAll('a.task-list-item-checkbox-link');
		for (const a of links) {
			if (!a || !a.href || !String(a.href).startsWith('vscode://')) {
				continue;
			}
			const args = parseArgsFromHref(a.href);
			if (!args || typeof args !== 'object') {
				continue;
			}
			const last = getLastState(args);
			if (!last) {
				continue;
			}
			const span = a.querySelector('span.task-list-item-checkbox');
			applyStateToSpan(span, last);
			// Keep args in sync so subsequent clicks compute correctly.
			args.state = last;
			args.next = computeNextFromArgs(last, args);
			updateHrefArgs(a, args);
		}
	}

	document.addEventListener(
		'click',
		(e) => {
			const a = e.target && e.target.closest ? e.target.closest('a.task-list-item-checkbox-link') : null;
			if (!a || !a.href || !String(a.href).startsWith('vscode://')) {
				return;
			}
			const args = parseArgsFromHref(a.href);
			if (!args || typeof args !== 'object') {
				return;
			}
			// Our plugin includes `next` for reliable optimistic updates.
			if (!('next' in args)) {
				return;
			}
			const span = a.querySelector('span.task-list-item-checkbox');
			applyStateToSpan(span, args.next);
			// Update args so repeated toggles work and so tab switches can rehydrate.
			const newState = String(args.next);
			storeLastState(args, newState);
			args.state = newState;
			args.next = computeNextFromArgs(newState, args);
			updateHrefArgs(a, args);
		},
		true
	);

	// When the preview becomes visible again, VS Code may restore a stale DOM snapshot.
	// Re-apply any recorded transitions to keep visuals correct without requiring a click.
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) {
			setTimeout(rehydrateFromSession, 0);
		}
	});

	// Also run once on initial load.
	setTimeout(rehydrateFromSession, 0);
})();

	function computeNextFromArgs(currentChar, args) {
		const extended = !!(args && args.extended);
		const cycle = args && Array.isArray(args.cycle) ? args.cycle.filter(s => typeof s === 'string') : [];
		const normalized = String(currentChar || ' ').toLowerCase();
		const charToName = (c) => {
			if (c === 'x') return 'checked';
			if (c === '~') return 'wip';
			if (c === '-') return 'cancelled';
			return 'unchecked';
		};
		const nameToChar = (n) => {
			switch (n) {
				case 'checked':
					return 'x';
				case 'wip':
					return '~';
				case 'cancelled':
					return '-';
				case 'unchecked':
				default:
					return ' ';
			}
		};

		let effectiveCycle = cycle;
		if (!extended) {
			effectiveCycle = effectiveCycle.filter(s => s === 'unchecked' || s === 'checked');
		}
		if (effectiveCycle.length >= 2) {
			const currentName = charToName(normalized);
			const idx = effectiveCycle.indexOf(currentName);
			const nextName = effectiveCycle[(idx === -1 ? 0 : (idx + 1) % effectiveCycle.length)];
			return nameToChar(nextName);
		}

		// Default
		if (normalized === ' ') return 'x';
		if (normalized === 'x') return ' ';
		if (normalized === '~') return 'x';
		if (normalized === '-') return ' ';
		return 'x';
	}

	function storeLastState(args, stateChar) {
		const key = getIndexKey(args);
		if (!key) {
			return;
		}
		const map = loadStateMap();
		map[key] = { state: String(stateChar), t: Date.now() };
		saveStateMap(map);
	}

	function getLastState(args) {
		const key = getIndexKey(args);
		if (!key) {
			return undefined;
		}
		const map = loadStateMap();
		const entry = map && map[key];
		if (!entry || typeof entry !== 'object') {
			return undefined;
		}
		return typeof entry.state === 'string' ? entry.state : undefined;
	}

	function updateHrefArgs(a, args) {
		try {
			const url = new URL(a.href);
			const encoded = encodeURIComponent(JSON.stringify(args));
			// Avoid double-encoding by writing the raw query string.
			url.search = `?args=${encoded}`;
			a.href = url.toString();
		} catch {
			// ignore
		}
	}

	function rehydrateFromSession() {
		const links = document.querySelectorAll('a.task-list-item-checkbox-link');
		for (const a of links) {
			if (!a || !a.href || !String(a.href).startsWith('vscode://')) {
				continue;
			}
			const args = parseArgsFromHref(a.href);
			if (!args || typeof args !== 'object') {
				continue;
			}
			const last = getLastState(args);
			if (!last) {
				continue;
			}
			const span = a.querySelector('span.task-list-item-checkbox');
			applyStateToSpan(span, last);
			args.state = last;
			args.next = computeNextFromArgs(last, args);
			updateHrefArgs(a, args);
		}
	}

	let _rehydrateTimer = 0;
	let _rehydrateAttempt = 0;
	function scheduleRehydrate() {
		if (_rehydrateTimer) {
			clearTimeout(_rehydrateTimer);
			_rehydrateTimer = 0;
		}
		_rehydrateAttempt = 0;
		const delays = [0, 50, 150, 350, 800];
		const run = () => {
			rehydrateFromSession();
			_rehydrateAttempt++;
			if (_rehydrateAttempt < delays.length) {
				_rehydrateTimer = setTimeout(run, delays[_rehydrateAttempt]);
			} else {
				_rehydrateTimer = 0;
			}
		};
		_rehydrateTimer = setTimeout(run, delays[0]);
	}

	document.addEventListener(
		'click',
		(e) => {
			const a = e.target && e.target.closest ? e.target.closest('a.task-list-item-checkbox-link') : null;
			if (!a || !a.href || !String(a.href).startsWith('vscode://')) {
				return;
			}
			const args = parseArgsFromHref(a.href);
			if (!args || typeof args !== 'object') {
				return;
			}
			if (!('next' in args)) {
				return;
			}
			const span = a.querySelector('span.task-list-item-checkbox');
			applyStateToSpan(span, args.next);
			const newState = String(args.next);
			storeLastState(args, newState);
			args.state = newState;
			args.next = computeNextFromArgs(newState, args);
			updateHrefArgs(a, args);
		},
		true
	);

	// Signals that the preview is back/active.
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) {
			scheduleRehydrate();
		}
	});
	window.addEventListener('focus', scheduleRehydrate, true);
	document.addEventListener('focusin', scheduleRehydrate, true);
	window.addEventListener('pageshow', scheduleRehydrate, true);

	// Detect DOM swaps when switching markdown files in the reused preview webview.
	try {
		const observer = new MutationObserver(() => scheduleRehydrate());
		if (document.body) {
			observer.observe(document.body, { childList: true, subtree: true });
		}
	} catch {
		// ignore
	}

	// Initial pass.
	scheduleRehydrate();
})();
*/
// Keep checkbox visuals in sync across tab switches.
// VS Code may restore the Markdown preview webview from a cached DOM snapshot.
// If we only rely on a re-render, the snapshot can show stale checkbox states.
//
// Instead, optimistically update the DOM *at click time* based on the encoded
// toggle args in our vscode:// link. This uses a preview script (allowed)
// rather than inline onclick handlers (often blocked).
(function () {
	const STORAGE_KEY = 'mjskMarkdownCheckboxes.state.v2';

	function pageKey() {
		// Use the webview URL as a stable per-preview namespace.
		// This avoids state from one markdown preview affecting another.
		try {
			return String(location.href || '');
		} catch {
			return 'unknown';
		}
	}

	function hashString(s) {
		// Simple non-crypto hash for change detection.
		let h = 2166136261;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return (h >>> 0).toString(16);
	}

	function computeDocId() {
		try {
			// VS Code's markdown preview often injects a metadata element; try common shapes.
			const byId = document.getElementById('vscode-markdown-preview-data');
			if (byId && byId.dataset) {
				return (
					byId.dataset.resource ||
					byId.dataset.vscodeResource ||
					byId.dataset.source ||
					byId.dataset.uri ||
					''
				);
			}

			const metas = [
				document.querySelector('meta[name="vscode-resource"]'),
				document.querySelector('meta[name="resource"]'),
				document.querySelector('meta[name="source"]'),
				document.querySelector('meta[name="documentUri"]'),
			];
			for (const m of metas) {
				if (m && m.getAttribute) {
					const v = m.getAttribute('content');
					if (v) {
						return v;
					}
				}
			}
		} catch {
			// ignore
		}
		return '';
	}

	function computeDocKey() {
		// Prefer stable resource identity if VS Code provides it.
		const docId = computeDocId();
		if (docId) {
			return `doc:${docId}`;
		}
		// Fallback: title is stable per markdown file and changes when switching files.
		try {
			const title = String(document.title || '');
			return title ? `title:${title}` : 'unknown-doc';
		} catch {
			return 'unknown-doc';
		}
	}

	function computeDocSignature() {
		try {
			const title = String(document.title || '');
			const docId = computeDocId();
			return hashString(title + '\n' + docId);
		} catch {
			return 'unknown';
		}
	}

	let _rehydrateTimer = 0;
	let _rehydrateAttempt = 0;
	function scheduleRehydrate() {
		if (_rehydrateTimer) {
			clearTimeout(_rehydrateTimer);
			_rehydrateTimer = 0;
		}
		_rehydrateAttempt = 0;
		// VS Code sometimes restores a stale webview DOM snapshot *after* focus/visibility events.
		// Keep trying for a short window to win that race without requiring a click.
		const delays = [0, 25, 75, 150, 300, 600, 1200, 2000];
		const run = () => {
			rehydrateFromSession();
			_rehydrateAttempt++;
			if (_rehydrateAttempt < delays.length) {
				_rehydrateTimer = setTimeout(run, delays[_rehydrateAttempt]);
			} else {
				_rehydrateTimer = 0;
			}
		};
		_rehydrateTimer = setTimeout(run, delays[0]);
	}

	function loadRoot() {
		try {
			const raw = sessionStorage.getItem(STORAGE_KEY);
			if (!raw) {
				return {};
			}
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' ? parsed : {};
		} catch {
			return {};
		}
	}

	function saveRoot(obj) {
		try {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
		} catch {
			// ignore
		}
	}

	function loadPageState() {
		const root = loadRoot();
		const pk = pageKey();
		if (!root[pk] || typeof root[pk] !== 'object') {
			root[pk] = {};
		}
		const pageBucket = root[pk];
		const docKey = computeDocKey();
		const sig = computeDocSignature();
		if (!pageBucket[docKey] || typeof pageBucket[docKey] !== 'object') {
			pageBucket[docKey] = { sig, items: {} };
			saveRoot(root);
			return pageBucket[docKey];
		}
		const entry = pageBucket[docKey];
		if (!entry.items || typeof entry.items !== 'object') {
			entry.items = {};
		}
		// Update last-seen signature but NEVER clear items due to signature changes.
		entry.sig = sig;
		saveRoot(root);
		return entry;
	}

	function savePageState(pageState) {
		const root = loadRoot();
		const pk = pageKey();
		if (!root[pk] || typeof root[pk] !== 'object') {
			root[pk] = {};
		}
		root[pk][computeDocKey()] = pageState;
		saveRoot(root);
	}

	function parseArgsFromHref(href) {
		try {
			const url = new URL(href);
			const raw = url.searchParams.get('args');
			if (!raw) {
				return undefined;
			}
			// Depending on how the href was constructed/updated, raw may already be decoded.
			// Try a few parse strategies without throwing.
			try {
				return JSON.parse(raw);
			} catch {
				// ignore
			}
			try {
				return JSON.parse(decodeURIComponent(raw));
			} catch {
				// ignore
			}
			try {
				return JSON.parse(decodeURIComponent(decodeURIComponent(raw)));
			} catch {
				return undefined;
			}
		} catch {
			return undefined;
		}
	}

	function applyStateToSpan(span, stateChar) {
		if (!span) {
			return;
		}
		const normalized = String(stateChar || ' ').toLowerCase();
		span.classList.remove('is-unchecked', 'is-checked', 'is-wip', 'is-cancelled');
		if (normalized === 'x') {
			span.classList.add('is-checked');
			span.setAttribute('aria-checked', 'true');
			return;
		}
		if (normalized === '~') {
			span.classList.add('is-wip');
			span.setAttribute('aria-checked', 'mixed');
			return;
		}
		if (normalized === '-') {
			span.classList.add('is-cancelled');
			span.setAttribute('aria-checked', 'mixed');
			return;
		}
		span.classList.add('is-unchecked');
		span.setAttribute('aria-checked', 'false');
	}

	function getIndexKey(args) {
		const idx = args && typeof args.indexGlobal === 'number' ? args.indexGlobal : undefined;
		const line = args && typeof args.line === 'number' ? args.line : undefined;
		if (typeof idx === 'number' && Number.isFinite(idx)) {
			return typeof line === 'number' && Number.isFinite(line) ? `${idx}@${line}` : String(idx);
		}
		return undefined;
	}

	function computeNextFromArgs(currentChar, args) {
		const extended = !!(args && args.extended);
		const cycle = args && Array.isArray(args.cycle) ? args.cycle.filter(s => typeof s === 'string') : [];
		const normalized = String(currentChar || ' ').toLowerCase();
		const charToName = (c) => {
			if (c === 'x') return 'checked';
			if (c === '~') return 'wip';
			if (c === '-') return 'cancelled';
			return 'unchecked';
		};
		const nameToChar = (n) => {
			switch (n) {
				case 'checked':
					return 'x';
				case 'wip':
					return '~';
				case 'cancelled':
					return '-';
				case 'unchecked':
				default:
					return ' ';
			}
		};

		let effectiveCycle = cycle;
		if (!extended) {
			effectiveCycle = effectiveCycle.filter(s => s === 'unchecked' || s === 'checked');
		}
		if (effectiveCycle.length >= 2) {
			const currentName = charToName(normalized);
			const idx = effectiveCycle.indexOf(currentName);
			const nextName = effectiveCycle[(idx === -1 ? 0 : (idx + 1) % effectiveCycle.length)];
			return nameToChar(nextName);
		}

		// Default
		if (normalized === ' ') return 'x';
		if (normalized === 'x') return ' ';
		if (normalized === '~') return 'x';
		if (normalized === '-') return ' ';
		return 'x';
	}

	function storeLastState(args, stateChar) {
		const key = getIndexKey(args);
		if (!key) {
			return;
		}
		const pageState = loadPageState();
		pageState.items[key] = { state: String(stateChar), t: Date.now() };
		savePageState(pageState);
	}

	function getLastState(args) {
		const key = getIndexKey(args);
		if (!key) {
			return undefined;
		}
		const pageState = loadPageState();
		const entry = pageState && pageState.items && pageState.items[key];
		if (!entry || typeof entry !== 'object') {
			return undefined;
		}
		return typeof entry.state === 'string' ? entry.state : undefined;
	}

	function updateHrefArgs(a, args) {
		try {
			// IMPORTANT: Avoid using url.searchParams.set with an already-encoded value,
			// because it will escape '%' and cause repeated double-encoding.
			const url = new URL(a.href);
			const encoded = encodeURIComponent(JSON.stringify(args));
			url.search = `?args=${encoded}`;
			a.href = url.toString();
		} catch {
			// ignore
		}
	}

	function rehydrateFromSession() {
		// Ensure state bucket exists and doc signature is up to date.
		loadPageState();
		const links = document.querySelectorAll('a.task-list-item-checkbox-link');
		for (const a of links) {
			if (!a || !a.href || !String(a.href).startsWith('vscode://')) {
				continue;
			}
			const args = parseArgsFromHref(a.href);
			if (!args || typeof args !== 'object') {
				continue;
			}
			const last = getLastState(args);
			if (!last) {
				continue;
			}
			const span = a.querySelector('span.task-list-item-checkbox');
			applyStateToSpan(span, last);
			// Keep args in sync so subsequent clicks compute correctly.
			args.state = last;
			args.next = computeNextFromArgs(last, args);
			updateHrefArgs(a, args);
		}
	}

	document.addEventListener(
		'click',
		(e) => {
			const a = e.target && e.target.closest ? e.target.closest('a.task-list-item-checkbox-link') : null;
			if (!a || !a.href || !String(a.href).startsWith('vscode://')) {
				return;
			}
			const args = parseArgsFromHref(a.href);
			if (!args || typeof args !== 'object') {
				return;
			}
			// Our plugin includes `next` for reliable optimistic updates.
			if (!('next' in args)) {
				return;
			}
			const span = a.querySelector('span.task-list-item-checkbox');
			applyStateToSpan(span, args.next);
			// Update args so repeated toggles work and so tab switches can rehydrate.
			const newState = String(args.next);
			storeLastState(args, newState);
			args.state = newState;
			args.next = computeNextFromArgs(newState, args);
			updateHrefArgs(a, args);
		},
		true
	);

	// When the preview becomes visible again, VS Code may restore a stale DOM snapshot.
	// Re-apply stored state to keep visuals correct without requiring a click.
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) {
			scheduleRehydrate();
		}
	});

	// Some VS Code tab switches don't always toggle document.hidden the way we'd expect.
	// Add a few extra signals that the webview is active again.
	window.addEventListener('focus', scheduleRehydrate, true);
	document.addEventListener('focusin', scheduleRehydrate, true);
	window.addEventListener('pageshow', scheduleRehydrate, true);
	// When returning to the preview, the first user interaction is often mouse movement.
	// Use it as a lightweight signal to rehydrate if VS Code didn't fire focus events.
	document.addEventListener('pointermove', scheduleRehydrate, { capture: true, passive: true });
	document.addEventListener('mousemove', scheduleRehydrate, { capture: true, passive: true });
	document.addEventListener('mouseover', scheduleRehydrate, { capture: true, passive: true });

	// VS Code can swap the entire preview DOM when switching markdown files.
	// Observe mutations and rehydrate after the new content lands.
	try {
		const observer = new MutationObserver(() => {
			scheduleRehydrate();
		});
		if (document.body) {
			observer.observe(document.body, { childList: true, subtree: true });
		}
	} catch {
		// ignore
	}

	// Last-resort watchdog: rehydrate periodically while visible.
	// This is cheap (only touches elements we render) and ensures resync even if
	// VS Code restores the DOM snapshot without emitting any of the events above.
	setInterval(() => {
		try {
			if (!document.hidden) {
				rehydrateFromSession();
			}
		} catch {
			// ignore
		}
	}, 1500);

	// Also run once on initial load.
	scheduleRehydrate();
})();
