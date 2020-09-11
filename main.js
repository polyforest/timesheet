"use strict";

window.state = {
	isSignedIn: false,
	pageToken: -1
};

// Client ID and API key from the Developer Console
const CLIENT_ID = '360768471837-s7u2be5g89i1d4s4n35gp5d2p5m6mgg9.apps.googleusercontent.com';
const API_KEY = 'AIzaSyA8blW19Y2bKxKJIf1S41Vss1ZyXKQn6Xw';

// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = ['https://sheets.googleapis.com/$discovery/rest?version=v4', 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = ["drive.file"].map(s => `https://www.googleapis.com/auth/${s}`).join(" ")

const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');

/**
 * Returns a reference to the first object with the specified value of the ID or NAME attribute.
 * An alias to Document.getElementById
 * @param id String that specifies the ID value. Case-insensitive.
 * @return HTMLElement
 */
function ele(id) {
	return document.getElementById(id);
}

/**
 * Returns the first element that is a descendant of node that matches selectors.
 * An alias to Document.querySelector
 * @param selectors String
 * @return Element
 */
function query(selectors) {
	return document.querySelector(selectors);
}

/**
 *  Initializes the API client library and sets up sign-in state
 *  listeners.
 */
async function initClient() {
	await gapi.client.init({
		apiKey: API_KEY,
		clientId: CLIENT_ID,
		discoveryDocs: DISCOVERY_DOCS,
		scope: SCOPES
	});
	// Listen for sign-in state changes.
	gapi.auth2.getAuthInstance().isSignedIn.listen(updateSignInStatus);
	// Handle the initial sign-in state.
	updateSignInStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
	authorizeButton.onclick = handleAuthClick;
	signoutButton.onclick = handleSignoutClick;
}

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
function updateSignInStatus(isSignedIn) {
	state.isSignedIn = isSignedIn;
	if (isSignedIn) {
		authorizeButton.style.display = 'none';
		signoutButton.style.display = 'block';
	} else {
		authorizeButton.style.display = 'block';
		signoutButton.style.display = 'none';
		localStorage.removeItem("lastLocation");
	}
	router();
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
	gapi.auth2.getAuthInstance().signIn().catch((ignore) => {});
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
	gapi.auth2.getAuthInstance().signOut().catch((ignore) => {});
}

/**
 * @param sheetId String
 * @return {Promise<void>}
 */
async function editSheetView(sheetId) {
	return await (await import(`./modules/editSheet.js`)).default(sheetId);
}

/**
 * @return {Promise<void>}
 */
async function listView() {
	return await (await import(`./modules/listView.js`)).default();
}

function router() {
	ele("content").innerHTML = "";
	if (!state.isSignedIn) return;

	const view = (hash) => {
		if (hash.startsWith("#sheet/")) {
			return editSheetView(hash.substr("#sheet/".length));
		} else {
			return listView()
		}
	}
	if (location.hash === "") {
		const hash = localStorage.getItem("lastLocation") || "";
		if (hash !== "") {
			location.hash = hash
			return;
		}
	} else {
		localStorage.setItem("lastLocation", location.hash);
	}
	view(location.hash).catch(uncaughtErrorHandler);
}

window.addEventListener('hashchange', router, false);

// async function getChangesStartToken() {
// 	if (state.pageToken !== -1) return;
// 	const tokenResponse = await gapi.client.drive.changes.getStartPageToken();
// 	state.pageToken = tokenResponse.result.startPageToken;
// 	console.log("pageToken", state.pageToken);
// }

// async function pollChanges() {
// 	if (!state.isSignedIn || !state.isActive || state.pageToken === -1) return;
// 	const changesListResponse = await gapi.client.drive.changes.list({
// 		pageToken: state.pageToken,
// 		pageSize: 1000
// 	});
// 	const changedFiles = changesListResponse.result.changes.map(change => change.fileId);
// 	console.log("changedFiles ", changedFiles);
// 	state.pageToken = changesListResponse.result.nextPageToken || changesListResponse.result.newStartPageToken;
// 	console.log("Polled changes", state.pageToken);
// }
//
// window.addEventListener("focus", (e) => {
// 	state.isActive = true;
// 	// pollChanges();
// });
// window.addEventListener("blur", (e) => {
// 	state.isActive = false;
// });
// setInterval(pollChanges, 5000);