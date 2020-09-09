import { createTimesheet, getTimesheetFolderId } from "./timesheetApi.js"

/**
 * @param form HTMLFormElement
 */
function submitNewSpreadsheetForm(form) {
	console.log(form);
	const name = ele("spreadSheetName").value;
	createTimesheet(name).then((spreadsheetId) => {
		console.log("Created", spreadsheetId);
		window.location.href = `#sheet/${spreadsheetId}`;
	}, (e) => {
		uncaughtErrorHandler(e);
	});
	closeNewSpreadsheetForm();
	return false;
}

function closeNewSpreadsheetForm() {
	ele("newSpreadsheetForm").reset();
	ele("newSpreadsheetContainer").style.display = "none";
}

/**
 * The content area will display a list of all non-trashed sheets within the folders named "Timesheets".
 */
export default async function timesheetsList() {
	const content = ele("content");

	content.innerHTML = `<button onclick="ele('newSpreadsheetContainer').style.display = ''; ele('spreadSheetName').focus();">Create New Timesheet</button>
<div id="newSpreadsheetContainer" style="display: none">
	<h3>Create Timesheet</h3>
	<form id="newSpreadsheetForm" action="#list/" onsubmit="return submitNewSpreadsheetForm(this);">
		<label>Name:</label>
		<input id="spreadSheetName" type="text" required>
		<input type="submit">
	</form>
</div>`;

	ele("newSpreadsheetContainer").onkeydown = (e) => {
		if (e.keyCode === 27) {
			closeNewSpreadsheetForm();
		}
	};

	const ul = document.createElement("ul");
	content.appendChild(ul);
	const timesheetFolderId = await getTimesheetFolderId();
	const timesheetsResponse = await gapi.client.drive.files.list({
		"q": `'${timesheetFolderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`
	});
	console.log(timesheetsResponse);
	for (const timesheet of timesheetsResponse.result.files) {
		console.log(timesheet);
		const li = document.createElement("li");
		ul.appendChild(li);
		const a = document.createElement("a");
		a.innerText = timesheet.name;
		a.href = "#sheet/" + timesheet.id;
		li.appendChild(a);
	}
}