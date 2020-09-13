/**
 * Opens the modal.
 * @param modal {HTMLElement}
 */
export function openModal(modal) {
	modal.style.display = "block"
}

/**
 * Closes the modal.
 * @param modal {HTMLElement}
 */
export function closeModal(modal) {
	modal.style.display = "none";
	/* @type HTMLFormElement */
	const form = modal.querySelector("form");
	form && form.reset();
}

export function initModal(modal) {
	modal.onkeydown = (e) => {
		if (e.code === "Escape") {
			closeModal(modal);
		}
	};
	const closeButton = modal.querySelector(".close");
	if (!!closeButton) {
		closeButton.onclick = (e) => {
			closeModal(modal)
		}
	}
}