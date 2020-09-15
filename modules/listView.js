import { createTimesheet, getTimesheetFolderId } from "./timesheetServiceUtils.js"
import * as modal from "./modal.js"

/**
 * Handles the submit from the new spreadsheet form.
 */
function newSpreadsheetFormSubmitHandler() {
	const name = ele("spreadSheetName").value;
	console.log(`Creating timesheet '${name}'`);
	loadInc();
	createTimesheet(name).then((spreadsheetId) => {
		console.log("Created timesheet", spreadsheetId);
		window.location.href = `#sheet/${spreadsheetId}`;
	}, (e) => {
		uncaughtErrorHandler(e);
	}).finally(()=> {
		loadDec();
	});
	modal.closeModal(ele("newSpreadsheetContainer"));
	return false;
}

function openNewSpreadsheetForm() {
	ele('newSpreadsheetContainer').style.display = '';
	ele('spreadSheetName').focus();
}


/**
 * The content area will display a list of all non-trashed sheets within the folders named "Timesheets".
 */
async function timesheetsList() {
	const content = ele("content");

	content.innerHTML = `<button id="newTimesheetButton">Create New Timesheet</button>
<div id="newSpreadsheetContainer" style="display: none" class="modal">
	<div class="panel">
		<div class="titleBar">
			<div class="label">Create Timesheet</div>
			<div class="close">&times;</div>
		</div>
		<form id="newSpreadsheetForm" action="#list/">
			<label>Name:</label>
			<input id="spreadSheetName" type="text" required>
			<label></label>
			<input type="submit">
		</form>
	</div>
</div>`;

	ele("newTimesheetButton").onclick = () => {
		openNewSpreadsheetForm();
	};

	modal.initModal(ele("newSpreadsheetContainer"));

	ele("newSpreadsheetForm").onsubmit = newSpreadsheetFormSubmitHandler;

	const ul = document.createElement("ul");
	content.appendChild(ul);
	const timesheetFolderId = await getTimesheetFolderId();
	const timesheetsResponse = await gapi.client.drive.files.list({
		"q": `'${timesheetFolderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`
	});

	console.debug("timesheetsResponse", timesheetsResponse);
	for (const timesheet of timesheetsResponse.result.files) {
		const li = document.createElement("li");
		ul.appendChild(li);
		const a = document.createElement("a");
		a.innerText = timesheet.name;
		a.href = "#sheet/" + timesheet.id;
		li.appendChild(a);
	}
}

export default timesheetsList;