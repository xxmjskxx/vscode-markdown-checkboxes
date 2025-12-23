// Reload the markdown preview when it becomes visible again.
// This avoids stale checkbox DOM state when VS Code reuses the preview webview.
(function () {
	let lastHidden = document.hidden;
	document.addEventListener('visibilitychange', () => {
		const nowHidden = document.hidden;
		if (lastHidden && !nowHidden) {
			// Delay slightly to let VS Code finish switching tabs.
			setTimeout(() => {
				try {
					location.reload();
				} catch {
					// ignore
				}
			}, 0);
		}
		lastHidden = nowHidden;
	});
})();
