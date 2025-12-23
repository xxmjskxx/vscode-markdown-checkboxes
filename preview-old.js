// Keep checkbox visuals in sync across tab switches.
// VS Code may restore the Markdown preview webview from a cached DOM snapshot.
// If we only rely on a re-render, the snapshot can show stale checkbox states.
//
// Instead, optimistically update the DOM *at click time* based on the encoded
// toggle args in our vscode:// link. This uses a preview script (allowed)
// rather than inline onclick handlers (often blocked).
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
